import { useState, useEffect } from "react";
import { useWeb3 } from "@/contexts/web3-context";
import { useDelegation } from "@/contexts/delegation-context";
import { CONTRACTS } from "@/lib/web3/config";

export function useAdminStatus() {
  const { wallet, getContract } = useWeb3();
  const { getActiveDelegations, delegations } = useDelegation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!wallet.isConnected || !wallet.address) {
      setIsAdmin(false);
      return;
    }

    checkAdminStatus();
  }, [wallet.isConnected, wallet.address, delegations.length]);

  const checkAdminStatus = async () => {
    setLoading(true);
    try {
      // Check if contract address is set
      if (!CONTRACTS.SECUREFLOW_ESCROW) {
        console.warn("SECUREFLOW_ESCROW contract address not set");
        setIsAdmin(false);
        return;
      }

      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW);
      if (!contract) {
        console.warn("Failed to get contract instance");
        setIsAdmin(false);
        return;
      }

      // Get the contract owner
      const owner = await contract.call("owner");
      console.log("Contract owner:", owner, typeof owner);
      console.log("Wallet address:", wallet.address, typeof wallet.address);

      if (!owner) {
        console.warn("Owner not found in contract");
        setIsAdmin(false);
        return;
      }

      // Normalize both addresses to strings and lowercase for comparison
      const ownerStr = String(owner).toLowerCase().trim();
      const walletStr = (wallet.address || "").toLowerCase().trim();

      console.log("Owner (normalized):", ownerStr);
      console.log("Wallet (normalized):", walletStr);

      // Check if current wallet is the owner
      const isOwner = ownerStr === walletStr;
      console.log("Is owner:", isOwner);

      // Also check if user has an active delegation granted TO their address
      const activeDelegations = getActiveDelegations();
      const hasDelegationForUser = activeDelegations.some(
        (d) => d.delegatee.toLowerCase() === wallet.address?.toLowerCase()
      );
      console.log("Has delegation:", hasDelegationForUser);

      setIsAdmin(isOwner || hasDelegationForUser);
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return { isAdmin, loading };
}
