use crate::escrow_core;
use crate::storage_types::{
    DataKey, EscrowStatus, MilestoneStatus, SecureFlowError, INSTANCE_BUMP_AMOUNT, INSTANCE_LIFETIME_THRESHOLD,
};
use soroban_sdk::{token, Address, Env, String, Error};

#[allow(dead_code)]
const DISPUTE_PERIOD: u32 = 604800; // 7 days in seconds
const REPUTATION_PER_MILESTONE: u32 = 10;
const REPUTATION_PER_ESCROW: u32 = 25;
const MIN_REP_ELIGIBLE_ESCROW_VALUE: i128 = 10000000000000000; // 0.01 in stroops

pub fn start_work(env: &Env, escrow_id: u32, beneficiary: Address) -> Result<(), Error> {
    beneficiary.require_auth();

    escrow_core::require_valid_escrow(env, escrow_id)?;
    let mut escrow = escrow_core::get_escrow(env, escrow_id)
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::EscrowNotFound as u32))?;

    if escrow.beneficiary != Some(beneficiary.clone()) {
        return Err(Error::from_contract_error(SecureFlowError::OnlyBeneficiary as u32));
    }

    if escrow.status != EscrowStatus::Pending {
        return Err(Error::from_contract_error(SecureFlowError::InvalidEscrowStatus as u32));
    }

    if escrow.work_started {
        return Err(Error::from_contract_error(SecureFlowError::WorkAlreadyStarted as u32));
    }

    escrow.work_started = true;
    escrow.status = EscrowStatus::InProgress;

    // Update platform fees
    if escrow.platform_fee > 0 {
        let token_key = escrow.token.clone().unwrap_or(env.current_contract_address());
        let current_fees: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalFeesByToken(token_key.clone()))
            .unwrap_or(0);
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
        env.storage()
            .instance()
            .set(
                &DataKey::TotalFeesByToken(token_key),
                &(current_fees + escrow.platform_fee),
            );
    }

    escrow_core::save_escrow(env, escrow_id, &escrow);
    Ok(())
}

pub fn submit_milestone(
    env: &Env,
    escrow_id: u32,
    milestone_index: u32,
    beneficiary: Address,
    description: String,
) -> Result<(), Error> {
    beneficiary.require_auth();

    escrow_core::require_valid_escrow(env, escrow_id)?;
    let escrow = escrow_core::get_escrow(env, escrow_id)
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::EscrowNotFound as u32))?;

    if escrow.beneficiary != Some(beneficiary.clone()) {
        return Err(Error::from_contract_error(SecureFlowError::OnlyBeneficiary as u32));
    }

    if escrow.status != EscrowStatus::InProgress {
        return Err(Error::from_contract_error(SecureFlowError::InvalidEscrowStatus as u32));
    }

    if milestone_index >= escrow.milestone_count {
        return Err(Error::from_contract_error(SecureFlowError::InvalidMilestone as u32));
    }

    // Get milestone
    let mut milestone: crate::storage_types::Milestone = env
        .storage()
        .instance()
        .get(&DataKey::Milestone(escrow_id, milestone_index))
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::InvalidMilestone as u32))?;

    if milestone.status != MilestoneStatus::NotStarted {
        return Err(Error::from_contract_error(SecureFlowError::MilestoneAlreadyProcessed as u32));
    }

    milestone.status = MilestoneStatus::Submitted;
    milestone.submitted_at = env.ledger().sequence();
    milestone.description = description;

    // Save milestone
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage()
        .instance()
        .set(&DataKey::Milestone(escrow_id, milestone_index), &milestone);
    
    Ok(())
}

