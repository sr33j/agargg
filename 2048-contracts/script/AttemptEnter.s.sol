pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgarGameFactory.sol";
import "../src/AgarGame.sol";

contract AttemptEnterScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address gameAddress = 0x1C828fB06c126AC4CCDcfB0b1cE8b08B63dd7b9E;
        
        vm.startBroadcast(deployerPrivateKey);
        
        AgarGame game = AgarGame(gameAddress);
        
        // Test both timestamp and block number to see which one the deployed contract expects
        uint256 currentBlock = block.number;
        uint256 currentTimestamp = block.timestamp;
        
        console.log("Current block number:", currentBlock);
        console.log("Current timestamp:", currentTimestamp);
        
        // Try with a very large timestamp deadline first
        uint256 timestampDeadline = currentTimestamp + 3600; // 1 hour from now
        console.log("Trying timestamp deadline:", timestampDeadline);
        
        try game.enter{value: 2000000000000000}(2000000000000000, 8000000000, 8000000000, timestampDeadline) {
            console.log("SUCCESS: Contract expects timestamp deadlines");
        } catch {
            console.log("FAILED with timestamp, trying block number...");
            
            // If timestamp fails, try with block number
            uint256 blockDeadline = currentBlock + 1000; // 1000 blocks from now
            console.log("Trying block deadline:", blockDeadline);
            
            game.enter{value: 2000000000000000}(2000000000000000, 8000000000, 8000000000, blockDeadline);
            console.log("SUCCESS: Contract expects block number deadlines");
        }
        
        vm.stopBroadcast();
        
        console.log("Enter successful");
    }
}