#!/bin/bash
echo "Installing Soroban CLI..."
echo ""

# Check if cargo is available
if ! command -v cargo &> /dev/null; then
    echo "❌ Cargo not found. Please install Rust first:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

echo "📦 Installing via Cargo..."
cargo install --locked soroban-cli

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Soroban CLI installed successfully!"
    echo ""
    echo "Verify installation:"
    echo "   soroban --version"
    echo ""
    echo "Next step: Deploy the contract"
    echo "   ./deploy.sh testnet YOUR_ACCOUNT"
else
    echo ""
    echo "❌ Installation failed. Try manual installation:"
    echo "   https://github.com/stellar/soroban-tools/releases"
fi
