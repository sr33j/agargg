#!/bin/bash

# Load environment variables
source .env

# Deploy AgarGameFactory
echo "Deploying AgarGameFactory to Monad testnet..."
forge script script/Deploy.s.sol:Deploy --rpc-url https://testnet-rpc.monad.xyz --broadcast -vvv

# Get the deployed address from broadcast logs
DEPLOYED_ADDRESS=$(cat broadcast/Deploy.s.sol/10143/run-latest.json | jq -r '.receipts[0].contractAddress')
echo "AgarGameFactory deployed at: $DEPLOYED_ADDRESS"

# Verify on explorer if API key is provided
if [ ! -z "$ETHERSCAN_API_KEY" ]; then
    echo "Verifying contract on explorer..."
    forge verify-contract $DEPLOYED_ADDRESS src/AgarGameFactory.sol:AgarGameFactory \
        --chain-id 10143 \
        --etherscan-api-key $ETHERSCAN_API_KEY \
        --verifier-url https://explorer.testnet.monad.xyz/api
fi
