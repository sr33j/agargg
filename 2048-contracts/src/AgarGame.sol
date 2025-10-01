// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

struct Player {
    uint256 monAmount;
    uint256 x;
    uint256 y;
}

enum Direction {
    UP,
    DOWN,
    LEFT,
    RIGHT
}

contract AgarGame {
    // Game parameters
    uint256 public immutable velocityMin;
    uint256 public immutable velocityMax;
    uint256 public immutable boardHeight;
    uint256 public immutable boardWidth;
    uint256 public immutable maxNumPlayers;
    uint256 public immutable minMonAmount;
    uint256 public immutable moveFee;
    address public immutable paymaster;
    uint256 public immutable boardCoverageFactor;

    // State
    uint256 public numPlayers;
    uint256 public spaceLeft;
    mapping(address => Player) public players;
    address[] public playerAddresses;

    // Events
    event Enter(address indexed player, uint256 monAmount, uint256 x, uint256 y);
    event Move(address indexed player, uint256 x, uint256 y);
    event Leave(address indexed player, uint256 monAmount);
    event Redeposit(address indexed player, uint256 addedAmount, uint256 newMonAmount);
    event Collision(address indexed winner, address indexed loser, uint256 winnerNewAmount, uint256 loserAmount);

    constructor(
        uint256 _boardCoverageFactor,
        uint256 _velocityMin,
        uint256 _velocityMax,
        uint256 _boardHeight,
        uint256 _boardWidth,
        uint256 _maxNumPlayers,
        uint256 _minMonAmount,
        uint256 _moveFee,
        address _paymaster
    ) {
        require(_velocityMin < _velocityMax, "Min velocity must be less than max velocity");
        require(_boardHeight > 0 && _boardWidth > 0, "Board height and width must be greater than 0");
        require(_maxNumPlayers > 0, "Max number of players must be greater than 0");
        require(_paymaster != address(0), "Invalid paymaster address");
        require(_boardCoverageFactor > 0, "Coverage factor must be > 0");
        velocityMin = _velocityMin;
        velocityMax = _velocityMax;
        boardHeight = _boardHeight;
        boardWidth = _boardWidth;
        maxNumPlayers = _maxNumPlayers;
        minMonAmount = _minMonAmount;
        moveFee = _moveFee;
        paymaster = _paymaster;
        boardCoverageFactor = _boardCoverageFactor;
        spaceLeft = _boardHeight * _boardWidth;
    }

    // Helper: max size a player can enter with
    function getMaxSize() public view returns (uint256) {
        if (maxNumPlayers <= numPlayers) return 0;
        return spaceLeft / (maxNumPlayers - numPlayers) / boardCoverageFactor;
    }

    // Helper: radius from monAmount
    function getRadius(uint256 monAmount) public pure returns (uint256) {
        // pi ~ 3.14159 * 1e18 for precision
        uint256 pi = 3141592653589793238;
        // area = monAmount, area = pi * r^2 => r = sqrt(monAmount * 1e18 / pi)
        return sqrt(monAmount * 1e18 / pi);
    }

    // Helper: sqrt using Babylonian method
    function sqrt(uint256 x) public pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    // Helper: velocity from monAmount (smaller = faster)
    function getVelocity(uint256 monAmount) public view returns (uint256) {
        if (monAmount <= minMonAmount) return velocityMax;
        uint256 maxMon = getMaxSize();
        if (maxMon == 0 || monAmount >= maxMon) return velocityMin;
        // Prevent division by zero
        if (maxMon <= minMonAmount) return velocityMin;
        // Linear interpolation
        return velocityMax - ((monAmount - minMonAmount) * (velocityMax - velocityMin)) / (maxMon - minMonAmount);
    }

    // Helper: collision between two players
    function playersConflict(uint256 x1, uint256 y1, uint256 m1, uint256 x2, uint256 y2, uint256 m2) public pure returns (bool) {
        uint256 r1 = getRadius(m1);
        uint256 r2 = getRadius(m2);
        uint256 dx = x1 > x2 ? x1 - x2 : x2 - x1;
        uint256 dy = y1 > y2 ? y1 - y2 : y2 - y1;
        uint256 distSq = dx * dx + dy * dy;
        uint256 radSum = r1 + r2;
        return distSq < radSum * radSum;
    }

    // Helper: wall collision
    function wallCollision(uint256 x, uint256 y, uint256 radius, Direction direction) public view returns (bool) {
        if (direction == Direction.UP) {
            return y < radius;
        } else if (direction == Direction.DOWN) {
            return y + radius >= boardHeight;
        } else if (direction == Direction.LEFT) {
            return x < radius;
        } else if (direction == Direction.RIGHT) {
            return x + radius >= boardWidth;
        }
        return false;
    }

    // Helper: Calculate distance squared between two points
    function distanceSquared(uint256 x1, uint256 y1, uint256 x2, uint256 y2) public pure returns (uint256) {
        uint256 dx = x1 > x2 ? x1 - x2 : x2 - x1;
        uint256 dy = y1 > y2 ? y1 - y2 : y2 - y1;
        return dx * dx + dy * dy;
    }

    // Helper: Find closest collision point on path
    function findClosestCollision(
        uint256 startX, uint256 startY,
        uint256 endX, uint256 endY,
        uint256 playerX, uint256 playerY,
        uint256 playerRadius
    ) public pure returns (bool collision, uint256 collisionDistSq) {
        // Vector from start to end
        int256 dx = int256(endX) - int256(startX);
        int256 dy = int256(endY) - int256(startY);
        
        // Vector from start to player
        int256 px = int256(playerX) - int256(startX);
        int256 py = int256(playerY) - int256(startY);
        
        // Length of movement vector squared
        uint256 lenSq = uint256(dx * dx + dy * dy);
        
        // If we're not moving, just check if we're colliding with the player
        if (lenSq == 0) {
            uint256 distSqToPlayer = uint256(px * px + py * py);
            return (distSqToPlayer < playerRadius * playerRadius, distSqToPlayer);
        }
        
        // Project player position onto movement vector
        int256 tNum = (px * dx + py * dy);
        int256 tDen = int256(lenSq);
        int256 t = tDen == 0 ? int256(0) : (tNum * 1e18) / tDen; // Fixed point math
        
        // Clamp t to [0,1e18] to stay within the line segment
        if (t < 0) t = 0;
        if (t > 1e18) t = 1e18;
        
        // Calculate closest point on line to player
        int256 closestX = int256(startX) + (t * dx) / 1e18;
        int256 closestY = int256(startY) + (t * dy) / 1e18;
        
        // Calculate distance from closest point to player
        int256 distX = closestX - int256(playerX);
        int256 distY = closestY - int256(playerY);
        uint256 distSq = uint256(distX * distX + distY * distY);
        
        return (distSq < playerRadius * playerRadius, distSq);
    }

    // Enter the game
    function enter(uint256 monAmount, uint256 x, uint256 y, uint256 deadline) external payable {
        require(block.number <= deadline, "Expired");
        require(numPlayers < maxNumPlayers, "Game full");
        require(msg.value >= monAmount, "Insufficient value sent");
        require(monAmount >= minMonAmount, "Below min amount");
        require(players[msg.sender].monAmount == 0, "Already in game");
        uint256 maxAmount = getMaxSize();
        require(monAmount <= maxAmount, "Above max size");
        uint256 radius = getRadius(monAmount);
        require(x >= radius && y >= radius, "Out of bounds");
        require(x + radius <= boardWidth && y + radius <= boardHeight, "Out of bounds");
        // No collision with existing players
        for (uint256 i = 0; i < playerAddresses.length; i++) {
            address other = playerAddresses[i];
            Player storage p = players[other];
            if (p.monAmount > 0 && playersConflict(x, y, monAmount, p.x, p.y, p.monAmount)) {
                revert("Collision with another player");
            }
        }
        players[msg.sender] = Player(monAmount, x, y);
        
        // Only add to playerAddresses if not already present (prevents duplicates on re-entry)
        bool alreadyInArray = false;
        for (uint256 i = 0; i < playerAddresses.length; i++) {
            if (playerAddresses[i] == msg.sender) {
                alreadyInArray = true;
                break;
            }
        }
        if (!alreadyInArray) {
            playerAddresses.push(msg.sender);
        }
        
        numPlayers++;
        spaceLeft -= monAmount;
        emit Enter(msg.sender, monAmount, x, y);
    }

    // Add more MON to an existing player without changing position
    function redeposit(uint256 additionalMon, uint256 deadline) external payable {
        require(block.number <= deadline, "Expired");
        require(additionalMon > 0, "Invalid amount");
        require(msg.value >= additionalMon, "Insufficient value sent");
        require(additionalMon <= spaceLeft, "Not enough space");

        Player storage p = players[msg.sender];
        require(p.monAmount > 0, "Not in game");

        uint256 newMon = p.monAmount + additionalMon;
        uint256 maxAmount = getMaxSize();
        require(newMon <= maxAmount, "Above max size");
        uint256 newRadius = getRadius(newMon);

        // Ensure current position remains valid with increased radius
        require(p.x >= newRadius && p.y >= newRadius, "Out of bounds");
        require(p.x + newRadius <= boardWidth && p.y + newRadius <= boardHeight, "Out of bounds");

        // Ensure no collision is created with existing players
        for (uint256 i = 0; i < playerAddresses.length; i++) {
            address other = playerAddresses[i];
            if (other == msg.sender) continue;
            Player storage op = players[other];
            if (op.monAmount == 0) continue;
            if (playersConflict(p.x, p.y, newMon, op.x, op.y, op.monAmount)) {
                revert("Collision with another player");
            }
        }

        // Apply state changes
        p.monAmount = newMon;
        spaceLeft -= additionalMon;

        emit Redeposit(msg.sender, additionalMon, newMon);
    }

    // Move the player
    function move(Direction direction, uint256 deadline) external {
        require(block.number <= deadline, "Expired");
        Player storage p = players[msg.sender];
        require(p.monAmount >= minMonAmount, "Not in game");
        require(p.monAmount >= moveFee, "Insufficient mon for move");

        // Deduct move fee from player's balance first (checks-effects-interactions)
        p.monAmount -= moveFee;
        spaceLeft += moveFee;
        uint256 radius = getRadius(p.monAmount);
        uint256 v = getVelocity(p.monAmount);
        uint256 nextX = p.x;
        uint256 nextY = p.y;
        if (direction == Direction.UP) {
            require(p.y >= v, "Underflow protection");
            nextY = p.y - v;
        } else if (direction == Direction.DOWN) {
            nextY = p.y + v;
        } else if (direction == Direction.LEFT) {
            require(p.x >= v, "Underflow protection");
            nextX = p.x - v;
        } else if (direction == Direction.RIGHT) {
            nextX = p.x + v;
        }
        require(!wallCollision(nextX, nextY, radius, direction), "Wall collision");
        
        // Find closest collision
        address closestCollision = address(0);
        uint256 closestDistSq = type(uint256).max;
        for (uint256 i = 0; i < playerAddresses.length; i++) {
            address other = playerAddresses[i];
            if (other == msg.sender) continue;
            Player storage op = players[other];
            if (op.monAmount == 0) continue;
            (bool collision, uint256 distSq) = findClosestCollision(
                p.x, p.y,
                nextX, nextY,
                op.x, op.y,
                getRadius(op.monAmount)
            );
            if (collision && distSq < closestDistSq) {
                closestCollision = other;
                closestDistSq = distSq;
            }
        }
        // Handle collision if found
        if (closestCollision != address(0)) {
            Player storage op = players[closestCollision];
            if (p.monAmount > op.monAmount) {
                uint256 loserAmount = op.monAmount;
                p.monAmount += op.monAmount;
                op.monAmount = 0;
                op.x = 0;
                op.y = 0;
                numPlayers--;
                emit Collision(msg.sender, closestCollision, p.monAmount, loserAmount);
            } else {
                uint256 loserAmount = p.monAmount;
                op.monAmount += p.monAmount;
                p.monAmount = 0;
                p.x = 0;
                p.y = 0;
                numPlayers--;
                emit Collision(closestCollision, msg.sender, op.monAmount, loserAmount);
            }
        }

        // Only update position if player is still alive
        if (p.monAmount > 0) {
            p.x = nextX;
            p.y = nextY;
        }
        
        // Send move fee to paymaster after all state changes (checks-effects-interactions)
        (bool sent, ) = paymaster.call{value: moveFee}("");
        require(sent, "Fee transfer failed");
        
        emit Move(msg.sender, p.x, p.y);
    }

    // Leave the game
    function leave(uint256 deadline) external {
        require(block.number <= deadline, "Expired");
        Player storage p = players[msg.sender];
        require(p.monAmount > 0, "Not in game");
        uint256 amount = p.monAmount;
        spaceLeft += amount;
        p.monAmount = 0;
        p.x = 0;
        p.y = 0;
        numPlayers--;
        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Withdraw failed");
        emit Leave(msg.sender, amount);
    }

    // View all active player addresses
    function getAllPlayers() external view returns (address[] memory) {
        // Create array of active players in a single pass
        address[] memory activePlayers = new address[](numPlayers);
        uint256 j = 0;
        for (uint256 i = 0; i < playerAddresses.length && j < numPlayers; i++) {
            if (players[playerAddresses[i]].monAmount > 0) {
                activePlayers[j] = playerAddresses[i];
                j++;
            }
        }
        return activePlayers;
    }
}