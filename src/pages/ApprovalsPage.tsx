import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useWeb3 } from "@/contexts/web3-context";
import { useToast } from "@/hooks/use-toast";
import { useJobCreatorStatus } from "@/hooks/use-job-creator-status";
import { usePendingApprovals } from "@/hooks/use-pending-approvals";
import { CONTRACTS } from "@/lib/web3/config";

import {
  useNotifications,
  createApplicationNotification,
} from "@/contexts/notification-context";
import type { Escrow, Application } from "@/lib/web3/types";
import { Briefcase, MessageSquare } from "lucide-react";
import { ApprovalsHeader } from "@/components/approvals/approvals-header";
import { ApprovalsStats } from "@/components/approvals/approvals-stats";
import { JobCard } from "@/components/approvals/job-card";
import { ApprovalsLoading } from "@/components/approvals/approvals-loading";

interface JobWithApplications extends Escrow {
  applications: Application[];
  applicationCount: number;
  projectDescription?: string;
  isOpenJob?: boolean;
}

export default function ApprovalsPage() {
  const { wallet } = useWeb3();
  const { toast } = useToast();
  const { isJobCreator, loading: isJobCreatorLoading } = useJobCreatorStatus();
  const { refreshApprovals } = usePendingApprovals();
  const { addNotification } = useNotifications();
  const [jobs, setJobs] = useState<JobWithApplications[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobWithApplications | null>(
    null
  );
  const [selectedFreelancer, setSelectedFreelancer] =
    useState<Application | null>(null);
  const [selectedJobForApproval, setSelectedJobForApproval] =
    useState<JobWithApplications | null>(null);

  // Debug selectedFreelancer changes
  useEffect(() => {
    if (selectedFreelancer === null) {
    }
  }, [selectedFreelancer]);
  const [approving, setApproving] = useState(false);
  const [, setIsApproving] = useState(false); // Used in handlers

  const getStatusFromNumber = (
    status: number
  ): "pending" | "active" | "completed" | "disputed" => {
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
        return "pending"; // Map cancelled to pending
      default:
        return "pending";
    }
  };

  const fetchMyJobs = async () => {
    if (!wallet.isConnected || !isJobCreator) return;

    setLoading(true);
    try {
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

      // Use ContractService instead of contract.call - it reads from blockchain
      const { ContractService } = await import("@/lib/web3/contract-service");
      const contractService = new ContractService(CONTRACTS.SECUREFLOW_ESCROW);

      // Get next escrow ID from blockchain (not hardcoded)
      const nextEscrowId = await contractService.getNextEscrowId();
      console.log(
        `[ApprovalsPage] next_escrow_id from blockchain: ${nextEscrowId}`
      );

      const myJobs: JobWithApplications[] = [];

      // Check up to 20 escrows (reasonable limit)
      const maxEscrowsToCheck = Math.min(nextEscrowId - 1, 20);
      for (let i = 1; i <= maxEscrowsToCheck; i++) {
        try {
          console.log(`[ApprovalsPage] Checking escrow ${i}...`);
          const escrow = await contractService.getEscrow(i);

          if (!escrow) {
            console.log(`[ApprovalsPage] Escrow ${i} does not exist`);
            continue;
          }

          // Check if this is my job
          const isMyJob =
            wallet.address &&
            escrow.creator &&
            escrow.creator.toLowerCase().trim() ===
              wallet.address.toLowerCase().trim();

          console.log(
            `[ApprovalsPage] Escrow ${i} creator: ${escrow.creator}, isMyJob: ${isMyJob}`
          );

          if (isMyJob) {
            // Check if it's an open job (beneficiary is zero address)
            const isOpenJob =
              !escrow.freelancer ||
              escrow.freelancer ===
                "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF" ||
              escrow.freelancer === "";

            console.log(
              `[ApprovalsPage] Escrow ${i} isOpenJob: ${isOpenJob}, freelancer: ${escrow.freelancer}`
            );

            if (isOpenJob) {
              let applicationCount = 0;
              const applications: Application[] = [];

              // Get applications from storage
              try {
                console.log(
                  `[ApprovalsPage] Fetching applications for job ${i}`
                );
                const apps = await contractService.getApplications(i);
                console.log(
                  `[ApprovalsPage] Got ${apps.length} applications for job ${i}:`,
                  apps
                );
                applicationCount = apps.length;

                // Convert to Application format
                // IMPORTANT: applied_at is also a LEDGER SEQUENCE NUMBER, not a Unix timestamp!
                // Calculate approximate timestamp: current time - (current_ledger - applied_at) * 5 seconds
                const SECONDS_PER_LEDGER = 5;
                for (const app of apps) {
                  const appliedAtLedger = app.applied_at || 0;
                  const ledgersAgo = currentLedger - appliedAtLedger;
                  const secondsAgo = ledgersAgo * SECONDS_PER_LEDGER;
                  const approxAppliedAt = Date.now() - secondsAgo * 1000;

                  applications.push({
                    freelancerAddress: app.freelancer,
                    coverLetter: app.cover_letter,
                    proposedTimeline: app.proposed_timeline,
                    appliedAt: approxAppliedAt, // Approximate timestamp from ledger sequence
                    status: "pending" as const,
                  });
                }

                console.log(
                  `Found ${applicationCount} applications for job ${i}`
                );
              } catch (error) {
                console.error(
                  `Error getting applications for job ${i}:`,
                  error
                );
                applicationCount = 0;
              }

              // IMPORTANT: created_at and deadline are LEDGER SEQUENCE NUMBERS, not timestamps!
              // Stellar ledgers close approximately every 5 seconds
              // Duration = (deadline - created_at) * 5 seconds
              const SECONDS_PER_LEDGER = 5;
              const ledgerDiff = escrow.deadline - escrow.created_at;
              const durationInSeconds = ledgerDiff * SECONDS_PER_LEDGER;
              const durationInDays = Math.max(
                0,
                durationInSeconds / (24 * 60 * 60)
              );

              // Calculate approximate timestamp: current time - (current_ledger - created_at) * 5 seconds
              const ledgersAgo = currentLedger - escrow.created_at;
              const secondsAgo = ledgersAgo * SECONDS_PER_LEDGER;
              const approxCreatedAt = Date.now() - secondsAgo * 1000;

              const job: JobWithApplications = {
                id: i.toString(),
                payer: escrow.creator,
                beneficiary:
                  escrow.freelancer ||
                  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
                token: escrow.token || "native",
                totalAmount: escrow.amount || "0",
                releasedAmount: "0", // TODO: Get from escrow if available
                status: getStatusFromNumber(escrow.status || 0),
                createdAt: approxCreatedAt, // Approximate timestamp from ledger sequence
                duration: durationInDays, // Duration in days (calculated correctly from ledger sequence)
                milestones: escrow.milestones || [],
                projectDescription:
                  escrow.project_title ||
                  escrow.project_description ||
                  "No description",
                isOpenJob: true,
                applications,
                applicationCount: Number(applicationCount),
              };

              myJobs.push(job);
            }
          }
        } catch (error) {
          continue;
        }
      }

      setJobs(myJobs);
    } catch (error) {
      toast({
        title: "Failed to load jobs",
        description: "Could not fetch your job postings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveFreelancer = async () => {
    console.log("[handleApproveFreelancer] Called", {
      selectedJobForApproval: selectedJobForApproval?.id,
      selectedFreelancer: selectedFreelancer?.freelancerAddress,
      walletConnected: wallet.isConnected,
      walletAddress: wallet.address,
    });

    if (!selectedJobForApproval || !selectedFreelancer || !wallet.isConnected) {
      console.error("[handleApproveFreelancer] Missing required data:", {
        selectedJobForApproval: !!selectedJobForApproval,
        selectedFreelancer: !!selectedFreelancer,
        walletConnected: wallet.isConnected,
      });
      toast({
        title: "Error",
        description: "Missing required information. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (!wallet.address) {
      console.error("[handleApproveFreelancer] Wallet address is missing");
      toast({
        title: "Error",
        description: "Wallet address not found. Please reconnect your wallet.",
        variant: "destructive",
      });
      return;
    }

    setApproving(true);

    try {
      console.log("[handleApproveFreelancer] Starting approval process...");
      // Use ContractService instead of contract.send - it handles address conversion and auth properly
      const { ContractService } = await import("@/lib/web3/contract-service");
      const contractService = new ContractService(CONTRACTS.SECUREFLOW_ESCROW);

      console.log(
        "[handleApproveFreelancer] Calling contractService.acceptFreelancer...",
        {
          escrow_id: Number(selectedJobForApproval.id),
          freelancer: selectedFreelancer.freelancerAddress,
          depositor: wallet.address,
        }
      );

      await contractService.acceptFreelancer({
        escrow_id: Number(selectedJobForApproval.id),
        freelancer: selectedFreelancer.freelancerAddress,
        depositor: wallet.address,
      });

      console.log("[handleApproveFreelancer] Transaction successful!");

      toast({
        title: "Freelancer Approved",
        description: "The freelancer has been approved for this job",
      });

      // Add notification for freelancer approval - notify the FREELANCER
      addNotification(
        createApplicationNotification(
          "approved",
          Number(selectedJobForApproval.id),
          selectedFreelancer.freelancerAddress,
          {
            jobTitle:
              selectedJobForApproval.projectDescription ||
              `Job #${selectedJobForApproval.id}`,
            freelancerName:
              selectedFreelancer.freelancerAddress.slice(0, 6) +
              "..." +
              selectedFreelancer.freelancerAddress.slice(-4),
          }
        ),
        [selectedFreelancer.freelancerAddress] // Notify the freelancer
      );

      // Close modals first
      setSelectedJob(null);
      setSelectedFreelancer(null);
      setSelectedJobForApproval(null);

      // Wait a moment for the transaction to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Refresh the jobs list
      await fetchMyJobs();

      // Refresh pending approvals status to update navigation
      await refreshApprovals();

      // Force a re-render by updating a dummy state
      setLoading(true);
      setTimeout(() => setLoading(false), 100);
    } catch (error) {
      console.error("[handleApproveFreelancer] Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      toast({
        title: "Approval Failed",
        description: `There was an error approving the freelancer: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  useEffect(() => {
    if (wallet.isConnected && isJobCreator) {
      fetchMyJobs();
    }
  }, [wallet.isConnected, isJobCreator]);

  // Don't redirect - let client see the page even if no approvals yet
  // They might want to see their jobs

  // Show loading while checking job creator status
  if (isJobCreatorLoading) {
    return <ApprovalsLoading isConnected={wallet.isConnected} />;
  }

  if (!wallet.isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground">
            Please connect your wallet to view your job postings and manage
            applications.
          </p>
        </div>
      </div>
    );
  }

  if (!isJobCreator) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">
            Job Creator Access Required
          </h2>
          <p className="text-muted-foreground">
            You need to be a job creator to access this page.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <ApprovalsLoading isConnected={wallet.isConnected} />;
  }

  // const totalJobs = jobs.length; // Unused
  // const totalApplications = jobs.reduce(
  //   (sum, job) => sum + job.applicationCount,
  //   0
  // ); // Unused
  // const totalValue = jobs.reduce(
  //   (sum, job) => sum + Number(job.totalAmount) / 1e7,
  //   0
  // ); // Unused

  return (
    <div className="container mx-auto px-4 py-8">
      <ApprovalsHeader />

      {/* Manual Refresh Button */}
      <div className="mb-6 flex justify-end">
        <button
          onClick={async () => {
            setLoading(true);
            await fetchMyJobs();
            setLoading(false);
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          🔄 Refresh Jobs
        </button>
      </div>

      <ApprovalsStats jobs={jobs} />

      {jobs.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No Job Postings</h3>
          <p className="text-muted-foreground">
            You haven't created any job postings yet.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6">
          {jobs.map((job, index) => (
            <JobCard
              key={job.id}
              job={job}
              index={index}
              dialogOpen={selectedJob?.id === job.id}
              selectedJob={selectedJob}
              approving={approving}
              onJobSelect={(job: JobWithApplications) => setSelectedJob(job)}
              onDialogChange={(open: boolean) => {
                if (!open) {
                  setSelectedJob(null);
                  setSelectedFreelancer(null);
                }
              }}
              onApprove={(freelancer: string) => {
                const application = job.applications.find(
                  (app) => app.freelancerAddress === freelancer
                );
                if (application) {
                  setSelectedJobForApproval(job); // Store job data for approval
                  setSelectedJob(null); // Close the first modal
                  setSelectedFreelancer(application);
                  setIsApproving(true);
                } else {
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Application Review Modal */}
      {selectedJob && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedJob(null);
              setSelectedFreelancer(null);
            }
          }}
        >
          <div
            className="bg-background rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Review Applications - {selectedJob.projectDescription}
                </h3>
                <button
                  onClick={() => {
                    setSelectedJob(null);
                    setSelectedFreelancer(null);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              {selectedJob.applications.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No applications yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedJob.applications.map((application, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Freelancer Address:</p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {application.freelancerAddress}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedJobForApproval(selectedJob); // Store job data for approval
                                setSelectedJob(null); // Close the Application Review Modal
                                setSelectedFreelancer(application);
                                setIsApproving(true);
                              }}
                              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 cursor-pointer"
                            >
                              Approve
                            </button>
                          </div>
                        </div>

                        <div>
                          <p className="font-medium">Cover Letter:</p>
                          <p className="text-sm text-muted-foreground">
                            {application.coverLetter}
                          </p>
                        </div>

                        <div>
                          <p className="font-medium">Proposed Timeline:</p>
                          <p className="text-sm text-muted-foreground">
                            {application.proposedTimeline} days
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approval/Rejection Confirmation Modal */}
      {(() => {
        return null;
      })()}
      {selectedFreelancer && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedFreelancer(null);
            }
          }}
        >
          {(() => {
            return null;
          })()}
          <div
            className="bg-background rounded-lg max-w-md w-full border shadow-2xl"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Approve Freelancer</h3>

              <div className="space-y-4">
                <div>
                  <p className="font-medium">Freelancer Address:</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedFreelancer.freelancerAddress}
                  </p>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setSelectedFreelancer(null)}
                    className="px-4 py-2 border rounded-md hover:bg-muted"
                    disabled={approving}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleApproveFreelancer();
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                    }}
                    className={`px-4 py-2 rounded-md text-white cursor-pointer bg-green-600 hover:bg-green-700 ${
                      approving ? "opacity-75" : ""
                    }`}
                    disabled={false}
                    style={{
                      pointerEvents: "auto",
                      zIndex: 1000,
                      position: "relative",
                    }}
                  >
                    Confirm Approval
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
