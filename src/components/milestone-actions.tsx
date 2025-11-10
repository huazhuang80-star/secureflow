import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWeb3 } from "@/contexts/web3-context";
// Stellar doesn't use smart accounts or delegation
// import { useSmartAccount } from "@/contexts/smart-account-context";
// import { useDelegation } from "@/contexts/delegation-context";
// import { useNotifications } from "@/contexts/notification-context"; // Unused
import { useToast } from "@/hooks/use-toast";
import { CONTRACTS } from "@/lib/web3/config";

import {
  CheckCircle2,
  Send,
  AlertTriangle,
  Gavel,
  Play,
  XCircle,
} from "lucide-react";
import type { Milestone } from "@/lib/web3/types";

interface MilestoneActionsProps {
  escrowId: string;
  milestoneIndex: number;
  milestone: Milestone;
  isPayer: boolean;
  isBeneficiary: boolean;
  escrowStatus: string;
  onSuccess: () => void;
  allMilestones?: Milestone[]; // Add all milestones for sequential validation
  showSubmitButton?: boolean; // New prop to control submit button visibility
  payerAddress?: string; // Client address for notifications
  beneficiaryAddress?: string; // Freelancer address for notifications
}

export function MilestoneActions({
  escrowId,
  milestoneIndex,
  milestone,
  isPayer,
  isBeneficiary,
  escrowStatus,
  onSuccess,
  // allMilestones = [], // Unused
  // showSubmitButton = true, // Unused
  // payerAddress, // Unused
  // beneficiaryAddress, // Unused
}: MilestoneActionsProps) {
  const { wallet, getContract } = useWeb3();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<
    | "start"
    | "submit"
    | "approve"
    | "reject"
    | "resubmit"
    | "dispute"
    | "resolve"
    | null
  >(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [resubmitMessage, setResubmitMessage] = useState("");

  // Helper functions
  const canApproveMilestone = () => {
    return (
      milestone.status === "submitted" && isPayer && escrowStatus === "active"
    );
  };

  const canResubmitMilestone = () => {
    return (
      milestone.status === "rejected" &&
      isBeneficiary &&
      escrowStatus === "active"
    );
  };

  const isProjectTerminated =
    milestone.status === "disputed" || escrowStatus === "disputed";

  const openDialog = (type: typeof actionType) => {
    setActionType(type);
    setDialogOpen(true);
  };

  const handleAction = async () => {
    if (!actionType) return;

    setIsLoading(true);
    const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW);

    try {
      let txHash: string | undefined;

      switch (actionType) {
        case "start":
          txHash = await contract.send(
            "start_work",
            Number(escrowId),
            wallet.address
          );
          break;
        case "submit":
          txHash = await contract.send(
            "submit_milestone",
            Number(escrowId),
            milestoneIndex,
            milestone.description,
            wallet.address
          );
          break;
        case "approve":
          txHash = await contract.send(
            "approve_milestone",
            Number(escrowId),
            milestoneIndex,
            wallet.address
          );
          break;
        case "reject":
          txHash = await contract.send(
            "reject_milestone",
            Number(escrowId),
            milestoneIndex,
            disputeReason
          );
          break;
        case "dispute":
          txHash = await contract.send(
            "dispute_milestone",
            Number(escrowId),
            milestoneIndex,
            disputeReason
          );
          break;
        case "resubmit":
          txHash = await contract.send(
            "submit_milestone",
            Number(escrowId),
            milestoneIndex,
            resubmitMessage || milestone.description,
            wallet.address
          );
          break;
      }

      if (txHash) {
        toast({
          title: "Transaction submitted",
          description: "Your transaction has been submitted successfully",
        });
        setDialogOpen(false);
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Transaction failed",
        description: error.message || "Failed to submit transaction",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Dialog content based on action type
  const dialogContent = {
    start: {
      title: "Start Work",
      description: "Are you sure you want to start work on this escrow?",
      confirmText: "Start Work",
    },
    submit: {
      title: "Submit Milestone",
      description: "Submit this milestone for client review and approval.",
      confirmText: "Submit Milestone",
    },
    approve: {
      title: "Approve Milestone",
      description:
        "Approve this milestone and release payment to the freelancer.",
      confirmText: "Approve & Release",
    },
    reject: {
      title: "Reject Milestone",
      description:
        "Reject this milestone. The freelancer can resubmit with improvements.",
      confirmText: "Reject Milestone",
    },
    dispute: {
      title: "Dispute Milestone",
      description:
        "Dispute this milestone. An arbiter will review and resolve the dispute.",
      confirmText: "Create Dispute",
    },
    resubmit: {
      title: "Resubmit Milestone",
      description:
        "Resubmit this milestone with improvements based on client feedback.",
      confirmText: "Resubmit Milestone",
    },
    resolve: {
      title: "Resolve Dispute",
      description: "Resolve this dispute and finalize the milestone outcome.",
      confirmText: "Resolve Dispute",
    },
  }[actionType || "submit"] || {
    title: "Confirm Action",
    description: "Are you sure you want to proceed?",
    confirmText: "Confirm",
  };

  const Icon =
    {
      start: Play,
      submit: Send,
      approve: CheckCircle2,
      reject: XCircle,
      dispute: Gavel,
      resubmit: Send,
      resolve: CheckCircle2,
    }[actionType || "submit"] || Send;

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Reject Milestone - Only payer for submitted milestones (disabled if terminated) */}
        {canApproveMilestone() && !isProjectTerminated && (
          <Button
            onClick={() => openDialog("reject")}
            size="sm"
            variant="outline"
            className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
            disabled={isLoading}
          >
            <XCircle className="h-4 w-4" />
            {isLoading ? "Processing..." : "Reject"}
          </Button>
        )}

        {/* Dispute Milestone - Only payer for submitted milestones (disabled if terminated) */}
        {milestone.status === "submitted" &&
          isPayer &&
          !isProjectTerminated && (
            <Button
              onClick={() => openDialog("dispute")}
              size="sm"
              variant="destructive"
              className="gap-2"
              disabled={isLoading}
            >
              <Gavel className="h-4 w-4" />
              {isLoading ? "Processing..." : "Dispute"}
            </Button>
          )}

        {/* Approved Status - Show approved badge */}
        {milestone.status === "approved" && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Approved</span>
          </div>
        )}

        {/* Rejected Status - Show rejected badge and resubmit button */}
        {milestone.status === "rejected" && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Rejected</span>
            </div>
            {canResubmitMilestone() && (
              <Button
                onClick={() => openDialog("resubmit")}
                size="sm"
                variant="default"
                className="gap-2"
                disabled={isLoading}
                data-action="resubmit"
              >
                <Send className="h-4 w-4" />
                {isLoading ? "Processing..." : "Resubmit"}
              </Button>
            )}
          </div>
        )}

        {/* Disputed Status - Show disputed badge with reason */}
        {milestone.status === "disputed" && (
          <div className="flex flex-col gap-2 text-orange-600">
            <div className="flex items-center gap-2">
              <Gavel className="h-4 w-4" />
              <span className="text-sm font-medium">Disputed</span>
            </div>
            {milestone.disputeReason && (
              <div className="text-xs text-orange-700 bg-orange-50 p-2 rounded border">
                <strong>Reason:</strong> {milestone.disputeReason}
              </div>
            )}
          </div>
        )}

        {/* Resolved Status - Show resolved badge */}
        {milestone.status === "resolved" && (
          <div className="flex items-center gap-2 text-blue-600">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Resolved</span>
          </div>
        )}

        {/* Terminated Project Status - Show terminated badge */}
        {isProjectTerminated && (
          <div className="flex items-center gap-2 text-gray-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Project Terminated</span>
          </div>
        )}

        {/* Duplicate dispute button removed */}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-2xl">
                {dialogContent.title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-base leading-relaxed">
              {dialogContent.description}
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/50 rounded-lg p-4 my-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Escrow ID:</span>
                <span className="font-mono font-semibold">#{escrowId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Milestone:</span>
                <span className="font-semibold">{milestoneIndex + 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-bold text-primary">
                  {(() => {
                    try {
                      const amount = Number.parseFloat(milestone.amount);
                      if (isNaN(amount)) return "0.00";
                      return (amount / 1e7).toFixed(2);
                    } catch (e) {
                      return "0.00";
                    }
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Reason input for dispute or reject action */}
          {(actionType === "dispute" || actionType === "reject") && (
            <div className="my-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for {actionType === "dispute" ? "dispute" : "rejection"}{" "}
                (required)
              </label>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder={`Please explain why you are ${
                  actionType === "dispute" ? "disputing" : "rejecting"
                } this milestone...`}
                className="w-full p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={3}
                required
              />
              {!disputeReason.trim() && (
                <p className="text-sm text-red-600 mt-1">
                  Please provide a reason for the{" "}
                  {actionType === "dispute" ? "dispute" : "rejection"}
                </p>
              )}
            </div>
          )}

          {/* Rejection reason display and resubmit message for resubmit action */}
          {actionType === "resubmit" && (
            <div className="my-4 space-y-4">
              {/* Show rejection reason if available */}
              {milestone.rejectionReason && (
                <div>
                  <label className="block text-sm font-medium text-red-600 mb-2">
                    Rejection Reason
                  </label>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    {milestone.rejectionReason}
                  </div>
                </div>
              )}

              {/* Update message field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Update Message
                </label>
                <textarea
                  value={resubmitMessage}
                  onChange={(e) => setResubmitMessage(e.target.value)}
                  placeholder="Describe the improvements you've made to address the client's feedback..."
                  className="w-full p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This message will be sent to the client along with your
                  resubmission.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleAction} disabled={isLoading}>
              {isLoading ? "Processing..." : dialogContent.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
