/**
 * Hook for escrow actions
 * Combines multiple escrow operations into a single hook
 * Following the pattern from Pacto P2P
 */

import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import {
  useCreateEscrow,
  useStartWork,
  useSubmitMilestone,
  useApproveMilestone,
  useRefundEscrow,
  useApplyToJob,
  useAcceptFreelancer,
  useExtendDeadline,
  useEmergencyRefund,
} from "./use-escrows";
// import type { EscrowData } from "@/lib/web3/contract-service"; // Unused
import useWalletStore from "@/store/wallet.store";

export function useEscrowActions() {
  const [isLoading, setIsLoading] = useState(false);
  const { address } = useWalletStore();
  const createEscrow = useCreateEscrow();
  const startWork = useStartWork();
  const submitMilestone = useSubmitMilestone();
  const approveMilestone = useApproveMilestone();
  const refundEscrow = useRefundEscrow();
  const applyToJob = useApplyToJob();
  const acceptFreelancer = useAcceptFreelancer();
  const extendDeadline = useExtendDeadline();
  const emergencyRefund = useEmergencyRefund();

  const handleCreateEscrow = async (params: {
    beneficiary?: string;
    arbiters: string[];
    required_confirmations: number;
    milestones: Array<[string, string]>; // [amount, description]
    token?: string;
    total_amount: string;
    duration: number; // in seconds
    project_title: string;
    project_description: string;
  }) => {
    setIsLoading(true);
    try {
      if (!address) {
        throw new Error("Wallet not connected");
      }
      await createEscrow.mutateAsync({
        ...params,
        depositor: address,
      });
      return true;
    } catch (error) {
      console.error("Error creating escrow:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartWork = async (escrowId: number) => {
    if (!address) {
      toast({
        title: "Error",
        description: "Wallet not connected",
        variant: "destructive",
      });
      return false;
    }
    setIsLoading(true);
    try {
      await startWork.mutateAsync(escrowId);
      return true;
    } catch (error) {
      console.error("Error starting work:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitMilestone = async (params: {
    escrow_id: number;
    milestone_index: number;
    description: string;
  }) => {
    setIsLoading(true);
    try {
      await submitMilestone.mutateAsync(params);
      return true;
    } catch (error) {
      console.error("Error submitting milestone:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveMilestone = async (params: {
    escrow_id: number;
    milestone_index: number;
  }) => {
    setIsLoading(true);
    try {
      await approveMilestone.mutateAsync(params);
      return true;
    } catch (error) {
      console.error("Error approving milestone:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefundEscrow = async (escrowId: number) => {
    setIsLoading(true);
    try {
      await refundEscrow.mutateAsync(escrowId);
      return true;
    } catch (error) {
      console.error("Error refunding escrow:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyToJob = async (params: {
    escrow_id: number;
    cover_letter: string;
    proposed_timeline: number;
  }) => {
    setIsLoading(true);
    try {
      await applyToJob.mutateAsync(params);
      return true;
    } catch (error) {
      console.error("Error applying to job:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptFreelancer = async (params: {
    escrow_id: number;
    freelancer: string;
  }) => {
    setIsLoading(true);
    try {
      await acceptFreelancer.mutateAsync(params);
      return true;
    } catch (error) {
      console.error("Error accepting freelancer:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtendDeadline = async (params: {
    escrow_id: number;
    extra_seconds: number;
  }) => {
    setIsLoading(true);
    try {
      await extendDeadline.mutateAsync(params);
      return true;
    } catch (error) {
      console.error("Error extending deadline:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmergencyRefund = async (escrowId: number) => {
    setIsLoading(true);
    try {
      await emergencyRefund.mutateAsync(escrowId);
      return true;
    } catch (error) {
      console.error("Error emergency refunding:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // State
    isLoading,

    // Actions
    handleCreateEscrow,
    handleStartWork,
    handleSubmitMilestone,
    handleApproveMilestone,
    handleRefundEscrow,
    handleApplyToJob,
    handleAcceptFreelancer,
    handleExtendDeadline,
    handleEmergencyRefund,
  };
}
