#!/bin/bash

# SecureFlow Contract Deployment Script
# This script deploys the updated contract with rating and badge system

set -e

echo "🚀 SecureFlow Contract Deployment"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if WASM file exists
WASM_FILE="target/wasm32-unknown-unknown/release/secureflow.wasm"
if [ ! -f "$WASM_FILE" ]; then
    echo -e "${RED}❌ WASM file not found. Building contract...${NC}"
    cargo build --target wasm32-unknown-unknown --release
fi

echo -e "${GREEN}✅ Contract built successfully${NC}"
echo ""

# Check for Soroban CLI
if ! command -v soroban &> /dev/null; then
    echo -e "${RED}❌ Soroban CLI not found. Please install it first.${NC}"
    echo "Install from: https://soroban.stellar.org/docs/getting-started/setup"
    exit 1
fi

# Get network (default to testnet)
NETWORK=${1:-testnet}
echo -e "${YELLOW}📡 Deploying to: ${NETWORK}${NC}"
echo ""

# Check if source account is provided
if [ -z "$2" ]; then
    echo -e "${YELLOW}⚠️  No source account provided.${NC}"
    echo "Usage: ./deploy.sh [network] [source-account]"
    echo "Example: ./deploy.sh testnet GABCDEF..."
    echo ""
    echo "Please provide your Stellar account public key:"
    read -p "Source Account: " SOURCE_ACCOUNT
else
    SOURCE_ACCOUNT=$2
fi

echo ""
echo -e "${YELLOW}📦 Deploying contract...${NC}"
echo ""

# Deploy contract
DEPLOY_OUTPUT=$(soroban contract deploy \
    --wasm "$WASM_FILE" \
    --source "$SOURCE_ACCOUNT" \
    --network "$NETWORK" 2>&1)

# Extract contract ID from output
CONTRACT_ID=$(echo "$DEPLOY_OUTPUT" | grep -oP 'Contract ID: \K[^[:space:]]+' || echo "")

if [ -z "$CONTRACT_ID" ]; then
    echo -e "${RED}❌ Deployment failed or contract ID not found${NC}"
    echo "Output:"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

echo -e "${GREEN}✅ Contract deployed successfully!${NC}"
echo ""
echo -e "${GREEN}📝 Contract ID: ${CONTRACT_ID}${NC}"
echo ""

# Save contract ID to file
echo "$CONTRACT_ID" > .contract-id
echo "Contract ID saved to .contract-id"

echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Update your .env file with:"
echo "   VITE_SECUREFLOW_CONTRACT_ID=$CONTRACT_ID"
echo ""
echo "2. Or update src/lib/web3/stellar-config.ts with:"
echo "   DEFAULT_CONTRACT_ID=\"$CONTRACT_ID\""
echo ""
echo "3. Rebuild frontend:"
echo "   npm run build"
echo ""
echo -e "${GREEN}✨ Deployment complete!${NC}"
