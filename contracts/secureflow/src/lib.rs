#![no_std]

mod admin;
mod escrow_core;
mod escrow_management;
mod marketplace;
mod refund_system;
mod storage_types;
mod work_lifecycle;

pub use storage_types::*;

use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec, Error};

#[contract]
pub struct SecureFlow;

#[contractimpl]
impl SecureFlow {
    /// Initialize the contract
    pub fn initialize(
        env: Env,
        owner: Address,
        fee_collector: Address,
        platform_fee_bp: u32,
    ) -> Result<(), Error> {
        admin::initialize(&env, owner, fee_collector, platform_fee_bp)
    }

    /// Create an escrow with token
    /// Note: Milestone amounts and descriptions are combined into tuples to reduce parameter count
    pub fn create_escrow(
        env: Env,
        depositor: Address,
        beneficiary: Option<Address>,
        arbiters: Vec<Address>,
        required_confirmations: u32,
        milestones: Vec<(i128, String)>, // Combined milestone amounts and descriptions
        token: Option<Address>,
        total_amount: i128,
        duration: u32,
        project_title: String,
        project_description: String,
    ) -> Result<u32, Error> {
        // Split milestones into amounts and descriptions
        let mut milestone_amounts: Vec<i128> = Vec::new(&env);
        let mut milestone_descriptions: Vec<String> = Vec::new(&env);
        
        for (amount, desc) in milestones.iter() {
            milestone_amounts.push_back(amount.clone());
            milestone_descriptions.push_back(desc.clone());
        }
        
        escrow_management::create_escrow(
            &env,
            depositor,
            beneficiary,
            arbiters,
            required_confirmations,
            milestone_amounts,
            milestone_descriptions,
            token,
            total_amount,
            duration,
            project_title,
            project_description,
        )
    }

    /// Start work on an escrow
    pub fn start_work(env: Env, escrow_id: u32, beneficiary: Address) -> Result<(), Error> {
        work_lifecycle::start_work(&env, escrow_id, beneficiary)
    }

    /// Submit a milestone
    pub fn submit_milestone(
        env: Env,
        escrow_id: u32,
        milestone_index: u32,
        description: String,
        beneficiary: Address,
    ) -> Result<(), Error> {
        work_lifecycle::submit_milestone(&env, escrow_id, milestone_index, beneficiary, description)
    }

    /// Approve a milestone
    pub fn approve_milestone(env: Env, escrow_id: u32, milestone_index: u32, depositor: Address) -> Result<(), Error> {
        work_lifecycle::approve_milestone(&env, escrow_id, milestone_index, depositor)
    }

    /// Apply to a job
    pub fn apply_to_job(
        env: Env,
        escrow_id: u32,
        cover_letter: String,
        proposed_timeline: u32,
        freelancer: Address,
    ) -> Result<(), Error> {
        marketplace::apply_to_job(&env, escrow_id, freelancer, cover_letter, proposed_timeline)
    }

    /// Accept a freelancer for an open job
    pub fn accept_freelancer(env: Env, escrow_id: u32, freelancer: Address, depositor: Address) -> Result<(), Error> {
        marketplace::accept_freelancer(&env, escrow_id, depositor, freelancer)
    }

    /// Refund an escrow
    pub fn refund_escrow(env: Env, escrow_id: u32, depositor: Address) -> Result<(), Error> {
        refund_system::refund_escrow(&env, escrow_id, depositor)
    }

    /// Emergency refund after deadline
    pub fn emergency_refund_after_deadline(env: Env, escrow_id: u32, depositor: Address) -> Result<(), Error> {
        refund_system::emergency_refund_after_deadline(&env, escrow_id, depositor)
    }

    /// Extend deadline
    pub fn extend_deadline(env: Env, escrow_id: u32, extra_seconds: u32, depositor: Address) -> Result<(), Error> {
        refund_system::extend_deadline(&env, escrow_id, depositor, extra_seconds)
    }

    // View functions
    pub fn get_escrow(env: Env, escrow_id: u32) -> Option<EscrowData> {
        escrow_core::get_escrow(&env, escrow_id)
    }

    pub fn get_user_escrows(env: Env, user: Address) -> Vec<u32> {
        escrow_core::get_user_escrows(&env, user)
    }

    pub fn get_reputation(env: Env, user: Address) -> u32 {
        escrow_core::get_reputation(&env, user)
    }

    // Admin functions
    pub fn set_platform_fee_bp(env: Env, fee_bp: u32) -> Result<(), Error> {
        admin::set_platform_fee_bp(&env, fee_bp)
    }

    pub fn set_fee_collector(env: Env, fee_collector: Address) -> Result<(), Error> {
        admin::set_fee_collector(&env, fee_collector)
    }

    pub fn set_owner(env: Env, new_owner: Address) -> Result<(), Error> {
        admin::set_owner(&env, new_owner)
    }

    pub fn whitelist_token(env: Env, token: Address) -> Result<(), Error> {
        admin::require_owner(&env)?;
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
        env.storage()
            .instance()
            .set(&DataKey::WhitelistedToken(token.clone()), &true);
        Ok(())
    }

    pub fn authorize_arbiter(env: Env, arbiter: Address) -> Result<(), Error> {
        admin::require_owner(&env)?;
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
        env.storage()
            .instance()
            .set(&DataKey::AuthorizedArbiter(arbiter.clone()), &true);
        Ok(())
    }

    /// Pause job creation
    pub fn pause_job_creation(env: Env) -> Result<(), Error> {
        admin::set_job_creation_paused(&env, true)
    }

    /// Unpause job creation
    pub fn unpause_job_creation(env: Env) -> Result<(), Error> {
        admin::set_job_creation_paused(&env, false)
    }

    /// Check if job creation is paused
    pub fn is_job_creation_paused(env: Env) -> bool {
        admin::is_job_creation_paused(&env)
    }

    /// Get the contract owner
    pub fn get_owner(env: Env) -> Result<Address, Error> {
        admin::get_owner(&env)
    }
}

