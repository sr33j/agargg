// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AgarGame.sol";

contract AgarGameFactory {
    address[] public games;

    event GameCreated(address indexed gameAddress);

    function createGame(
        uint256 _boardCoverageFactor,
        uint256 _velocityMin,
        uint256 _velocityMax,
        uint256 _boardHeight,
        uint256 _boardWidth,
        uint256 _maxNumPlayers,
        uint256 _minMonAmount,
        uint256 _moveFee,
        address _paymaster
    ) external returns (address) {
        AgarGame game = new AgarGame(
            _boardCoverageFactor,
            _velocityMin,
            _velocityMax,
            _boardHeight,
            _boardWidth,
            _maxNumPlayers,
            _minMonAmount,
            _moveFee,
            _paymaster
        );
        games.push(address(game));
        emit GameCreated(address(game));
        return address(game);
    }

    function getAllGames() external view returns (address[] memory) {
        return games;
    }
}
