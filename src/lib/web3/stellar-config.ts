// Stellar Network Configuration
export const STELLAR_NETWORKS = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org:443",
    horizonUrl: "https://horizon-testnet.stellar.org",
  },
  mainnet: {
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    rpcUrl: "https://soroban-mainnet.stellar.org:443",
    horizonUrl: "https://horizon.stellar.org",
  },
  local: {
    networkPassphrase: "Standalone Network ; February 2017",
    rpcUrl: "http://localhost:8000/soroban/rpc",
    horizonUrl: "http://localhost:8000",
  },
};

// Contract IDs (will be set after deployment)
// Fallback to the deployed contract ID if env variable is not set
// Testnet contract ID (deployed on testnet) - Updated with token transfer support
const DEFAULT_CONTRACT_ID =
  "CDY5RKZP4NAAWVSTJEL2G4NPHD2PXOX4DHIRYBGKY7JA5KESQX7VYKIO";

export const CONTRACTS = {
  SECUREFLOW_ESCROW:
    import.meta.env.VITE_SECUREFLOW_CONTRACT_ID || DEFAULT_CONTRACT_ID,
};

// Get current network from environment
export const getCurrentNetwork = () => {
  const env = import.meta.env.VITE_STELLAR_NETWORK || "testnet";
  return (
    STELLAR_NETWORKS[env as keyof typeof STELLAR_NETWORKS] ||
    STELLAR_NETWORKS.testnet
  );
};

// Native XLM SAC (Stellar Asset Contract) addresses
// These are the contract addresses for the native XLM asset contract on each network
export const NATIVE_XLM_SAC_ADDRESSES = {
  testnet: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", // Native XLM SAC on testnet
  mainnet: "", // TODO: Add mainnet SAC address when available
  local: "", // TODO: Add local SAC address when available
};

// Get native XLM SAC address for current network
export const getNativeXLMSACAddress = () => {
  const env = import.meta.env.VITE_STELLAR_NETWORK || "testnet";
  return (
    NATIVE_XLM_SAC_ADDRESSES[env as keyof typeof NATIVE_XLM_SAC_ADDRESSES] ||
    NATIVE_XLM_SAC_ADDRESSES.testnet
  );
};
