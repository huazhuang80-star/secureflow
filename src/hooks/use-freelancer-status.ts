import { useState, useEffect, useCallback } from "react";
import { useWeb3 } from "@/contexts/web3-context";
import { CONTRACTS } from "@/lib/web3/config";

export function useFreelancerStatus() {
  const { wallet } = useWeb3();
  const [isFreelancer, setIsFreelancer] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkFreelancerStatus = useCallback(async () => {
    if (!wallet.isConnected || !wallet.address) {
      console.log(
        "⏸️ Freelancer check skipped - wallet not connected or no address"
      );
      setIsFreelancer(false);
      setLoading(false);
      return;
    }

    console.log(`🔍 Checking freelancer status for address: ${wallet.address}`);
    setLoading(true);
    try {
      // Use ContractService instead of contract.call - it reads from blockchain
      const { ContractService } = await import("@/lib/web3/contract-service");
      const contractService = new ContractService(CONTRACTS.SECUREFLOW_ESCROW);

      // Get next escrow ID from blockchain (not hardcoded)
      const nextEscrowId = await contractService.getNextEscrowId();
      console.log(
        `[useFreelancerStatus] next_escrow_id from blockchain: ${nextEscrowId}`
      );

      // Check if current wallet is beneficiary of any escrow
      const maxEscrowsToCheck = Math.min(nextEscrowId - 1, 20);
      for (let i = 1; i <= maxEscrowsToCheck; i++) {
        try {
          console.log(`[useFreelancerStatus] Checking escrow ${i}...`);
          const escrow = await contractService.getEscrow(i);

          if (!escrow) {
            console.log(`⏭️ Escrow ${i} does not exist`);
            if (i > 5) {
              // Stop checking after a few non-existent escrows
              break;
            }
            continue;
          }

          console.log(`📦 Escrow ${i} found:`, escrow);

          // Check if current user is the beneficiary (freelancer)
          const isBeneficiary =
            escrow.freelancer &&
            escrow.freelancer.toLowerCase().trim() ===
              wallet.address.toLowerCase().trim();

          console.log(
            `📦 Escrow ${i} freelancer: ${escrow.freelancer}, isBeneficiary: ${isBeneficiary}`
          );

          if (isBeneficiary) {
            console.log(`✅ User is freelancer - found escrow ${i}`);
            setIsFreelancer(true);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error(
            `[useFreelancerStatus] Error checking escrow ${i}:`,
            error
          );
          if (i > 5) {
            break;
          }
          continue;
        }
      }

      setIsFreelancer(false);
      console.log("❌ User is not a freelancer - no matching escrows found");
    } catch (error) {
      console.error("Error checking freelancer status:", error);
      setIsFreelancer(false);
    } finally {
      setLoading(false);
    }
  }, [wallet.isConnected, wallet.address]);

  useEffect(() => {
    checkFreelancerStatus();
  }, [checkFreelancerStatus]);

  return { isFreelancer, loading };
}
