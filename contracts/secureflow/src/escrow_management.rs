use crate::admin;
use crate::escrow_core;
use crate::storage_types::{
    DataKey, EscrowData, EscrowStatus, SecureFlowError, INSTANCE_BUMP_AMOUNT, INSTANCE_LIFETIME_THRESHOLD,
};
use soroban_sdk::{token, Address, Env, String, Vec, Error};

pub fn create_escrow(
    env: &Env,
    depositor: Address,
    beneficiary: Option<Address>,
    arbiters: Vec<Address>,
    required_confirmations: u32,
    milestone_amounts: Vec<i128>,
    milestone_descriptions: Vec<String>,
    token: Option<Address>,
    total_amount: i128,
    duration: u32,
    project_title: String,
    project_description: String,
) -> Result<u32, Error> {
    // Require auth
    depositor.require_auth();

    // Check if job creation is paused
    if admin::is_job_creation_paused(env) {
        return Err(Error::from_contract_error(SecureFlowError::JobCreationPaused as u32));
    }

    // Validate parameters
    if duration < 3600 || duration > 31536000 {
        // 1 hour to 365 days
        return Err(Error::from_contract_error(SecureFlowError::InvalidDuration as u32));
    }

    if milestone_amounts.len() != milestone_descriptions.len() {
        return Err(Error::from_contract_error(SecureFlowError::MilestoneCountMismatch as u32));
    }

    if milestone_amounts.len() > 20 {
        return Err(Error::from_contract_error(SecureFlowError::TooManyMilestones as u32));
    }

    if arbiters.len() > 5 {
        return Err(Error::from_contract_error(SecureFlowError::TooManyArbiters as u32));
    }

    if required_confirmations > arbiters.len() as u32 {
        return Err(Error::from_contract_error(SecureFlowError::InvalidConfirmations as u32));
    }

    // Check token whitelist
    if !escrow_core::is_whitelisted_token(env, token.clone()) {
        return Err(Error::from_contract_error(SecureFlowError::TokenNotWhitelisted as u32));
    }

    // Calculate platform fee
    let platform_fee = escrow_core::calculate_fee(env, total_amount);

    // Calculate deadline
    let current_ledger = env.ledger().sequence();
    let deadline = current_ledger + (duration as u32) / 5; // Approximate conversion

    // Get next escrow ID
    let escrow_id = escrow_core::increment_next_escrow_id(env);

    // Calculate token key first (before moving token)
    let token_key = token.as_ref().map(|t| t.clone()).unwrap_or_else(|| env.current_contract_address());
    
    // Transfer funds
    if let Some(token_addr) = &token {
        // Transfer ERC20-like token
        let token_client = token::Client::new(env, token_addr);
        token_client.transfer(&depositor, &env.current_contract_address(), &total_amount);
    } else {
        // Transfer native XLM using Stellar Asset Contract (SAC)
        // Native XLM SAC address for testnet
        let native_token_str = String::from_str(env, "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC");
        let native_token_address = Address::from_string(&native_token_str);
        let native_token_client = token::Client::new(env, &native_token_address);
        native_token_client.transfer(
            &depositor,
            &env.current_contract_address(),
            &total_amount,
        );
    }
    
    let current_escrowed: i128 = env
        .storage()
        .instance()
        .get(&DataKey::EscrowedAmount(token_key.clone()))
        .unwrap_or(0);
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage()
        .instance()
        .set(&DataKey::EscrowedAmount(token_key), &(current_escrowed + total_amount));

    // Create escrow data
    let is_open_job = beneficiary.is_none();
    let escrow_data = EscrowData {
        depositor: depositor.clone(),
        beneficiary: beneficiary.clone(),
        arbiters,
        required_confirmations,
        token: token.clone(),
        total_amount,
        paid_amount: 0,
        platform_fee,
        deadline,
        status: EscrowStatus::Pending,
        work_started: false,
        created_at: current_ledger,
        milestone_count: milestone_amounts.len() as u32,
        is_open_job,
        project_title,
        project_description,
    };

    // Save escrow
    escrow_core::save_escrow(env, escrow_id, &escrow_data);

    // Save milestones
    for (i, (amount, description)) in milestone_amounts.iter().zip(milestone_descriptions.iter()).enumerate() {
        let milestone = crate::storage_types::Milestone {
            description: description.clone(),
            amount,
            status: crate::storage_types::MilestoneStatus::NotStarted,
            submitted_at: 0,
            approved_at: 0,
            disputed_at: 0,
            disputed_by: None,
            dispute_reason: None,
        };
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
        env.storage()
            .instance()
            .set(&DataKey::Milestone(escrow_id, i as u32), &milestone);
    }

    // Add to user escrows
    escrow_core::add_user_escrow(env, depositor.clone(), escrow_id);
    if let Some(ben) = &beneficiary {
        escrow_core::add_user_escrow(env, ben.clone(), escrow_id);
    }

    Ok(escrow_id)
}

