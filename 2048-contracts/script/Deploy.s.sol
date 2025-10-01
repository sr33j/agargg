// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.28 <0.9.0;

// Base
import {Script} from "lib/forge-std/src/Script.sol";
import {StdUtils} from "lib/forge-std/src/StdUtils.sol";

// Targets
import {AgarGameFactory} from "src/AgarGameFactory.sol";
contract Deploy is StdUtils, Script {
    uint256 internal deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

    function run() public returns (address gameFactoryContract) {
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployer);
        gameFactoryContract = address(new AgarGameFactory());
        vm.stopBroadcast();
    }
}
