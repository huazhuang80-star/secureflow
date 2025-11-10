import { useState, useEffect, useCallback } from "react";
import { useWeb3 } from "@/contexts/web3-context";
import { CONTRACTS } from "@/lib/web3/config";
import { ContractService } from "@/lib/web3/contract-service";

export function useJobCreatorStatus() {
  const { wallet, getContract } = useWeb3();
  const [isJobCreator, setIsJobCreator] = useState(false);
  const [loading, setLoading] = useState(true); // Start with true to show loading initially

  const checkJobCreatorStatus = useCallback(async () => {
    if (!wallet.isConnected || !wallet.address) {
      console.log(
        "⏸️ Job creator check skipped - wallet not connected or no address"
      );
      setIsJobCreator(false);
      setLoading(false);
      return;
    }

    console.log(
      `🔍 Checking job creator status for address: ${wallet.address}`
    );
    setLoading(true);
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW);
      if (!contract) {
        setIsJobCreator(false);
        setLoading(false);
        return;
      }

      // Check escrows directly using ContractService
      // Don't rely on getNextEscrowId() - it might fail or timeout
      const contractService = new ContractService(CONTRACTS.SECUREFLOW_ESCROW);
      console.log(
        `[useJobCreatorStatus] Checking escrows directly for wallet: ${wallet.address}`
      );

      // Check up to 20 escrows (reasonable limit)
      const maxEscrowsToCheck = 20;
      for (let i = 1; i <= maxEscrowsToCheck; i++) {
        try {
          console.log(`[useJobCreatorStatus] Checking escrow ${i}...`);
          const escrow = await contractService.getEscrow(i);

          // Skip if escrow doesn't exist
          if (!escrow) {
            console.log(`⏭️ Escrow ${i} does not exist`);
            // If we've checked a few escrows and none exist, stop checking
            if (i > 5) {
              break;
            }
            continue;
          }

          console.log(`📦 Escrow ${i} found:`, escrow);

          // Extract creator address from escrow
          // EscrowData has a 'creator' field
          const depositorAddress = escrow.creator;
          console.log(`📦 Escrow ${i} creator:`, depositorAddress);
          console.log(`📦 Wallet address:`, wallet.address);

          // Check if current user is the creator (job creator)
          const isMyJob =
            wallet.address &&
            depositorAddress &&
            depositorAddress.toLowerCase().trim() ===
              wallet.address.toLowerCase().trim();

          if (isMyJob) {
            console.log(`✅ User is job creator - found job ${i}`);
            setIsJobCreator(true);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error(
            `[useJobCreatorStatus] Error checking escrow ${i}:`,
            error
          );
          // If we get an error, it might mean the escrow doesn't exist
          // Stop checking after a few consecutive errors
          if (i > 5) {
            break;
          }
          continue;
        }
      }

      setIsJobCreator(false);
      console.log("❌ User is not a job creator - no matching escrows found");
    } catch (error) {
      console.error("Error checking job creator status:", error);
      setIsJobCreator(false);
    } finally {
      setLoading(false);
    }
  }, [wallet.isConnected, wallet.address]);

  useEffect(() => {
    checkJobCreatorStatus();
  }, [checkJobCreatorStatus]);

  return { isJobCreator, loading };
}
