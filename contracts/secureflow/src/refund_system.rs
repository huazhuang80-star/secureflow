use crate::escrow_core;
use crate::storage_types::{DataKey, EscrowStatus, SecureFlowError, INSTANCE_BUMP_AMOUNT, INSTANCE_LIFETIME_THRESHOLD};
use soroban_sdk::{token, Address, Env, Error, String};

const EMERGENCY_REFUND_DELAY: u32 = 2592000; // 30 days in seconds

pub fn refund_escrow(env: &Env, escrow_id: u32, depositor: Address) -> Result<(), Error> {
    depositor.require_auth();

    escrow_core::require_valid_escrow(env, escrow_id)?;
    let mut escrow = escrow_core::get_escrow(env, escrow_id)
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::EscrowNotFound as u32))?;

    if escrow.depositor != depositor {
        return Err(Error::from_contract_error(SecureFlowError::OnlyDepositor as u32));
    }

    if escrow.status != EscrowStatus::Pending {
        return Err(Error::from_contract_error(SecureFlowError::InvalidEscrowStatus as u32));
    }

    if escrow.work_started {
        return Err(Error::from_contract_error(SecureFlowError::WorkAlreadyStarted as u32));
    }

    let current_ledger = env.ledger().sequence();
    if current_ledger >= escrow.deadline {
        return Err(Error::from_contract_error(SecureFlowError::DeadlineNotPassed as u32));
    }

    let refund_amount = escrow.total_amount - escrow.paid_amount;
    if refund_amount <= 0 {
        return Err(Error::from_contract_error(SecureFlowError::NothingToRefund as u32));
    }

    escrow.status = EscrowStatus::Refunded;

    // Update escrowed amount
    let token_key = escrow.token.clone().unwrap_or_else(|| env.current_contract_address());
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
            &(current_escrowed - refund_amount),
        );

    // Transfer refund
    if let Some(token_addr) = escrow.token.clone() {
        let token_client = token::Client::new(env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &depositor, &refund_amount);
    } else {
        // Transfer native XLM refund using Stellar Asset Contract (SAC)
        let native_token_str = String::from_str(env, "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC");
        let native_token_address = Address::from_string(&native_token_str);
        let native_token_client = token::Client::new(env, &native_token_address);
        native_token_client.transfer(
            &env.current_contract_address(),
            &depositor,
            &refund_amount,
        );
    }

    escrow_core::save_escrow(env, escrow_id, &escrow);
    Ok(())
}

pub fn emergency_refund_after_deadline(env: &Env, escrow_id: u32, depositor: Address) -> Result<(), Error> {
    depositor.require_auth();

    escrow_core::require_valid_escrow(env, escrow_id)?;
    let mut escrow = escrow_core::get_escrow(env, escrow_id)
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::EscrowNotFound as u32))?;

    if escrow.depositor != depositor {
        return Err(Error::from_contract_error(SecureFlowError::OnlyDepositor as u32));
    }

    let current_ledger = env.ledger().sequence();
    if current_ledger <= escrow.deadline + EMERGENCY_REFUND_DELAY {
        return Err(Error::from_contract_error(SecureFlowError::EmergencyPeriodNotReached as u32));
    }

    if escrow.status == EscrowStatus::Released || escrow.status == EscrowStatus::Refunded {
        return Err(Error::from_contract_error(SecureFlowError::CannotRefund as u32));
    }

    let refund_amount = escrow.total_amount - escrow.paid_amount;
    if refund_amount <= 0 {
        return Err(Error::from_contract_error(SecureFlowError::NothingToRefund as u32));
    }

    escrow.status = EscrowStatus::Expired;

    // Update escrowed amount
    let token_key = escrow.token.clone().unwrap_or_else(|| env.current_contract_address());
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
            &(current_escrowed - refund_amount),
        );

    // Transfer refund
    if let Some(token_addr) = escrow.token.clone() {
        let token_client = token::Client::new(env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &depositor, &refund_amount);
    } else {
        // Native XLM refund
    }

    escrow_core::save_escrow(env, escrow_id, &escrow);
    Ok(())
}

pub fn extend_deadline(env: &Env, escrow_id: u32, depositor: Address, extra_seconds: u32) -> Result<(), Error> {
    depositor.require_auth();

    if extra_seconds == 0 || extra_seconds > 2592000 {
        // Max 30 days
        return Err(Error::from_contract_error(SecureFlowError::InvalidExtension as u32));
    }

    escrow_core::require_valid_escrow(env, escrow_id)?;
    let mut escrow = escrow_core::get_escrow(env, escrow_id)
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::EscrowNotFound as u32))?;

    if escrow.depositor != depositor {
        return Err(Error::from_contract_error(SecureFlowError::OnlyDepositor as u32));
    }

    if escrow.status != EscrowStatus::InProgress && escrow.status != EscrowStatus::Pending {
        return Err(Error::from_contract_error(SecureFlowError::CannotExtend as u32));
    }

    escrow.deadline += extra_seconds as u32;
    escrow_core::save_escrow(env, escrow_id, &escrow);
    Ok(())
}

