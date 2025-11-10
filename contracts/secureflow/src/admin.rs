use crate::storage_types::{DataKey, SecureFlowError, INSTANCE_BUMP_AMOUNT, INSTANCE_LIFETIME_THRESHOLD};
use soroban_sdk::{Address, Env, Error};

pub fn initialize(env: &Env, owner: Address, fee_collector: Address, platform_fee_bp: u32) -> Result<(), Error> {
    // Check if already initialized
    if env.storage().instance().has(&DataKey::Owner) {
        return Err(Error::from_contract_error(SecureFlowError::AlreadyInitialized as u32));
    }

    // Validate parameters
    if platform_fee_bp > 1000 {
        // Max 10% (1000 basis points)
        return Err(Error::from_contract_error(SecureFlowError::FeeTooHigh as u32));
    }

    // Extend instance TTL
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);

    // Set initial state
    env.storage().instance().set(&DataKey::Owner, &owner);
    env.storage()
        .instance()
        .set(&DataKey::FeeCollector, &fee_collector);
    env.storage()
        .instance()
        .set(&DataKey::PlatformFeeBP, &platform_fee_bp);
    env.storage().instance().set(&DataKey::NextEscrowId, &1u32);
    env.storage()
        .instance()
        .set(&DataKey::JobCreationPaused, &false);
    
    Ok(())
}

pub fn get_owner(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Owner)
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::NotInitialized as u32))
}

pub fn require_owner(env: &Env) -> Result<(), Error> {
    let owner = get_owner(env)?;
    owner.require_auth();
    Ok(())
}

#[allow(dead_code)]
pub fn get_fee_collector(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::FeeCollector)
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::NotInitialized as u32))
}

pub fn get_platform_fee_bp(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&DataKey::PlatformFeeBP)
        .unwrap_or(0)
}

pub fn set_platform_fee_bp(env: &Env, fee_bp: u32) -> Result<(), Error> {
    require_owner(env)?;
    if fee_bp > 1000 {
        return Err(Error::from_contract_error(SecureFlowError::FeeTooHigh as u32));
    }
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage().instance().set(&DataKey::PlatformFeeBP, &fee_bp);
    Ok(())
}

pub fn set_fee_collector(env: &Env, fee_collector: Address) -> Result<(), Error> {
    require_owner(env)?;
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage()
        .instance()
        .set(&DataKey::FeeCollector, &fee_collector);
    Ok(())
}

pub fn set_owner(env: &Env, new_owner: Address) -> Result<(), Error> {
    require_owner(env)?;
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage()
        .instance()
        .set(&DataKey::Owner, &new_owner);
    Ok(())
}

pub fn is_job_creation_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::JobCreationPaused)
        .unwrap_or(false)
}

#[allow(dead_code)]
pub fn set_job_creation_paused(env: &Env, paused: bool) -> Result<(), Error> {
    require_owner(env)?;
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage()
        .instance()
        .set(&DataKey::JobCreationPaused, &paused);
    Ok(())
}

