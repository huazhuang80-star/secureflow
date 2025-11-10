use crate::admin;
use crate::escrow_core;
use crate::storage_types::{Application, DataKey, EscrowStatus, SecureFlowError, INSTANCE_BUMP_AMOUNT, INSTANCE_LIFETIME_THRESHOLD};
use soroban_sdk::{Env, Address, String, Error};

const MAX_APPLICATIONS: u32 = 50;

pub fn apply_to_job(
    env: &Env,
    escrow_id: u32,
    freelancer: Address,
    cover_letter: String,
    proposed_timeline: u32,
) -> Result<(), Error> {
    // Require auth from the freelancer address
    // The freelancer must sign the transaction
    freelancer.require_auth();

    // Check if job creation is paused
    if admin::is_job_creation_paused(env) {
        return Err(Error::from_contract_error(SecureFlowError::JobCreationPaused as u32));
    }

    // Validate escrow
    escrow_core::require_valid_escrow(env, escrow_id)?;
    let escrow = escrow_core::get_escrow(env, escrow_id)
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::EscrowNotFound as u32))?;

    // Validate escrow is an open job
    if !escrow.is_open_job {
        return Err(Error::from_contract_error(SecureFlowError::NotOpenJob as u32));
    }

    if escrow.status != EscrowStatus::Pending {
        return Err(Error::from_contract_error(SecureFlowError::JobClosed as u32));
    }

    if escrow.depositor == freelancer {
        return Err(Error::from_contract_error(SecureFlowError::CannotApplyToOwnJob as u32));
    }

    // Check if already applied
    // TODO: Implement has_applied check

    // Get current application count
    let application_count = 0u32;
    // Count applications (simplified - would need to track this better)
    
    if application_count >= MAX_APPLICATIONS {
        return Err(Error::from_contract_error(SecureFlowError::TooManyApplications as u32));
    }

    // Create application
    let application = Application {
        freelancer: freelancer.clone(),
        cover_letter,
        proposed_timeline,
        applied_at: env.ledger().sequence(),
    };

    // Save application
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage()
        .instance()
        .set(&DataKey::Application(escrow_id, application_count), &application);
    
    Ok(())
}

pub fn accept_freelancer(env: &Env, escrow_id: u32, depositor: Address, freelancer: Address) -> Result<(), Error> {
    depositor.require_auth();

    escrow_core::require_valid_escrow(env, escrow_id)?;
    let mut escrow = escrow_core::get_escrow(env, escrow_id)
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::EscrowNotFound as u32))?;

    if escrow.depositor != depositor {
        return Err(Error::from_contract_error(SecureFlowError::OnlyDepositor as u32));
    }

    if !escrow.is_open_job {
        return Err(Error::from_contract_error(SecureFlowError::NotOpenJob as u32));
    }

    if escrow.status != EscrowStatus::Pending {
        return Err(Error::from_contract_error(SecureFlowError::JobClosed as u32));
    }

    // TODO: Check if freelancer applied

    // Accept freelancer
    escrow.beneficiary = Some(freelancer.clone());
    escrow.is_open_job = false;

    // Save updated escrow
    escrow_core::save_escrow(env, escrow_id, &escrow);

    // Add to user escrows
    escrow_core::add_user_escrow(env, freelancer, escrow_id);
    
    Ok(())
}

