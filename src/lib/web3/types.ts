export interface Milestone {
  description: string;
  amount: string;
  status:
    | "pending"
    | "submitted"
    | "approved"
    | "rejected"
    | "disputed"
    | "resolved";
  submittedAt?: number;
  approvedAt?: number;
  rejectionReason?: string;
  disputeReason?: string;
  resolvedAt?: number;
  resolvedBy?: string;
  resolutionAmount?: string; // Amount paid to beneficiary in resolution (0 = client wins, >0 = freelancer wins)
}

export interface Escrow {
  id: string;
  payer: string;
  beneficiary: string;
  token: string;
  totalAmount: string;
  releasedAmount: string;
  status: "pending" | "active" | "completed" | "disputed";
  createdAt: number;
  duration: number;
  milestones: Milestone[];
  projectTitle?: string; // Project title from blockchain
  projectDescription?: string; // Project description from blockchain
  isOpenJob?: boolean; // true if no freelancer assigned yet
  applications?: Application[];
  applicationCount?: number; // real count from blockchain
  isJobCreator?: boolean; // true if current user is the job creator (from blockchain)
  isClient?: boolean; // true if current user is the client (payer)
  isFreelancer?: boolean; // true if current user is the freelancer (beneficiary)
  milestoneCount?: number; // total number of milestones for this escrow
}

export interface EscrowStats {
  activeEscrows: number;
  totalVolume: string;
  completedEscrows: number;
}

export interface WalletState {
  address: string | null; // Stellar public key (G...)
  chainId: number | null; // Deprecated: Stellar doesn't use chain IDs
  isConnected: boolean;
  balance: string; // XLM balance (7 decimals)
}

export interface Application {
  freelancerAddress: string;
  coverLetter: string;
  proposedTimeline: number;
  appliedAt: number;
  status: "pending" | "accepted" | "rejected";
  badge?: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  averageRating?: number;
  ratingCount?: number;
}

export interface Rating {
  escrowId: number;
  freelancer: string;
  client: string;
  rating: number; // 1-5
  review: string;
  ratedAt: number;
}

export type Badge = "Beginner" | "Intermediate" | "Advanced" | "Expert";
