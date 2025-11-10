import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useWeb3 } from "@/contexts/web3-context";
import { useToast } from "@/hooks/use-toast";
import { CONTRACTS } from "@/lib/web3/config";
import { contractService } from "@/lib/web3/contract-service";

import {
  useNotifications,
  createApplicationNotification,
} from "@/contexts/notification-context";
import type { Escrow } from "@/lib/web3/types";
import { Briefcase } from "lucide-react";
import { JobsHeader } from "@/components/jobs/jobs-header";
import { JobsStats } from "@/components/jobs/jobs-stats";
import { JobCard } from "@/components/jobs/job-card";
import { ApplicationDialog } from "@/components/jobs/application-dialog";
import { JobsLoading } from "@/components/jobs/jobs-loading";

export default function JobsPage() {
  const { wallet, getContract } = useWeb3();
  const { toast } = useToast();
  const { addNotification } = useNotifications();
  const [jobs, setJobs] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<Escrow | null>(null);
  // const [coverLetter, setCoverLetter] = useState(""); // Unused - handled in dialog
  // const [proposedTimeline, setProposedTimeline] = useState(""); // Unused - handled in dialog
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState<Record<string, boolean>>({});
  const [isContractPaused, setIsContractPaused] = useState(false);
  const [ongoingProjectsCount, setOngoingProjectsCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [totalEscrowsCount, setTotalEscrowsCount] = useState(0); // Actual count from blockchain

  const getStatusFromNumber = (
    status: number
  ): "pending" | "disputed" | "active" | "completed" => {
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

  useEffect(() => {
    if (wallet.address) {
      fetchOpenJobs();
      countOngoingProjects();
    } else {
    }
    checkContractPauseStatus();
  }, [wallet.address]);

  // Removed automatic refresh to prevent constant reloading

  // Check application status when jobs are loaded
  useEffect(() => {
    if (wallet.address && jobs.length > 0) {
      checkApplicationStatus();
    }
  }, [wallet.address, jobs]);

  // Removed duplicate project count refresh

  const checkContractPauseStatus = async () => {
    try {
      const isPaused = await contractService.isJobCreationPaused();
      setIsContractPaused(isPaused);
    } catch (error) {
      console.error("Error checking pause status:", error);
      setIsContractPaused(false);
    }
  };

  const countOngoingProjects = async () => {
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW);

      // Get total number of escrows
      const totalEscrows = await contract.call("next_escrow_id");
      const escrowCount = Number(totalEscrows);

      let ongoingCount = 0;

      // Check all escrows to count ongoing projects for this user (both as client and freelancer)
      if (escrowCount > 1) {
        for (let i = 1; i < escrowCount; i++) {
          try {
            const escrowSummary = await contract.call("get_escrow", i);

            const payerAddress = escrowSummary[0]; // depositor/client
            const beneficiaryAddress = escrowSummary[1]; // beneficiary/freelancer
            const userAddress = wallet.address;

            // Check if current user is either the payer (client) or beneficiary (freelancer)
            const isPayer =
              payerAddress &&
              userAddress &&
              payerAddress.toLowerCase() === userAddress.toLowerCase();
            const isBeneficiary =
              beneficiaryAddress &&
              userAddress &&
              beneficiaryAddress.toLowerCase() === userAddress.toLowerCase();

            // Count projects where user is involved (as client or freelancer)
            if (isPayer || isBeneficiary) {
              const status = Number(escrowSummary[3]); // status is at index 3
              // Count active and pending projects (status 0 = pending, 1 = active)
              // Also count any project that's not completed, disputed, or cancelled
              if (status === 0 || status === 1) {
                ongoingCount++;
              }
            }
          } catch (error) {
            // Skip escrows that don't exist or can't be accessed
            continue;
          }
        }
      }

      setOngoingProjectsCount(ongoingCount);
    } catch (error) {
      setOngoingProjectsCount(0);
    }
  };

  const checkApplicationStatus = async () => {
    try {
      // Skip hasUserApplied check for now as the method doesn't exist in the contract
      // This prevents the errors in the console
      // We'll implement this properly later when the contract method is available
      const applicationStatus: Record<string, boolean> = {};

      for (const job of jobs) {
        // For now, assume user hasn't applied to any job
        // This will be implemented when the contract method is available
        applicationStatus[job.id] = false;
      }

      setHasApplied(applicationStatus);
    } catch (error) {
      // Silently fail - this is not critical
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchOpenJobs(), countOngoingProjects()]);
      // Check application status after refreshing jobs
      if (wallet.address && jobs.length > 0) {
        await checkApplicationStatus();
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Clear application status cache when wallet changes
  useEffect(() => {
    setHasApplied({});
  }, [wallet.address]);

  const fetchOpenJobs = async () => {
    setLoading(true);
    try {
      // Fetch all data from blockchain via contractService.getEscrow()
      // This ensures all displayed data is from the blockchain, not mock data

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

      // Get total number of escrows using contract service
      // NO TIMEOUT - let it complete fully to get accurate count from blockchain
      const escrowCount = await contractService.getNextEscrowId();

      // Set the actual escrow count from blockchain
      // escrowCount is the next available ID, so actual count is escrowCount - 1
      const actualCount = Math.max(0, escrowCount - 1);
      setTotalEscrowsCount(actualCount);
      console.log(
        `Total escrows from blockchain: ${actualCount} (next ID: ${escrowCount})`
      );

      const openJobs: Escrow[] = [];

      // Fetch open jobs from the contract
      // escrowCount is the next available ID, so if it's 2, that means 1 escrow exists
      // But if it times out and returns 1, we should still check escrow 1 directly
      // Limit the number of escrows to fetch to prevent long loading times
      const maxEscrowsToFetch = 20; // Limit to 20 escrows max
      const escrowsToCheck = Math.min(
        Math.max(escrowCount - 1, 1),
        maxEscrowsToFetch
      );

      // Always check at least escrow 1, even if escrowCount is 1 (might be timeout default)
      if (escrowsToCheck > 0) {
        for (let i = 1; i <= escrowsToCheck; i++) {
          try {
            const escrowData = await contractService.getEscrow(i);
            if (!escrowData) {
              continue;
            }

            // Check if this is an open job (beneficiary is null or zero address)
            // For Stellar, null beneficiary means it's an open job
            const zeroAddress =
              "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
            const isOpenJob =
              !escrowData.freelancer ||
              escrowData.freelancer === zeroAddress ||
              escrowData.freelancer === "";

            if (isOpenJob) {
              // Check if current user is the job creator (should not be able to apply to own job)
              const isJobCreator =
                escrowData.creator.toLowerCase() ===
                wallet.address?.toLowerCase();

              // Check if current user has already applied to this job
              // Skip the hasUserApplied check for now as it's causing errors
              // We'll implement this properly later when the contract method is available
              let userHasApplied = false;
              let applicationCount = 0;

              // IMPORTANT: created_at and deadline are LEDGER SEQUENCE NUMBERS, not timestamps!
              // Stellar ledgers close approximately every 5 seconds
              // Duration = (deadline - created_at) * 5 seconds
              const SECONDS_PER_LEDGER = 5;
              const ledgerDiff = escrowData.deadline - escrowData.created_at;
              const durationInSeconds = ledgerDiff * SECONDS_PER_LEDGER;
              const durationInDays = Math.max(
                0,
                Math.round(durationInSeconds / (24 * 60 * 60))
              );

              // Calculate approximate timestamp: current time - (current_ledger - created_at) * 5 seconds
              const ledgersAgo = currentLedger - escrowData.created_at;
              const secondsAgo = ledgersAgo * SECONDS_PER_LEDGER;
              const approxCreatedAt = Date.now() - secondsAgo * 1000;

              // Convert contract data to our Escrow type
              // All data is from blockchain - fetched via contractService.getEscrow()
              const job: Escrow = {
                id: i.toString(),
                payer: escrowData.creator, // depositor/creator (from blockchain)
                beneficiary: escrowData.freelancer || zeroAddress, // beneficiary/freelancer (from blockchain)
                token: escrowData.token || "", // token (from blockchain)
                totalAmount: escrowData.amount, // totalAmount (from blockchain)
                releasedAmount: "0", // paidAmount - would need to calculate from milestones
                status: getStatusFromNumber(escrowData.status), // status (from blockchain)
                createdAt: approxCreatedAt, // Approximate timestamp from ledger sequence
                duration: durationInDays, // Duration in days (calculated correctly from ledger sequence)
                milestones: [], // Would need to fetch milestones separately
                projectTitle: escrowData.project_title || "", // projectTitle (from blockchain)
                projectDescription: escrowData.project_description || "", // projectDescription (from blockchain)
                isOpenJob: true,
                applications: [], // Would need to fetch applications separately
                applicationCount: applicationCount, // Add real application count
                isJobCreator: isJobCreator, // Add flag to track if current user is the job creator (from blockchain)
              };

              // Log blockchain data for debugging
              console.log(`Job ${i} from blockchain:`, {
                id: job.id,
                creator: job.payer,
                amount: job.totalAmount,
                status: job.status,
                createdAt: new Date(job.createdAt).toISOString(),
                projectTitle: job.projectTitle,
                isJobCreator: job.isJobCreator,
              });

              openJobs.push(job);

              // Store application status
              setHasApplied((prev) => ({
                ...prev,
                [job.id]: userHasApplied,
              }));
            }
          } catch (error) {
            // Skip escrows that don't exist or user doesn't have access to
            continue;
          }
        }
      }

      // Set the actual jobs from the blockchain contract
      // All data in openJobs is fetched directly from the blockchain
      console.log(`Loaded ${openJobs.length} jobs from blockchain`);
      setJobs(openJobs);
    } catch (error) {
      toast({
        title: "Failed to load jobs",
        description: "Could not fetch available jobs from the blockchain",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (
    job: Escrow,
    coverLetter: string,
    proposedTimeline: string
  ) => {
    if (!job || !wallet.isConnected) return;

    // Check if user is the job creator (should not be able to apply to own job)
    if (
      job.isJobCreator ||
      job.payer?.toLowerCase() === wallet.address?.toLowerCase()
    ) {
      toast({
        title: "Cannot Apply",
        description: "You cannot apply to a job you created.",
        variant: "destructive",
      });
      return;
    }

    // Check if freelancer has reached the maximum number of ongoing projects (3)
    if (ongoingProjectsCount >= 3) {
      toast({
        title: "Project Limit Reached",
        description:
          "You can only have a maximum of 3 ongoing projects at a time. Please complete or cancel some projects before applying to new ones.",
        variant: "destructive",
      });
      return;
    }

    // Check if user has already applied to this job (local state)
    if (hasApplied[job.id]) {
      toast({
        title: "Already Applied",
        description: "You have already applied to this job.",
        variant: "destructive",
      });
      return;
    }

    setApplying(true);
    try {
      const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW);
      if (!contract) return;

      // Skip hasUserApplied check for now as the method doesn't exist in the contract
      // This prevents the errors in the console
      // We'll implement this properly later when the contract method is available
      let userHasApplied = false;

      // For now, we'll skip checking applications as the methods don't exist
      // This will be implemented when the contract methods are available
      /*
      try {
        // First try the hasUserApplied function
        const hasUserAppliedResult = await contract.call(
          "hasUserApplied",
          job.id,
          wallet.address
        );

        // Handle different return types including Proxy(Result) objects
        if (hasUserAppliedResult && typeof hasUserAppliedResult === "object") {
          try {
            const resultValue =
              hasUserAppliedResult[0] || hasUserAppliedResult.toString();
            userHasApplied =
              resultValue === true ||
              resultValue === "true" ||
              resultValue === 1 ||
              resultValue === "1";
          } catch (e) {
            userHasApplied = false;
          }
        } else {
          userHasApplied =
            hasUserAppliedResult === true ||
            hasUserAppliedResult === "true" ||
            hasUserAppliedResult === 1;
        }
      } catch (checkError) {
        userHasApplied = false;
      }

      // If hasUserApplied failed or returned false, try alternative method
      if (!userHasApplied) {
        try {
          const applications = await contract.call(
            "getApplicationsPage",
            job.id,
            0, // offset
            100 // limit
          );

          if (applications && Array.isArray(applications)) {
            // Check if current user is in the applications list
            userHasApplied = applications.some((app: any) => {
              const freelancerAddress = app.freelancer || app[0]; // Try different possible structures
              return (
                freelancerAddress &&
                freelancerAddress.toLowerCase() ===
                  wallet.address?.toLowerCase()
              );
            });
          }
        } catch (altError) {}
      }
      */

      if (userHasApplied) {
        toast({
          title: "Already Applied",
          description: "You have already applied to this job.",
          variant: "destructive",
        });
        setApplying(false);
        return;
      } else {
      }

      // Call the smart contract applyToJob function
      // The contract expects: apply_to_job(escrow_id, cover_letter, proposed_timeline, freelancer)
      // The generated client expects an object with these fields
      // Pass freelancer address - contract will require auth from it
      await contract.send("apply_to_job", {
        escrow_id: Number.parseInt(job.id, 10),
        cover_letter: coverLetter,
        proposed_timeline: Number.parseInt(proposedTimeline, 10),
        freelancer: wallet.address || "",
      });

      toast({
        title: "Application Submitted!",
        description:
          "The client will review your application and get back to you.",
      });

      // Add notification for job application submission - notify the CLIENT (job creator)
      addNotification(
        createApplicationNotification(
          "submitted",
          Number(job.id),
          wallet.address!,
          {
            jobTitle: job.projectDescription || `Job #${job.id}`,
            freelancerName:
              wallet.address!.slice(0, 6) + "..." + wallet.address!.slice(-4),
          }
        ),
        [job.payer] // Notify the client (job creator)
      );

      // coverLetter and proposedTimeline are handled in the dialog component
      setSelectedJob(null);

      // Update the application status for this specific job
      setHasApplied((prev) => ({
        ...prev,
        [job.id]: true,
      }));

      // Refresh the jobs list to update application counts
      await fetchOpenJobs();

      // Refresh the ongoing projects count
      await countOngoingProjects();
    } catch (error) {
      toast({
        title: "Application Failed",
        description: "Could not submit your application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  const filteredJobs = jobs.filter(
    (job) =>
      job.projectDescription
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      job.milestones.some((m) =>
        m.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  if (!wallet.isConnected || loading) {
    return <JobsLoading isConnected={wallet.isConnected} />;
  }

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <JobsHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
        <JobsStats
          jobs={jobs}
          openJobsCount={totalEscrowsCount}
          ongoingProjectsCount={ongoingProjectsCount}
        />

        {/* Jobs List */}
        <div className="space-y-6">
          {filteredJobs.length === 0 ? (
            <Card className="glass border-muted p-12 text-center">
              <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                No jobs found matching your search
              </p>
            </Card>
          ) : (
            filteredJobs.map((job, index) => (
              <JobCard
                key={job.id}
                job={job}
                index={index}
                hasApplied={hasApplied[job.id] || false}
                isContractPaused={isContractPaused}
                ongoingProjectsCount={ongoingProjectsCount}
                onApply={setSelectedJob}
              />
            ))
          )}
        </div>

        <ApplicationDialog
          job={selectedJob}
          open={!!selectedJob}
          onOpenChange={(open) => !open && setSelectedJob(null)}
          onApply={handleApply}
          applying={applying}
        />
      </div>
    </div>
  );
}
