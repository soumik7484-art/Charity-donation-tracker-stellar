#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, Env, String, Vec, vec,
};

/// ── Data Types ───────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Milestone {
    pub index: u32,
    pub title: String,
    pub amount: i128,      // portion of funds requested
    pub approved: bool,    // approved by Admin
    pub claimed: bool,     // claimed by Creator
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Campaign {
    pub id: u32,
    pub creator: Address,
    pub admin: Address,    // admin who approves milestones
    pub title: String,
    pub goal: i128,        // in XLM
    pub raised: i128,      // in XLM
    pub deadline: u32,     // ledger sequence when campaign expires
    pub claimed: bool,     // overall claim status
    pub milestones: Vec<Milestone>,
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
    pub fn create_campaign(
        env: Env,
        creator: Address,
        admin: Address,
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
            admin,
            title,
            goal,
            raised: 0,
            deadline,
            claimed: false,
            milestones: Vec::new(&env),
        };

        env.storage()
            .instance()
            .set(&DataKey::Campaign(id), &campaign);
        env.storage().instance().set(&DataKey::Count, &id);
        env.storage().instance().extend_ttl(200_000, 200_000);

        id
    }

    /// Record a donation amount for a campaign.
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

    /// Add a milestone to the campaign (can only be done by NGO/Creator).
    pub fn create_milestone(env: Env, campaign_id: u32, title: String, amount: i128) -> u32 {
        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        campaign.creator.require_auth();
        assert!(amount > 0, "Milestone amount must be positive");

        // Verify total milestones doesn't exceed goal
        let mut current_total = 0;
        let milestone_count = campaign.milestones.len();
        for i in 0..milestone_count {
            if let Some(m) = campaign.milestones.get(i) {
                current_total += m.amount;
            }
        }
        assert!(current_total + amount <= campaign.goal, "Milestones total exceeds campaign goal");

        let new_m = Milestone {
            index: milestone_count,
            title,
            amount,
            approved: false,
            claimed: false,
        };

        campaign.milestones.push_back(new_m);

        env.storage()
            .instance()
            .set(&DataKey::Campaign(campaign_id), &campaign);

        milestone_count
    }

    /// Admin approves a milestone.
    pub fn approve_milestone(env: Env, campaign_id: u32, milestone_index: u32) {
        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        campaign.admin.require_auth();

        let mut milestone = campaign.milestones.get(milestone_index).expect("Milestone not found");
        assert!(!milestone.approved, "Milestone already approved");

        milestone.approved = true;
        campaign.milestones.set(milestone_index, milestone);

        env.storage()
            .instance()
            .set(&DataKey::Campaign(campaign_id), &campaign);
    }

    /// Creator claims the funds for an approved milestone.
    pub fn claim_milestone(env: Env, campaign_id: u32, milestone_index: u32) {
        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        campaign.creator.require_auth();

        let mut milestone = campaign.milestones.get(milestone_index).expect("Milestone not found");
        assert!(milestone.approved, "Milestone must be approved by admin");
        assert!(!milestone.claimed, "Milestone already claimed");

        milestone.claimed = true;
        campaign.milestones.set(milestone_index, milestone);

        env.storage()
            .instance()
            .set(&DataKey::Campaign(campaign_id), &campaign);
    }

    /// Overall claim (fallback for backward compatibility).
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

    /// Refund function if campaign failed (deadline has passed and goal not met).
    pub fn refund_campaign(env: Env, campaign_id: u32) {
        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        assert!(
            env.ledger().sequence() > campaign.deadline,
            "Campaign has not expired yet"
        );
        assert!(campaign.raised < campaign.goal, "Campaign succeeded, cannot refund");

        // Mark as claimed to prevent further actions
        campaign.claimed = true;
        campaign.raised = 0; // reset raised on-chain

        env.storage()
            .instance()
            .set(&DataKey::Campaign(campaign_id), &campaign);
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
