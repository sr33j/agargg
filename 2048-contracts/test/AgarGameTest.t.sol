// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "lib/forge-std/src/Test.sol";
import {AgarGame, Direction} from "src/AgarGame.sol";

contract AgarGameTest is Test {
    AgarGame game;
    address player1;
    address player2;
    address player3;
    address paymaster = address(0xBEEF);
    uint256 boardWidth = 1000 ether;
    uint256 boardHeight = 1000 ether;
    uint256 minMon = 1 ether;
    uint256 moveFee = .05 ether;
    uint256 velocityMin = 1 ether;
    uint256 velocityMax = 2 ether;
    uint256 maxPlayers = 10;
    uint256 boardCoverageFactor = 2;

    function setUp() public {
        game = new AgarGame(
            boardCoverageFactor,
            velocityMin,
            velocityMax,
            boardHeight,
            boardWidth,
            maxPlayers,
            minMon,
            moveFee,
            paymaster
        );
        player1 = address(0x1);
        player2 = address(0x2);
        player3 = address(0x3);
        vm.deal(player1, 1000 ether);
        vm.deal(player2, 1000 ether);
        vm.deal(player3, 1000 ether);
        vm.deal(paymaster, 0);
    }

    function _sumMonAmounts() internal view returns (uint256 sum) {
        address[] memory addrs = game.getAllPlayers();
        for (uint256 i = 0; i < addrs.length; i++) {
            (uint256 monAmount,,) = game.players(addrs[i]);
            sum += monAmount;
        }
    }

    function _assertInvariant() internal view {
        uint256 sum = _sumMonAmounts();
        assertEq(game.spaceLeft() + sum, boardWidth * boardHeight, "Invariant failed");
    }

    function testEnterAndInvariant() public {
        // Enter player1
        uint256 mon1 = 10 ether;
        uint256 x1 = 100 ether;
        uint256 y1 = 100 ether;
        vm.prank(player1);
        game.enter{value: mon1}(mon1, x1, y1);
        _assertInvariant();
        // Enter player2
        uint256 mon2 = 5 ether;
        uint256 x2 = 300 ether;
        uint256 y2 = 300 ether;
        vm.prank(player2);
        game.enter{value: mon2}(mon2, x2, y2);
        _assertInvariant();
    }

    function testCollisionAndNumPlayersDecrease() public {
        // Enter two players close enough to collide after move
        uint256 mon1 = 10 ether;
        uint256 mon2 = 5 ether;
        uint256 x1 = 100 ether;
        uint256 y1 = 100 ether;
        uint256 x2 = 105 ether;
        uint256 y2 = 100 ether;
        vm.prank(player1);
        game.enter{value: mon1}(mon1, x1, y1);
        vm.prank(player2);
        game.enter{value: mon2}(mon2, x2, y2);
        _assertInvariant();
        // Move player2 left into player1
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(player2);
            game.move(Direction.LEFT);
            emit log_named_uint("====================", i);
            (uint256 p2MonAmount, uint256 p2X, uint256 p2Y) = game.players(player2);
            (uint256 p1MonAmount, uint256 p1X, uint256 p1Y) = game.players(player1);
            emit log_named_uint("Player2 x", p2X);
            emit log_named_uint("Player1 x", p1X); 
            emit log_named_uint("Player2 y", p2Y);
            emit log_named_uint("Player1 y", p1Y);
            emit log_named_uint("Player2 radius", game.getRadius(p2MonAmount));
            emit log_named_uint("Player1 radius", game.getRadius(p1MonAmount));
        }

        // After collision, player1 should have all mon, player2 should have 0, numPlayers decrease
        (uint256 p1Mon,,) = game.players(player1);
        (uint256 p2Mon,,) = game.players(player2);
        assertEq(p2Mon, 0, "Player2 should have 0 mon");
        assertEq(p1Mon, mon1 + (mon2 - moveFee * 3), "Player1 should absorb player2's mon minus move fees");
        assertEq(game.numPlayers(), 1, "numPlayers should decrease by 1");
        _assertInvariant();
    }

    function testCannotGoThroughWall() public {
        // Enter player1 near the top wall
        uint256 mon1 = 10 ether;
        uint256 x1 = 100 ether;
        uint256 y1 = game.getRadius(mon1); // right at the top
        vm.prank(player1);
        game.enter{value: mon1}(mon1, x1, y1);
        _assertInvariant();
        // Try to move UP (should revert)
        vm.prank(player1);
        vm.expectRevert();
        game.move(Direction.UP);
        // Try to move LEFT past wall
        uint256 x2 = game.getRadius(mon1);
        uint256 y2 = 200 ether;
        vm.prank(player2);
        game.enter{value: mon1}(mon1, x2, y2);
        _assertInvariant();
        vm.prank(player2);
        vm.expectRevert();
        game.move(Direction.LEFT);
        // Try to move DOWN past wall
        uint256 x3 = 200 ether;
        uint256 y3 = boardHeight - game.getRadius(mon1);
        vm.prank(player3);
        game.enter{value: mon1}(mon1, x3, y3);
        _assertInvariant();
        vm.prank(player3);
        vm.expectRevert();
        game.move(Direction.DOWN);
        // Try to move RIGHT past wall
        uint256 x4 = boardWidth - game.getRadius(mon1);
        uint256 y4 = 200 ether;
        address player4 = address(0x4);
        vm.deal(player4, 1000 ether);
        vm.prank(player4);
        game.enter{value: mon1}(mon1, x4, y4);
        _assertInvariant();
        vm.prank(player4);
        vm.expectRevert();
        game.move(Direction.RIGHT);
    }
} 