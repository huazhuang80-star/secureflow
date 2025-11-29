use soroban_sdk::{contracttype, Address, String, Vec, Error};

// Constants
pub const DAY_IN_LEDGERS: u32 = 17280;
pub const INSTANCE_BUMP_AMOUNT: u32 = 7 * DAY_IN_LEDGERS;
pub const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;

// Error codes for proper error handling
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SecureFlowError {
    // Admin errors (1000-1099)
    AlreadyInitialized = 1000,
    FeeTooHigh = 1001,
    NotOwner = 1002,
    NotInitialized = 1003,
    
    // Escrow errors (1100-1199)
    EscrowNotFound = 1100,
    EscrowNotActive = 1101,
    InvalidEscrowStatus = 1102,
    WorkAlreadyStarted = 1103,
    WorkNotStarted = 1104,
    
    // Escrow creation errors (1200-1299)
    JobCreationPaused = 1200,
    InvalidDuration = 1201,
    MilestoneCountMismatch = 1202,
    TooManyMilestones = 1203,
    TooManyArbiters = 1204,
    InvalidConfirmations = 1205,
    TokenNotWhitelisted = 1206,
    
    // Marketplace errors (1300-1399)
    NotOpenJob = 1300,
    JobClosed = 1301,
    CannotApplyToOwnJob = 1302,
    TooManyApplications = 1303,
    OnlyDepositor = 1304,
    FreelancerNotApplied = 1305,
    AlreadyApplied = 1306,
    
    // Milestone errors (1400-1499)
    InvalidMilestone = 1400,
    MilestoneAlreadySubmitted = 1401,
    MilestoneNotSubmitted = 1402,
    MilestoneAlreadyProcessed = 1403,
    
    // Refund errors (1500-1599)
    NothingToRefund = 1500,
    DeadlineNotPassed = 1501,
    EmergencyPeriodNotReached = 1502,
    CannotRefund = 1503,
    InvalidExtension = 1504,
    CannotExtend = 1505,
    
    // Authorization errors (1600-1699)
    OnlyBeneficiary = 1600,
    Unauthorized = 1601,
    
    // Validation errors (1700-1799)
    InvalidAmount = 1700,
    InvalidAddress = 1701,
    InvalidParameter = 1702,
}

impl From<SecureFlowError> for Error {
    fn from(e: SecureFlowError) -> Self {
        Error::from_contract_error(e as u32)
    }
}

// Enum for Escrow Status
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub enum EscrowStatus {
    Pending,
    InProgress,
    Released,
    Refunded,
    Disputed,
    Expired,
}

// Enum for Milestone Status
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub enum MilestoneStatus {
    NotStarted,
    Submitted,
    Approved,
    Disputed,
    Resolved,
    Rejected,
}

// Milestone struct
#[derive(Clone, Debug)]
#[contracttype]
pub struct Milestone {
    pub description: String,
    pub amount: i128,
    pub status: MilestoneStatus,
    pub submitted_at: u32,
    pub approved_at: u32,
    pub disputed_at: u32,
    pub disputed_by: Option<Address>,
    pub dispute_reason: Option<String>,
    pub rejection_reason: Option<String>,
}

// Application struct
#[derive(Clone, Debug)]
#[contracttype]
pub struct Application {
    pub freelancer: Address,
    pub cover_letter: String,
    pub proposed_timeline: u32,
    pub applied_at: u32,
}

// EscrowData struct
#[derive(Clone, Debug)]
#[contracttype]
pub struct EscrowData {
    pub depositor: Address,
    pub beneficiary: Option<Address>,
    pub arbiters: Vec<Address>,
    pub required_confirmations: u32,
    pub token: Option<Address>, // None for native XLM
    pub total_amount: i128,
    pub paid_amount: i128,
    pub platform_fee: i128,
    pub deadline: u32,
    pub status: EscrowStatus,
    pub work_started: bool,
    pub created_at: u32,
    pub milestone_count: u32,
    pub is_open_job: bool,
    pub project_title: String,
    pub project_description: String,
}

// Storage keys enum
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Escrow(u32),                    // escrow_id -> EscrowData
    Milestone(u32, u32),            // (escrow_id, milestone_index) -> Milestone
    Application(u32, u32),          // (escrow_id, application_index) -> Application
    UserEscrows(Address),           // user -> Vec<u32>
    AuthorizedArbiter(Address),    // arbiter -> bool
    WhitelistedToken(Address),      // token -> bool
    EscrowedAmount(Address),        // token -> i128
    TotalFeesByToken(Address),      // token -> i128
    Reputation(Address),            // user -> u32
    CompletedEscrows(Address),      // user -> u32
    NextEscrowId,                   // -> u32
    PlatformFeeBP,                  // -> u32
    FeeCollector,                   // -> Address
    Owner,                          // -> Address
    JobCreationPaused,              // -> bool
}

