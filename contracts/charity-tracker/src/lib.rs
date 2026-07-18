#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, Env, String, Vec, vec,
};

/// ── Data Types ───────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Campaign {
    pub id: u32,
    pub creator: Address,
    pub title: String,
    pub goal: i128,       // in XLM (whole units, e.g. 5000 = 5000 XLM)
    pub raised: i128,     // in XLM
    pub deadline: u32,    // ledger sequence number when campaign expires
    pub claimed: bool,
}

#[contracttype]
pub enum DataKey {
    Campaign(u32),
    Count,
}

/// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct CharityTracker;

#[contractimpl]
impl CharityTracker {
    /// Create a new fundraising campaign.
    /// `duration_ledgers`: roughly 6s per ledger (~14400 ledgers/day).
    pub fn create_campaign(
        env: Env,
        creator: Address,
        title: String,
        goal: i128,
        duration_ledgers: u32,
    ) -> u32 {
        creator.require_auth();

        assert!(goal > 0, "Goal must be positive");
        assert!(duration_ledgers > 0, "Duration must be positive");

        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Count)
            .unwrap_or(0);
        let id = count + 1;

        let deadline = env.ledger().sequence() + duration_ledgers;

        let campaign = Campaign {
            id,
            creator,
            title,
            goal,
            raised: 0,
            deadline,
            claimed: false,
        };

        env.storage()
            .instance()
            .set(&DataKey::Campaign(id), &campaign);
        env.storage().instance().set(&DataKey::Count, &id);
        env.storage().instance().extend_ttl(200_000, 200_000);

        id
    }

    /// Record a donation amount for a campaign (on-chain ledger entry).
    /// No auth required – anyone can donate.
    pub fn donate(env: Env, campaign_id: u32, amount: i128) {
        assert!(amount > 0, "Amount must be positive");

        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        assert!(!campaign.claimed, "Campaign already claimed");
        assert!(
            env.ledger().sequence() <= campaign.deadline,
            "Campaign deadline has passed"
        );

        campaign.raised += amount;

        env.storage()
            .instance()
            .set(&DataKey::Campaign(campaign_id), &campaign);
        env.storage().instance().extend_ttl(200_000, 200_000);
    }

    /// Creator claims the campaign (marks as funded).
    /// Requires creator's signature.
    pub fn claim(env: Env, campaign_id: u32) {
        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        campaign.creator.require_auth();
        assert!(campaign.raised >= campaign.goal, "Goal not reached yet");
        assert!(!campaign.claimed, "Already claimed");

        campaign.claimed = true;

        env.storage()
            .instance()
            .set(&DataKey::Campaign(campaign_id), &campaign);
        env.storage().instance().extend_ttl(200_000, 200_000);
    }

    /// Fetch a single campaign by ID.
    pub fn get_campaign(env: Env, campaign_id: u32) -> Campaign {
        env.storage()
            .instance()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found")
    }

    /// Total number of campaigns created.
    pub fn get_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Count)
            .unwrap_or(0)
    }

    /// Fetch all campaigns as a Vec.
    pub fn get_all(env: Env) -> Vec<Campaign> {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Count)
            .unwrap_or(0);

        let mut result = vec![&env];
        let mut i = 1u32;
        while i <= count {
            if let Some(c) = env
                .storage()
                .instance()
                .get::<DataKey, Campaign>(&DataKey::Campaign(i))
            {
                result.push_back(c);
            }
            i += 1;
        }
        result
    }
}
