import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { getCurrentNetwork } from "@/lib/web3/stellar-config";
import type { WalletState } from "@/lib/web3/types";
import { useToast } from "@/hooks/use-toast";
import {
  Contract,
  rpc,
  Address,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
import {
  wallet,
  connectWallet as connectWalletUtil,
  disconnectWallet as disconnectWalletUtil,
} from "@/util/wallet";
import storage from "@/util/storage";
import { Client as SecureFlowClient } from "@/contracts/generated/src/index";

interface Web3ContextType {
  wallet: WalletState;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: (network: "testnet" | "mainnet" | "local") => Promise<void>;
  getContract: (contractId: string) => any;
  isOwner: boolean;
  network: ReturnType<typeof getCurrentNetwork>;
  refreshBalance: () => Promise<void>;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function Web3Provider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [walletState, setWalletState] = useState<WalletState>({
    address: null,
    chainId: null,
    isConnected: false,
    balance: "0",
  });
  const [isOwner, setIsOwner] = useState(false);
  const network = getCurrentNetwork();

  // Lazy initialization of RPC server to avoid undefined errors
  const getRpcServer = useMemo(() => {
    if (!rpc || !rpc.Server) {
      console.error(
        "rpc.Server is not available. Please check @stellar/stellar-sdk installation."
      );
      return null;
    }
    return () => new rpc.Server(network.rpcUrl);
  }, [network.rpcUrl]);

  const createRpcServer = () => {
    if (!getRpcServer) {
      throw new Error(
        "rpc.Server is not available. Please check @stellar/stellar-sdk installation."
      );
    }
    return getRpcServer();
  };

  useEffect(() => {
    checkConnection();

    // Check connection periodically
    const interval = setInterval(() => {
      if (!walletState.isConnected) {
        checkConnection();
      }
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const checkConnection = async () => {
    try {
      const walletId = storage.getItem("walletId");
      const walletAddr = storage.getItem("walletAddress");

      if (walletId && walletAddr) {
        try {
          wallet.setWallet(walletId);
          const addressResult = await wallet.getAddress();
          const publicKey = addressResult.address;

          if (publicKey) {
            // Get balance from Horizon API (more reliable than RPC)
            try {
              const { Horizon } = await import("@stellar/stellar-sdk");
              const horizonUrl =
                network.horizonUrl || "https://horizon-testnet.stellar.org";
              const horizon = new Horizon.Server(horizonUrl);

              const account = await horizon
                .accounts()
                .accountId(publicKey)
                .call();
              const nativeBalance = account.balances.find(
                (b: any) => b.asset_type === "native"
              );

              setWalletState({
                address: publicKey,
                chainId: null, // Stellar doesn't use chain IDs
                isConnected: true,
                balance: nativeBalance
                  ? parseFloat(nativeBalance.balance).toFixed(4)
                  : "0",
              });

              await checkOwnerStatus(publicKey);
            } catch (error: any) {
              console.error("Error fetching balance:", error);
              // If account doesn't exist yet, still set connected
              setWalletState({
                address: publicKey,
                chainId: null,
                isConnected: true,
                balance: "0",
              });
              await checkOwnerStatus(publicKey);
            }
          }
        } catch (error) {
          // Wallet not connected
          console.log("Wallet not connected");
        }
      }
    } catch (error) {
      // Wallet not available or not connected
      console.log("Wallet not connected");
    }
  };

  const checkOwnerStatus = async (address: string) => {
    try {
      // Check if address matches known owner
      // This should be set from environment or contract
      const knownOwner = import.meta.env.VITE_OWNER_ADDRESS || "";
      setIsOwner(address === knownOwner);
    } catch (error) {
      setIsOwner(false);
    }
  };

  const connectWallet = async () => {
    try {
      // Use Stellar Wallets Kit to connect
      await connectWalletUtil();

      // Wait a bit for storage to update
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check connection
      const walletId = storage.getItem("walletId");
      const walletAddr = storage.getItem("walletAddress");

      if (walletId && walletAddr) {
        wallet.setWallet(walletId);
        const addressResult = await wallet.getAddress();
        const publicKey = addressResult.address;

        if (!publicKey) {
          toast({
            title: "Connection failed",
            description: "Could not get wallet address",
            variant: "destructive",
          });
          return;
        }

        // Get balance from Horizon API (more reliable than RPC)
        try {
          const { Horizon } = await import("@stellar/stellar-sdk");
          const horizonUrl =
            network.horizonUrl || "https://horizon-testnet.stellar.org";
          const horizon = new Horizon.Server(horizonUrl);

          const account = await horizon.accounts().accountId(publicKey).call();
          const nativeBalance = account.balances.find(
            (b: any) => b.asset_type === "native"
          );

          setWalletState({
            address: publicKey,
            chainId: null,
            isConnected: true,
            balance: nativeBalance
              ? parseFloat(nativeBalance.balance).toFixed(4)
              : "0",
          });

          await checkOwnerStatus(publicKey);

          toast({
            title: "Wallet connected",
            description: `Connected to ${publicKey.slice(
              0,
              6
            )}...${publicKey.slice(-4)}`,
          });
        } catch (error: any) {
          console.error("Error fetching balance:", error);
          // Account might not exist yet
          setWalletState({
            address: publicKey,
            chainId: null,
            isConnected: true,
            balance: "0",
          });
          await checkOwnerStatus(publicKey);

          toast({
            title: "Wallet connected",
            description: `Connected to ${publicKey.slice(
              0,
              6
            )}...${publicKey.slice(-4)}`,
          });
        }
      } else {
        toast({
          title: "Connection cancelled",
          description: "Please connect your wallet to continue",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Connection failed",
        description:
          error.message ||
          "Failed to connect wallet. Please install a Stellar wallet.",
        variant: "destructive",
      });
    }
  };

  const disconnectWallet = async () => {
    await disconnectWalletUtil();
    setWalletState({
      address: null,
      chainId: null,
      isConnected: false,
      balance: "0",
    });
    setIsOwner(false);
    toast({
      title: "Wallet disconnected",
      description: "Your wallet has been disconnected",
    });
  };

  const switchNetwork = async (
    targetNetwork: "testnet" | "mainnet" | "local"
  ) => {
    // Stellar networks are handled via environment variables
    // This is mainly for UI feedback
    toast({
      title: "Network switch",
      description: `Switching to ${targetNetwork}. Please update VITE_STELLAR_NETWORK in .env`,
    });
  };

  const getContract = (contractId: string) => {
    if (!contractId) {
      console.error("Contract ID is required");
      return null;
    }

    // Use the generated contract client for type-safe contract interactions
    const client = new SecureFlowClient({
      contractId,
      networkPassphrase: network.networkPassphrase,
      rpcUrl: network.rpcUrl,
    });

    // Return a wrapper that provides both the generated client and a compatible interface
    return {
      // Generated client with all typed methods
      client,

      // Legacy call interface for backward compatibility
      async call(method: string, ...args: any[]) {
        try {
          // Use the generated client's methods for read operations
          if (method === "get_escrow" && args[0] !== undefined) {
            const assembledTx = await client.get_escrow({ escrow_id: args[0] });
            // The client automatically simulates, so we can access the result directly
            return assembledTx.result;
          }

          if (method === "get_user_escrows" && args[0] !== undefined) {
            const assembledTx = await client.get_user_escrows({
              user: args[0],
            });
            return assembledTx.result;
          }

          if (method === "get_reputation" && args[0] !== undefined) {
            const assembledTx = await client.get_reputation({ user: args[0] });
            return assembledTx.result;
          }

          if (method === "paused") {
            // Check if contract is paused (this might need to be added to the contract)
            return false;
          }

          // Fallback for methods not in the map
          console.warn(
            `Method ${method} not found in generated client, using fallback`
          );
          const contract = new Contract(contractId);
          const server = createRpcServer();

          const methodArgs = args.map((arg) => {
            if (typeof arg === "string") {
              try {
                return Address.fromString(arg).toScVal();
              } catch {
                return nativeToScVal(arg, { type: "string" });
              }
            } else if (typeof arg === "number") {
              return nativeToScVal(arg, { type: "i128" });
            } else if (typeof arg === "boolean") {
              return nativeToScVal(arg, { type: "bool" });
            }
            return nativeToScVal(arg);
          });

          const result = await server.simulateTransaction(
            contract.call(method, ...methodArgs)
          );

          if (result.errorResult) {
            throw new Error(result.errorResult.value().toString());
          }

          if (result.returnValue) {
            try {
              return scValToNative(result.returnValue);
            } catch {
              return result.returnValue;
            }
          }

          return result;
        } catch (error) {
          console.error(`Error calling ${method}:`, error);
          throw error;
        }
      },

      // Legacy send interface for backward compatibility
      async send(method: string, ...args: any[]) {
        try {
          if (!walletState.isConnected || !walletState.address) {
            throw new Error("Wallet not connected");
          }

          // Use the generated client's methods for sending transactions
          let assembledTx: any;

          if (method === "create_escrow" && args[0]) {
            assembledTx = await client.create_escrow(args[0]);
          } else if (method === "start_work" && args[0]) {
            assembledTx = await client.start_work(args[0]);
          } else if (method === "submit_milestone" && args[0]) {
            assembledTx = await client.submit_milestone(args[0]);
          } else if (method === "approve_milestone" && args[0]) {
            assembledTx = await client.approve_milestone(args[0]);
          } else if (method === "apply_to_job" && args[0]) {
            assembledTx = await client.apply_to_job(args[0]);
          } else if (method === "accept_freelancer" && args[0]) {
            assembledTx = await client.accept_freelancer(args[0]);
          } else if (method === "refund_escrow" && args[0]) {
            assembledTx = await client.refund_escrow(args[0]);
          } else if (method === "emergency_refund_after_deadline" && args[0]) {
            assembledTx = await client.emergency_refund_after_deadline(args[0]);
          } else if (method === "extend_deadline" && args[0]) {
            assembledTx = await client.extend_deadline(args[0]);
          } else if (method === "set_platform_fee_bp" && args[0]) {
            assembledTx = await client.set_platform_fee_bp(args[0]);
          } else if (method === "set_fee_collector" && args[0]) {
            assembledTx = await client.set_fee_collector(args[0]);
          } else if (method === "whitelist_token" && args[0]) {
            assembledTx = await client.whitelist_token(args[0]);
          } else if (method === "authorize_arbiter" && args[0]) {
            assembledTx = await client.authorize_arbiter(args[0]);
          } else {
            throw new Error(
              `Method ${method} not supported in generated client`
            );
          }

          // Sign the transaction
          const xdr = assembledTx.toXDR();
          const signResult = await wallet.signTransaction(xdr, {
            address: walletState.address,
            networkPassphrase: network.networkPassphrase,
          });

          if (!signResult.signedTxXdr) {
            throw new Error("Transaction signing failed");
          }

          // Send the signed transaction
          const result = await assembledTx.signAndSend(signResult.signedTxXdr);
          return result.hash;
        } catch (error: any) {
          console.error(`Error sending ${method}:`, error);
          throw error;
        }
      },

      async owner() {
        // Return owner address if available
        return import.meta.env.VITE_OWNER_ADDRESS || "";
      },
    };
  };

  const refreshBalance = async () => {
    if (!walletState.isConnected || !walletState.address) {
      return;
    }

    try {
      const { Horizon } = await import("@stellar/stellar-sdk");
      const horizonUrl =
        network.horizonUrl || "https://horizon-testnet.stellar.org";
      const horizon = new Horizon.Server(horizonUrl);

      const account = await horizon
        .accounts()
        .accountId(walletState.address)
        .call();
      const nativeBalance = account.balances.find(
        (b: any) => b.asset_type === "native"
      );

      setWalletState((prev) => ({
        ...prev,
        balance: nativeBalance
          ? parseFloat(nativeBalance.balance).toFixed(4)
          : "0",
      }));
    } catch (error) {
      console.error("Error refreshing balance:", error);
    }
  };

  return (
    <Web3Context.Provider
      value={{
        wallet: walletState,
        connectWallet,
        disconnectWallet,
        switchNetwork,
        getContract,
        isOwner,
        network,
        refreshBalance,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
}
