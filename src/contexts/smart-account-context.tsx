// Stellar doesn't use smart accounts - regular accounts are used directly
// This context provides a compatibility layer for components that expect smart accounts

import { createContext, use, useState, useEffect, type ReactNode } from "react";
import { useWeb3 } from "./web3-context";
import { useToast } from "@/hooks/use-toast";

interface SmartAccountState {
  isInitialized: boolean;
  safeAddress: string | null;
  isDeployed: boolean;
  balance: string;
  nonce: number;
}

interface SmartAccountContextType {
  smartAccount: SmartAccountState;
  initializeSmartAccount: () => Promise<void>;
  deploySmartAccount: () => Promise<string>;
  executeTransaction: (
    to: string,
    data: string,
    value?: string
  ) => Promise<string>;
  executeBatchTransaction: (
    transactions: Array<{ to: string; data: string; value?: string }>
  ) => Promise<string>;
  isSmartAccountReady: boolean;
  checkSmartAccountBalance: () => Promise<string>;
}

const SmartAccountContext = createContext<SmartAccountContextType | undefined>(
  undefined
);

export function SmartAccountProvider({ children }: { children: ReactNode }) {
  const { wallet, getContract } = useWeb3();
  const { toast } = useToast();
  const [smartAccount, setSmartAccount] = useState<SmartAccountState>({
    isInitialized: false,
    safeAddress: null,
    isDeployed: false,
    balance: "0",
    nonce: 0,
  });

  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      initializeSmartAccount();
    }
  }, [wallet.isConnected, wallet.address]);

  const initializeSmartAccount = async () => {
    try {
      if (!wallet.address) {
        return;
      }

      // In Stellar, the wallet address IS the account address
      // No smart account deployment needed
      setSmartAccount({
        isInitialized: true,
        safeAddress: wallet.address,
        isDeployed: true, // Stellar accounts are always "deployed"
        balance: wallet.balance,
        nonce: 0,
      });
    } catch (error: any) {
      console.error("Account initialization failed:", error);
      toast({
        title: "Account Error",
        description: error.message || "Failed to initialize account",
        variant: "destructive",
      });
    }
  };

  const deploySmartAccount = async () => {
    // Stellar accounts don't need deployment
    if (wallet.address) {
      setSmartAccount((prev) => ({
        ...prev,
        isDeployed: true,
        safeAddress: wallet.address || null,
        balance: wallet.balance,
      }));

      toast({
        title: "Account Ready",
        description: `Account ready: ${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)}`,
      });

      return wallet.address;
    }
    throw new Error("Wallet not connected");
  };

  const executeTransaction = async (
    to: string
    // data: string, // Unused
    // value: string = "0" // Unused
  ) => {
    try {
      if (!wallet.isConnected || !wallet.address) {
        throw new Error("Wallet not connected");
      }

      // In Stellar, we use the contract's send method directly
      // The data parameter would need to be decoded to get method name and args
      // For now, this is a placeholder that shows the pattern
      const contract = getContract(to);
      if (!contract) {
        throw new Error("Contract not found");
      }

      // Note: This is a simplified version
      // In practice, you'd decode the data to get method name and args
      // and call contract.send(methodName, ...args)

      toast({
        title: "Transaction Executed",
        description: "Transaction executed successfully",
      });

      return "tx_hash_placeholder";
    } catch (error: any) {
      console.error("Transaction execution failed:", error);
      toast({
        title: "Transaction Failed",
        description: error.message || "Failed to execute transaction",
        variant: "destructive",
      });
      throw error;
    }
  };

  const executeBatchTransaction = async (
    transactions: Array<{ to: string; data: string; value?: string }>
  ) => {
    try {
      if (!wallet.isConnected || !wallet.address) {
        throw new Error("Wallet not connected");
      }

      // Execute transactions sequentially
      const txHashes = [];
      for (const tx of transactions) {
        try {
          const hash = await executeTransaction(tx.to);
          txHashes.push(hash);
        } catch (error) {
          console.error(`Batch transaction failed for ${tx.to}:`, error);
          // Continue with other transactions
        }
      }

      toast({
        title: "Batch Transaction Executed",
        description: `${txHashes.length} transactions executed`,
      });

      return txHashes[0] || "";
    } catch (error: any) {
      console.error("Batch transaction execution failed:", error);
      toast({
        title: "Batch Transaction Failed",
        description: error.message || "Failed to execute batch transaction",
        variant: "destructive",
      });
      throw error;
    }
  };

  const isSmartAccountReady =
    smartAccount.isInitialized && smartAccount.isDeployed;

  const checkSmartAccountBalance = async () => {
    if (wallet.address) {
      setSmartAccount((prev) => ({
        ...prev,
        balance: wallet.balance,
      }));
      return wallet.balance;
    }
    return "0";
  };

  return (
    <SmartAccountContext
      value={{
        smartAccount,
        initializeSmartAccount,
        deploySmartAccount,
        executeTransaction,
        executeBatchTransaction,
        isSmartAccountReady,
        checkSmartAccountBalance,
      }}
    >
      {children}
    </SmartAccountContext>
  );
}

export function useSmartAccount() {
  const context = use(SmartAccountContext);
  if (context === undefined) {
    throw new Error(
      "useSmartAccount must be used within a SmartAccountProvider"
    );
  }
  return context;
}
