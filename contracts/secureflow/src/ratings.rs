use crate::storage_types::{
    DataKey, EscrowStatus, Rating, ClientRatingData, Badge, SecureFlowError, INSTANCE_BUMP_AMOUNT, INSTANCE_LIFETIME_THRESHOLD,
};
use crate::escrow_core;
use soroban_sdk::{Address, Env, String, Error};

/// Submit a rating for a completed escrow
/// Only the depositor (client) can rate the freelancer
pub fn submit_rating(
    env: &Env,
    escrow_id: u32,
    rating: u32,
    review: String,
    client: Address,
) -> Result<(), Error> {
    client.require_auth();

    // Validate rating (1-5)
    if rating < 1 || rating > 5 {
        return Err(Error::from_contract_error(SecureFlowError::InvalidRating as u32));
    }

    // Validate escrow exists
    escrow_core::require_valid_escrow(env, escrow_id)?;
    let escrow = escrow_core::get_escrow(env, escrow_id)
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::EscrowNotFound as u32))?;

    // Check if client is the depositor
    if escrow.depositor != client {
        return Err(Error::from_contract_error(SecureFlowError::OnlyDepositorCanRate as u32));
    }

    // Check if escrow is completed (Released status)
    if escrow.status != EscrowStatus::Released {
        return Err(Error::from_contract_error(SecureFlowError::EscrowNotCompleted as u32));
    }

    // Check if rating already exists
    let rating_key = DataKey::Rating(escrow_id);
    if env.storage().instance().has(&rating_key) {
        return Err(Error::from_contract_error(SecureFlowError::RatingAlreadySubmitted as u32));
    }

    // Get freelancer address
    let freelancer = escrow.beneficiary
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::EscrowNotFound as u32))?;

    // Create rating
    let rating_data = Rating {
        escrow_id,
        freelancer: freelancer.clone(),
        client: client.clone(),
        rating,
        review,
        rated_at: env.ledger().sequence(),
    };

    // Save rating
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage()
        .instance()
        .set(&rating_key, &rating_data);

    // Update freelancer's average rating
    update_average_rating(env, &freelancer, rating);

    Ok(())
}

/// Update average rating for a freelancer
fn update_average_rating(env: &Env, freelancer: &Address, new_rating: u32) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);

    // Get current average (stored as (total_rating, count))
    let avg_key = DataKey::AverageRating(freelancer.clone());
    let current: (u32, u32) = env
        .storage()
        .instance()
        .get(&avg_key)
        .unwrap_or((0, 0));

    let new_total = current.0 + new_rating;
    let new_count = current.1 + 1;

    env.storage()
        .instance()
        .set(&avg_key, &(new_total, new_count));
}

/// Get rating for an escrow
pub fn get_rating(env: &Env, escrow_id: u32) -> Option<Rating> {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage()
        .instance()
        .get(&DataKey::Rating(escrow_id))
}

/// Get average rating for a freelancer
pub fn get_average_rating(env: &Env, freelancer: Address) -> (u32, u32) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage()
        .instance()
        .get(&DataKey::AverageRating(freelancer))
        .unwrap_or((0, 0))
}

/// Get badge for a freelancer based on completed projects
pub fn get_badge(env: &Env, freelancer: Address) -> Badge {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    
    let completed: u32 = env
        .storage()
        .instance()
        .get(&DataKey::CompletedEscrows(freelancer))
        .unwrap_or(0);

    match completed {
        0..=4 => Badge::Beginner,
        5..=14 => Badge::Intermediate,
        15..=49 => Badge::Advanced,
        _ => Badge::Expert,
    }
}

/// Submit a rating for the client by the freelancer after escrow completion
pub fn submit_client_rating(
    env: &Env,
    escrow_id: u32,
    rating: u32,
    review: String,
    freelancer: Address,
) -> Result<(), Error> {
    freelancer.require_auth();

    if rating < 1 || rating > 5 {
        return Err(Error::from_contract_error(SecureFlowError::InvalidRating as u32));
    }

    escrow_core::require_valid_escrow(env, escrow_id)?;
    let escrow = escrow_core::get_escrow(env, escrow_id)
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::EscrowNotFound as u32))?;

    // Only the beneficiary (freelancer) can rate the client
    let beneficiary = escrow.beneficiary
        .ok_or_else(|| Error::from_contract_error(SecureFlowError::EscrowNotFound as u32))?;
    if beneficiary != freelancer {
        return Err(Error::from_contract_error(SecureFlowError::OnlyBeneficiaryCanRate as u32));
    }

    // Escrow must be completed
    if escrow.status != EscrowStatus::Released {
        return Err(Error::from_contract_error(SecureFlowError::EscrowNotCompleted as u32));
    }

    // Prevent duplicate rating
    let rating_key = DataKey::ClientRating(escrow_id);
    if env.storage().instance().has(&rating_key) {
        return Err(Error::from_contract_error(SecureFlowError::ClientRatingAlreadySubmitted as u32));
    }

    let rating_data = ClientRatingData {
        escrow_id,
        client: escrow.depositor.clone(),
        freelancer: freelancer.clone(),
        rating,
        review,
        rated_at: env.ledger().sequence(),
    };

    env.storage().instance().extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage().instance().set(&rating_key, &rating_data);

    // Update client's average rating
    update_average_client_rating(env, &escrow.depositor, rating);

    Ok(())
}

/// Update rolling average client rating
fn update_average_client_rating(env: &Env, client: &Address, new_rating: u32) {
    env.storage().instance().extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    let key = DataKey::AverageClientRating(client.clone());
    let current: (u32, u32) = env.storage().instance().get(&key).unwrap_or((0, 0));
    env.storage().instance().set(&key, &(current.0 + new_rating, current.1 + 1));
}

/// Get client rating for an escrow (set by freelancer)
pub fn get_client_rating(env: &Env, escrow_id: u32) -> Option<ClientRatingData> {
    env.storage().instance().extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage().instance().get(&DataKey::ClientRating(escrow_id))
}

/// Get average rating for a client address
pub fn get_average_client_rating(env: &Env, client: Address) -> (u32, u32) {
    env.storage().instance().extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage().instance().get(&DataKey::AverageClientRating(client)).unwrap_or((0, 0))
}

/// Get completed escrows count for a user
pub fn get_completed_escrows(env: &Env, user: Address) -> u32 {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
    env.storage()
        .instance()
        .get(&DataKey::CompletedEscrows(user))
        .unwrap_or(0)
}

