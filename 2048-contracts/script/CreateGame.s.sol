// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgarGameFactory.sol";

contract CreateGameScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address factoryAddress = 0x3b6D975Bbd153D78581b0e28F27F4EEdBf1393bB;
        
        vm.startBroadcast(deployerPrivateKey);
        
        AgarGameFactory factory = AgarGameFactory(factoryAddress);
        
        address newGame = factory.createGame(
            4,                                      // _boardCoverageFactor
            500000000,                              // _velocityMin
            2000000000,                             // _velocityMax
            16000000000,                            // _boardHeight
            16000000000,                            // _boardWidth
            32,                                     // _maxNumPlayers
            0,                                      // _minMonAmount
            1000000000000000,                       // _moveFee
            0x04693A76457EEe3a0b87e5c72f5BdF720874a3C2  // _paymaster
        );
        
        vm.stopBroadcast();
        
        console.log("New game created at:", newGame);
    }
}