pub fn approve_milestone(env: &Env, escrow_id: u32, milestone_index: u32, depositor: Address) -> Result<(), Error> {
    depositor.require_auth();

    escrow_core::require_valid_escrow(env, escrow_id)?;
    let mut escrow = escrow_core::get_escrow(env, escrow_id)
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::EscrowNotFound as u32))?;

    if escrow.depositor != depositor {
        return Err(Error::from_contract_error(SecureFlowError::OnlyDepositor as u32));
    }

    if escrow.status != EscrowStatus::InProgress {
        return Err(Error::from_contract_error(SecureFlowError::EscrowNotActive as u32));
    }

    if milestone_index >= escrow.milestone_count {
        return Err(Error::from_contract_error(SecureFlowError::InvalidMilestone as u32));
    }

    // Get milestone
    let mut milestone: crate::storage_types::Milestone = env
        .storage()
        .instance()
        .get(&DataKey::Milestone(escrow_id, milestone_index))
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::InvalidMilestone as u32))?;

    if milestone.status != MilestoneStatus::Submitted {
        return Err(Error::from_contract_error(SecureFlowError::MilestoneNotSubmitted as u32));
    }

    let amount = milestone.amount;
    milestone.status = MilestoneStatus::Approved;
    milestone.approved_at = env.ledger().sequence();

    // Get beneficiary address before moving
    let beneficiary_addr = escrow.beneficiary.clone().unwrap();
    
    // Update escrow
    escrow.paid_amount += amount;
    
    // Update escrowed amount
    let token_key = escrow.token.as_ref().map(|t| t.clone()).unwrap_or_else(|| env.current_contract_address());
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
        .set(
            &DataKey::EscrowedAmount(token_key),
            &(current_escrowed - amount),
        );

    // Transfer funds to beneficiary
    if let Some(token_addr) = &escrow.token {
        let token_client = token::Client::new(env, &token_addr);
        token_client.transfer(
            &env.current_contract_address(),
            &beneficiary_addr,
            &amount,
        );
    } else {
        // Transfer native XLM using Stellar Asset Contract (SAC)
        let native_token_str = String::from_str(env, "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC");
        let native_token_address = Address::from_string(&native_token_str);
        let native_token_client = token::Client::new(env, &native_token_address);
        native_token_client.transfer(
            &env.current_contract_address(),
            &beneficiary_addr,
            &amount,
        );
    }

    // Update reputation
    if escrow.total_amount >= MIN_REP_ELIGIBLE_ESCROW_VALUE {
        update_reputation(env, beneficiary_addr.clone(), REPUTATION_PER_MILESTONE);
    }

    // Check if escrow is complete
    if escrow.paid_amount == escrow.total_amount {
        escrow.status = EscrowStatus::Released;
        if escrow.total_amount >= MIN_REP_ELIGIBLE_ESCROW_VALUE {
            update_reputation(env, beneficiary_addr.clone(), REPUTATION_PER_ESCROW);
            update_reputation(env, escrow.depositor.clone(), REPUTATION_PER_ESCROW);
            
            // Update completed escrows count
            let beneficiary_completed: u32 = env
                .storage()
                .instance()
                .get(&DataKey::CompletedEscrows(beneficiary_addr.clone()))
                .unwrap_or(0);
            env.storage()
                .instance()
                .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
            env.storage()
                .instance()
                .set(
                    &DataKey::CompletedEscrows(beneficiary_addr.clone()),
                    &(beneficiary_completed + 1),
                );
            
            let depositor_completed: u32 = env
                .storage()
                .instance()
                .get(&DataKey::CompletedEscrows(escrow.depositor.clone()))
                .unwrap_or(0);
            env.storage()
                .instance()
                .set(
                    &DataKey::CompletedEscrows(escrow.depositor.clone()),
                    &(depositor_completed + 1),
                );
        }
    }

    // Save milestone and escrow
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage()
        .instance()
        .set(&DataKey::Milestone(escrow_id, milestone_index), &milestone);
    escrow_core::save_escrow(env, escrow_id, &escrow);
    
    Ok(())
}

fn update_reputation(env: &Env, user: Address, points: u32) {
    let current_rep: u32 = env
        .storage()
        .instance()
        .get(&DataKey::Reputation(user.clone()))
        .unwrap_or(0);
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage()
        .instance()
        .set(&DataKey::Reputation(user), &(current_rep + points));
}

