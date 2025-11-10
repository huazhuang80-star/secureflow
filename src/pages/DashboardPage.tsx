import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useWeb3 } from "@/contexts/web3-context";
import { useToast } from "@/hooks/use-toast";
import { CONTRACTS } from "@/lib/web3/config";

import {
  useNotifications,
  createEscrowNotification,
  createMilestoneNotification,
} from "@/contexts/notification-context";
import type { Escrow } from "@/lib/web3/types";
// import { motion } from "framer-motion"; // Unused
import {
  Wallet,
  // CheckCircle2, // Unused
  // AlertCircle, // Unused
  FileText,
  // Clock, // Unused
  // TrendingUp, // Unused
} from "lucide-react";
// import { Badge } from "@/components/ui/badge"; // Unused
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Unused
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { EscrowCard } from "@/components/dashboard/escrow-card";
import { DashboardLoading } from "@/components/dashboard/dashboard-loading";

export default function DashboardPage() {
  const { wallet, getContract } = useWeb3();
  const { toast } = useToast();
  const { addCrossWalletNotification } = useNotifications();
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEscrow, setExpandedEscrow] = useState<string | null>(null);
  const [submittingMilestone, setSubmittingMilestone] = useState<string | null>(
    null
  );

  const getStatusFromNumber = (status: number): string => {
    switch (status) {
      case 0:
        return "pending";
      case 1:
        return "active";
      case 2:
        return "completed";
      case 3:
        return "disputed";
      case 4:
        return "active"; // Changed from "cancelled" to "active" for disputed escrows
      default:
        return "pending";
    }
  };

  // Check if an escrow should be marked as terminated (has disputed or resolved milestones)
  // const isEscrowTerminated = (escrow: Escrow): boolean => { // Unused
  //   return escrow.milestones.some(
  //     (milestone) =>
  //       milestone.status === "disputed" ||
  //       milestone.status === "rejected" ||
  //       milestone.status === "resolved"
  //   );
  // };

  // Check if all disputes have been resolved
  // const hasAllDisputesResolved = (escrow: Escrow): boolean => { // Unused
  //   const disputedMilestones = escrow.milestones.filter(
  //     (milestone) => milestone.status === "disputed"
  //   );
  //   return (
  //     disputedMilestones.length === 0 &&
  //     escrow.milestones.some((milestone) => milestone.status === "resolved")
  //   );
  // };

  const getMilestoneStatusFromNumber = (status: number): string => {
    const statuses = [
      "pending", // 0 - NotStarted
      "submitted", // 1 - Submitted
      "approved", // 2 - Approved
      "disputed", // 3 - Disputed
      "resolved", // 4 - Resolved
      "rejected", // 5 - Rejected
    ];
    const mappedStatus = statuses[status] || "pending";

    return mappedStatus;
  };

  const calculateDaysLeft = (createdAt: number, duration: number): number => {
    const now = Date.now();
    // Duration is already in seconds from the contract, convert to milliseconds
    const projectEndTime = createdAt + duration * 1000;
    const daysLeft = Math.ceil((projectEndTime - now) / (24 * 60 * 60 * 1000));
    return Math.max(0, daysLeft); // Don't show negative days
  };

  const getDaysLeftMessage = (
    daysLeft: number
  ): { text: string; color: string; bgColor: string } => {
    if (daysLeft > 7) {
      return {
        text: `${daysLeft} days`,
        color: "text-red-700 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20",
      };
    } else if (daysLeft > 0) {
      return {
        text: `${daysLeft} days`,
        color: "text-orange-700 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-900/20",
      };
    } else {
      return {
        text: "Deadline passed",
        color: "text-red-700 dark:text-red-400",
        bgColor: "bg-red-100 dark:bg-red-900/30",
      };
    }
  };

  useEffect(() => {
    if (wallet.isConnected) {
      fetchUserEscrows();
    }
  }, [wallet.isConnected]);

  const fetchUserEscrows = async () => {
    setLoading(true);
    try {
      if (!wallet.isConnected || !wallet.address) {
        setEscrows([]);
        setLoading(false);
        return;
      }

      // Use ContractService instead of contract.call - it reads from blockchain
      const { ContractService } = await import("@/lib/web3/contract-service");
      const contractService = new ContractService(CONTRACTS.SECUREFLOW_ESCROW);

      // Get next escrow ID from blockchain (not hardcoded)
      const nextEscrowId = await contractService.getNextEscrowId();
      console.log(
        `[DashboardPage] next_escrow_id from blockchain: ${nextEscrowId}`
      );

      const userEscrows: Escrow[] = [];

      // Get current ledger sequence once (needed for timestamp conversion)
      let currentLedger = 0;
      try {
        const { rpc } = await import("@stellar/stellar-sdk");
        const { getCurrentNetwork } = await import("@/lib/web3/stellar-config");
        const network = getCurrentNetwork();
        const rpcServer = new rpc.Server(network.rpcUrl);
        const latestLedger = await rpcServer.getLatestLedger();
        currentLedger = latestLedger.sequence;
      } catch (error) {
        console.warn(
          "Could not fetch current ledger, using approximate timestamp:",
          error
        );
        // Fallback: use current time as approximation
        const SECONDS_PER_LEDGER = 5;
        currentLedger = Math.floor(Date.now() / 1000 / SECONDS_PER_LEDGER);
      }

      // Fetch user's escrows from the contract
      // Check if there are any escrows created yet (nextEscrowId > 1 means at least one escrow exists)
      const maxEscrowsToCheck = Math.min(nextEscrowId - 1, 20);
      for (let i = 1; i <= maxEscrowsToCheck; i++) {
        try {
          console.log(`[DashboardPage] Checking escrow ${i}...`);
          const escrowData = await contractService.getEscrow(i);

          if (!escrowData) {
            console.log(`[DashboardPage] Escrow ${i} does not exist`);
            continue;
          }

          // Check if user is involved in this escrow
          const isPayer =
            escrowData.creator &&
            escrowData.creator.toLowerCase().trim() ===
              wallet.address.toLowerCase().trim();
          const isBeneficiary =
            escrowData.freelancer &&
            escrowData.freelancer.toLowerCase().trim() ===
              wallet.address.toLowerCase().trim();

          console.log(
            `[DashboardPage] Escrow ${i} - isPayer: ${isPayer}, isBeneficiary: ${isBeneficiary}`
          );

          // Show escrows for both clients and freelancers, but with different functionality
          if (isPayer || isBeneficiary) {
            // Convert ledger sequence to approximate timestamp
            const SECONDS_PER_LEDGER = 5;
            const createdAtLedger = escrowData.created_at || 0;
            const ledgersAgo = currentLedger - createdAtLedger;
            const secondsAgo = ledgersAgo * SECONDS_PER_LEDGER;
            const approxCreatedAt = Date.now() - secondsAgo * 1000;

            // Calculate duration in seconds (deadline - created_at are both ledger sequences)
            const deadlineLedger = escrowData.deadline || 0;
            const durationInSeconds =
              (deadlineLedger - createdAtLedger) * SECONDS_PER_LEDGER;

            // Fetch milestones for this escrow
            const milestonesData = await contractService.getMilestones(i);
            const milestones = milestonesData.map((m: any, index: number) => {
              // Convert milestone status number to string
              const statusNumber = m.status || 0;
              const statusMap: Record<
                number,
                | "pending"
                | "submitted"
                | "approved"
                | "rejected"
                | "disputed"
                | "resolved"
              > = {
                0: "pending",
                1: "submitted",
                2: "approved",
                3: "disputed",
                4: "resolved",
                5: "rejected",
              };
              const status = statusMap[statusNumber] || "pending";

              // Convert ledger sequences to timestamps
              const SECONDS_PER_LEDGER = 5;
              const submittedAtLedger = m.submitted_at || 0;
              const approvedAtLedger = m.approved_at || 0;
              const submittedAt =
                submittedAtLedger > 0
                  ? Date.now() -
                    (currentLedger - submittedAtLedger) *
                      SECONDS_PER_LEDGER *
                      1000
                  : undefined;
              const approvedAt =
                approvedAtLedger > 0
                  ? Date.now() -
                    (currentLedger - approvedAtLedger) *
                      SECONDS_PER_LEDGER *
                      1000
                  : undefined;

              return {
                description: m.description || "",
                amount: m.amount?.toString() || "0",
                status,
                submittedAt,
                approvedAt,
                disputeReason: m.dispute_reason || undefined,
                rejectionReason: undefined,
              };
            });

            // Convert contract data to our Escrow type
            const escrow: Escrow = {
              id: i.toString(),
              payer: escrowData.creator || "",
              beneficiary: escrowData.freelancer || "",
              isClient: isPayer ? true : undefined, // Track if current user is the client (payer)
              isFreelancer: isBeneficiary ? true : undefined, // Track if current user is the freelancer (beneficiary)
              token: escrowData.token || "native",
              totalAmount: escrowData.amount || "0",
              releasedAmount: "0", // TODO: Get from escrow if available
              status: getStatusFromNumber(escrowData.status || 0) as
                | "pending"
                | "active"
                | "completed"
                | "disputed",
              createdAt: approxCreatedAt, // Approximate timestamp from ledger sequence
              duration: durationInSeconds, // Duration in seconds
              milestones,
              projectDescription:
                escrowData.project_title ||
                escrowData.project_description ||
                "",
            };

            userEscrows.push(escrow);
            console.log(`[DashboardPage] Added escrow ${i} to user escrows`);
          }
        } catch (error) {
          console.error(`[DashboardPage] Error checking escrow ${i}:`, error);
          // Skip escrows that don't exist or user doesn't have access to
          continue;
        }
      }

      console.log(
        `[DashboardPage] Found ${userEscrows.length} escrows for user`
      );
      // Set the actual escrows from the contract
      setEscrows(userEscrows);
    } catch (error) {
      console.error("[DashboardPage] Error fetching escrows:", error);
      toast({
        title: "Failed to load escrows",
        description: "Could not fetch your escrows from the blockchain",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // const getStatusBadge = (status: string, escrow?: Escrow) => { // Unused
  //   // Check if this escrow should be terminated
  //   const isTerminated = escrow ? isEscrowTerminated(escrow) : false;
  //   const finalStatus = isTerminated ? "terminated" : status;
  //
  //   const variants: Record<string, { variant: any; icon: any; label: string }> =
  //     {
  //       pending: { variant: "secondary", icon: Clock, label: "Pending" },
  //       active: { variant: "default", icon: TrendingUp, label: "Active" },
  //       completed: {
  //         variant: "outline",
  //         icon: CheckCircle2,
  //         label: "Completed",
  //       },
  //       disputed: {
  //         variant: "destructive",
  //         icon: AlertCircle,
  //         label: "Disputed",
  //       },
  //       terminated: {
  //         variant: "secondary",
  //         icon: AlertCircle,
  //         label: "Terminated",
  //       },
  //     };
  //
  //   const config = variants[finalStatus] || variants.pending;
  //   const Icon = config.icon;
  //
  //   return (
  //     <Badge variant={config.variant} className="gap-1">
  //       <Icon className="h-3 w-3" />
  //       {config.label}
  //     </Badge>
  //   );
  // };

  // const getMilestoneStatusBadge = (status: string) => { // Unused
  //   const variants: Record<string, { variant: any; label: string }> = {
  //     pending: { variant: "secondary", label: "Pending" },
  //     submitted: { variant: "default", label: "Submitted" },
  //     approved: { variant: "outline", label: "Approved" },
  //     disputed: { variant: "destructive", label: "Disputed" },
  //   };
  //
  //   const config = variants[status] || variants.pending;
  //
  //   return (
  //     <Badge variant={config.variant} className="text-xs">
  //       {config.label}
  //     </Badge>
  //   );
  // };

  // const calculateProgress = (escrow: Escrow) => { // Unused
  //   const released = Number.parseFloat(escrow.releasedAmount) / 1e7;
  //   const total = Number.parseFloat(escrow.totalAmount) / 1e7;
  //   return total > 0 ? (released / total) * 100 : 0;
  // };

  // const formatAmount = (amount: string) => { // Unused
  //   return (Number.parseFloat(amount) / 1e7).toFixed(2);
  // };

  // const getTokenInfo = (tokenAddress: string) => { // Unused
  //   return {
  //     name:
  //       tokenAddress === "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
  //         ? "MON"
  //         : "Token",
  //     symbol:
  //       tokenAddress === "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
  //         ? "MON"
  //         : "TKN",
  //   };
  // };

  // const getStatusColor = (status: string) => { // Unused
  //   switch (status) {
  //     case "pending":
  //       return "bg-yellow-100 text-yellow-800";
  //     case "active":
  //       return "bg-blue-100 text-blue-800";
  //     case "completed":
  //       return "bg-green-100 text-green-800";
  //     case "disputed":
  //       return "bg-red-100 text-red-800";
  //     default:
  //       return "bg-gray-100 text-gray-800";
  //   }
  // };

  // const getMilestoneStatusColor = (status: string) => { // Unused
  //   switch (status) {
  //     case "pending":
  //       return "bg-yellow-100 text-yellow-800";
  //     case "submitted":
  //       return "bg-blue-100 text-blue-800";
  //     case "approved":
  //       return "bg-green-100 text-green-800";
  //     case "disputed":
  //       return "bg-red-100 text-red-800";
  //     default:
  //       return "bg-gray-100 text-gray-800";
  //   }
  // };

  // const filterEscrows = (filter: string) => { // Unused
  //   if (filter === "all") return escrows;
  //   return escrows.filter((e) => e.status === filter);
  // };

  const disputeMilestone = async (escrowId: string, milestoneIndex: number) => {
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW);
      if (!contract) return;

      setSubmittingMilestone(`${escrowId}-${milestoneIndex}`);
      await contract.send(
        "dispute_milestone",
        escrowId,
        milestoneIndex,
        "Disputed by client"
      );
      toast({
        title: "Milestone Disputed",
        description: "A dispute has been opened for this milestone",
      });

      // Get freelancer address from escrow data
      const escrow = escrows.find((e) => e.id === escrowId);
      const freelancerAddress = escrow?.beneficiary;

      // Add cross-wallet notification for dispute opening
      addCrossWalletNotification(
        createMilestoneNotification("disputed", escrowId, milestoneIndex, {
          reason: "Disputed by client",
          clientName:
            wallet.address!.slice(0, 6) + "..." + wallet.address!.slice(-4),
        }),
        wallet.address || undefined, // Client address
        freelancerAddress // Freelancer address
      );

      // Wait a moment for blockchain state to update
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await fetchUserEscrows();
    } catch (error) {
      toast({
        title: "Dispute Failed",
        description: "Could not open dispute. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingMilestone(null);
    }
  };

  const startWork = async (escrowId: string) => {
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW);
      if (!contract) return;

      setSubmittingMilestone(escrowId);
      await contract.send("start_work", escrowId);
      toast({
        title: "Work Started",
        description: "You have started work on this escrow",
      });

      // Get freelancer address from escrow data
      const escrow = escrows.find((e) => e.id === escrowId);
      const freelancerAddress = escrow?.beneficiary;

      // Add cross-wallet notification for work started
      addCrossWalletNotification(
        createEscrowNotification("work_started", escrowId, {
          projectTitle:
            escrows.find((e) => e.id === escrowId)?.projectDescription ||
            `Project #${escrowId}`,
          freelancerName:
            wallet.address!.slice(0, 6) + "..." + wallet.address!.slice(-4),
        }),
        wallet.address || undefined, // Client address
        freelancerAddress // Freelancer address
      );

      // Wait a moment for blockchain state to update
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await fetchUserEscrows();
    } catch (error) {
      toast({
        title: "Start Work Failed",
        description: "Could not start work. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingMilestone(null);
    }
  };

  const openDispute = async (escrowId: string) => {
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW);
      if (!contract) return;

      setSubmittingMilestone(escrowId);
      await contract.send("dispute_milestone", escrowId, 0, "General dispute");
      toast({
        title: "Dispute Opened",
        description: "A dispute has been opened for this escrow",
      });

      // Wait a moment for blockchain state to update
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await fetchUserEscrows();
    } catch (error) {
      toast({
        title: "Dispute Failed",
        description: "Could not open dispute. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingMilestone(null);
    }
  };

  const approveMilestone = async (escrowId: string, milestoneIndex: number) => {
    try {
      // SECURITY: Double-check that user is the depositor
      const escrow = escrows.find((e) => e.id === escrowId);
      if (
        !escrow ||
        escrow.payer.toLowerCase() !== wallet.address?.toLowerCase()
      ) {
        toast({
          title: "Access Denied",
          description: "Only the job creator can approve milestones",
          variant: "destructive",
        });
        return;
      }

      setSubmittingMilestone(`${escrowId}-${milestoneIndex}`);
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW);
      if (!contract) return;

      toast({
        title: "Approving milestone...",
        description: "Please confirm the transaction in your wallet",
      });

      await contract.send(
        "approve_milestone",
        "no-value",
        escrowId,
        milestoneIndex
      );

      // Transaction is already confirmed via waitForConfirmation in web3-context
      // For Stellar, we don't need to poll for receipts like Ethereum
      // The transaction hash is returned after confirmation
      toast({
        title: "Milestone Approved!",
        description: "Payment has been sent to the freelancer",
      });

      // Get freelancer address from escrow data
      const freelancerAddress = escrow.beneficiary;

      // Add cross-wallet notification for milestone approval
      addCrossWalletNotification(
        createMilestoneNotification("approved", escrowId, milestoneIndex, {
          clientName:
            wallet.address.slice(0, 6) + "..." + wallet.address.slice(-4),
          projectTitle: escrow.projectDescription || `Project #${escrowId}`,
        }),
        wallet.address || undefined, // Client address
        freelancerAddress // Freelancer address
      );

      // Wait a moment for blockchain state to update
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Add debugging for payment tracking
      // const milestone = escrow.milestones[milestoneIndex]; // Unused

      // Check if milestone amount is being parsed correctly
      // const milestoneAmountInTokens = Number.parseFloat(milestone.amount) / 1e7; // Unused

      await fetchUserEscrows();

      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent("milestoneApproved"));

      // Reload the page to ensure UI is fully updated
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve milestone",
        variant: "destructive",
      });
    } finally {
      setSubmittingMilestone(null);
    }
  };

  const rejectMilestone = async (
    escrowId: string,
    milestoneIndex: number,
    reason: string
  ) => {
    try {
      // SECURITY: Double-check that user is the depositor
      const escrow = escrows.find((e) => e.id === escrowId);
      if (
        !escrow ||
        escrow.payer.toLowerCase() !== wallet.address?.toLowerCase()
      ) {
        toast({
          title: "Access Denied",
          description: "Only the job creator can reject milestones",
          variant: "destructive",
        });
        return;
      }

      setSubmittingMilestone(`${escrowId}-${milestoneIndex}`);
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW);
      if (!contract) return;

      toast({
        title: "Rejecting milestone...",
        description: "Please confirm the transaction in your wallet",
      });

      await contract.send(
        "rejectMilestone",
        "no-value",
        escrowId,
        milestoneIndex,
        reason
      );

      // Transaction is already confirmed via waitForConfirmation in web3-context
      // For Stellar, we don't need to poll for receipts like Ethereum
      // The transaction hash is returned after confirmation
      toast({
        title: "Milestone Rejected",
        description: "The freelancer has been notified and can resubmit",
      });
      await fetchUserEscrows();

      // Reload the page to ensure UI is fully updated
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject milestone",
        variant: "destructive",
      });
    } finally {
      setSubmittingMilestone(null);
    }
  };

  // const toggleExpand = (id: string) => { // Unused
  //   setExpandedEscrow(expandedEscrow === id ? null : id);
  // };

  if (!wallet.isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-mesh">
        <Card className="glass border-primary/20 p-12 text-center max-w-md">
          <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Wallet Not Connected</h2>
          <p className="text-muted-foreground mb-6">
            Please connect your wallet to view your escrows
          </p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <DashboardLoading isConnected={wallet.isConnected} />;
  }

  // const completedEscrows = escrows.filter((e) => e.status === "completed"); // Unused
  // const totalVolume = escrows
  //   .reduce((sum, e) => sum + Number.parseFloat(e.totalAmount) / 1e7, 0)
  //   .toFixed(2); // Unused

  if (!wallet.isConnected) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <DashboardHeader />
          <Card className="glass border-primary/20 p-12 text-center max-w-md">
            <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground">
              Connect your wallet to view your escrows and manage milestones.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen py-12">
        <div className="container mx-auto px-4">
          <DashboardHeader />
          <DashboardLoading isConnected={wallet.isConnected} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <DashboardHeader />
        <DashboardStats escrows={escrows} />

        {escrows.length === 0 ? (
          <Card className="glass border-muted p-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-bold mb-2">No Escrows Found</h3>
            <p className="text-muted-foreground">
              You don't have any escrows yet. Create one to get started.
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {escrows.map((escrow, index) => (
              <EscrowCard
                key={escrow.id}
                escrow={escrow}
                index={index}
                expandedEscrow={expandedEscrow}
                submittingMilestone={
                  submittingMilestone === escrow.id ? "true" : "false"
                }
                onToggleExpanded={() =>
                  setExpandedEscrow(
                    expandedEscrow === escrow.id ? null : escrow.id
                  )
                }
                onApproveMilestone={approveMilestone}
                onRejectMilestone={(
                  escrowId: string,
                  milestoneIndex: number
                ) => {
                  // For now, use empty reason - this should be handled by the component
                  rejectMilestone(
                    escrowId,
                    milestoneIndex,
                    "No reason provided"
                  );
                }}
                onDisputeMilestone={disputeMilestone}
                onStartWork={startWork}
                onDispute={openDispute}
                calculateDaysLeft={calculateDaysLeft}
                getDaysLeftMessage={getDaysLeftMessage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
