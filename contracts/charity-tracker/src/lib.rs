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
    pub amount: i128,       // portion of funds requested
    pub approved: bool,     // approved by Admin
    pub claimed: bool,      // claimed by Creator
    pub proof_cid: String,  // IPFS CID of proof document/image
    pub proof_submitted: bool, // whether creator has submitted proof
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Campaign {
    pub id: u32,
    pub creator: Address,
    pub admin: Address,        // admin who approves milestones
    pub title: String,
    pub goal: i128,            // in XLM
    pub raised: i128,          // in XLM
    pub deadline: u32,         // ledger sequence when campaign expires
    pub claimed: bool,         // overall claim status
    pub milestones: Vec<Milestone>,
    pub verified: bool,        // ✅ verified charity badge
}

#[contracttype]
pub enum DataKey {
    Campaign(u32),
    Count,
    DonorAmount(u32, Address),  // per-campaign donor contribution map
    VerifiedCreator(Address),   // admin-gated verified creator allowlist
    ContractAdmin,              // global admin address
}

/// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct CharityTracker;

#[contractimpl]
impl CharityTracker {

    /// Initialize contract with a global admin (call once after deploy).
    pub fn init(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::ContractAdmin, &admin);
        env.storage().instance().extend_ttl(200_000, 200_000);
    }

    /// Get global admin address.
    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::ContractAdmin)
            .expect("Contract not initialized — call init() first")
    }

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

        // Check if creator is verified
        let verified: bool = env
            .storage()
            .instance()
            .get(&DataKey::VerifiedCreator(creator.clone()))
            .unwrap_or(false);

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
            verified,
        };

        env.storage()
            .instance()
            .set(&DataKey::Campaign(id), &campaign);
        env.storage().instance().set(&DataKey::Count, &id);
        env.storage().instance().extend_ttl(200_000, 200_000);

        id
    }

    /// Record a donation amount for a campaign (basic version — no per-donor tracking).
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

    /// Donate with per-donor tracking (enables individual refunds).
    pub fn donate_tracked(env: Env, campaign_id: u32, donor: Address, amount: i128) {
        donor.require_auth();
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

        // Update campaign raised total
        campaign.raised += amount;
        env.storage()
            .instance()
            .set(&DataKey::Campaign(campaign_id), &campaign);

        // Track donor's individual contribution
        let existing: i128 = env
            .storage()
            .instance()
            .get(&DataKey::DonorAmount(campaign_id, donor.clone()))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::DonorAmount(campaign_id, donor), &(existing + amount));
        env.storage().instance().extend_ttl(200_000, 200_000);
    }

    /// Get a donor's contribution for a specific campaign.
    pub fn get_donor_contribution(env: Env, campaign_id: u32, donor: Address) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::DonorAmount(campaign_id, donor))
            .unwrap_or(0)
    }

    /// Claim refund — if deadline passed and goal not met, donor withdraws their contribution.
    pub fn claim_refund(env: Env, campaign_id: u32, donor: Address) -> i128 {
        donor.require_auth();

        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        assert!(
            env.ledger().sequence() > campaign.deadline,
            "Campaign has not expired yet"
        );
        assert!(
            campaign.raised < campaign.goal,
            "Campaign succeeded — no refund available"
        );
        assert!(!campaign.claimed, "Campaign already fully claimed/refunded");

        let contribution: i128 = env
            .storage()
            .instance()
            .get(&DataKey::DonorAmount(campaign_id, donor.clone()))
            .unwrap_or(0);

        assert!(contribution > 0, "No contribution found for this donor");

        // Zero out donor's contribution to prevent double-claim
        env.storage()
            .instance()
            .set(&DataKey::DonorAmount(campaign_id, donor), &0i128);

        // Reduce raised total
        campaign.raised -= contribution;
        env.storage()
            .instance()
            .set(&DataKey::Campaign(campaign_id), &campaign);
        env.storage().instance().extend_ttl(200_000, 200_000);

        // Return amount so the frontend knows how much was refunded
        contribution
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
        let mut current_total: i128 = 0;
        let milestone_count = campaign.milestones.len();
        for i in 0..milestone_count {
            if let Some(m) = campaign.milestones.get(i) {
                current_total += m.amount;
            }
        }
        assert!(
            current_total + amount <= campaign.goal,
            "Milestones total exceeds campaign goal"
        );

        let new_m = Milestone {
            index: milestone_count,
            title,
            amount,
            approved: false,
            claimed: false,
            proof_cid: String::from_str(&env, ""),
            proof_submitted: false,
        };

        campaign.milestones.push_back(new_m);

        env.storage()
            .instance()
            .set(&DataKey::Campaign(campaign_id), &campaign);

        milestone_count
    }

    /// Creator submits IPFS proof CID before requesting admin approval.
    pub fn submit_proof(
        env: Env,
        campaign_id: u32,
        milestone_index: u32,
        creator: Address,
        cid: String,
    ) {
        creator.require_auth();

        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        // Must be the campaign creator
        assert!(
            campaign.creator == creator,
            "Only the campaign creator can submit proof"
        );

        let mut milestone = campaign
            .milestones
            .get(milestone_index)
            .expect("Milestone not found");

        assert!(!milestone.approved, "Milestone already approved — cannot change proof");
        assert!(!milestone.claimed, "Milestone already claimed");

        milestone.proof_cid = cid;
        milestone.proof_submitted = true;
        campaign.milestones.set(milestone_index, milestone);

        env.storage()
            .instance()
            .set(&DataKey::Campaign(campaign_id), &campaign);
        env.storage().instance().extend_ttl(200_000, 200_000);
    }

    /// Admin approves a milestone (requires proof to have been submitted first).
    pub fn approve_milestone(env: Env, campaign_id: u32, milestone_index: u32) {
        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&DataKey::Campaign(campaign_id))
            .expect("Campaign not found");

        campaign.admin.require_auth();

        let mut milestone = campaign
            .milestones
            .get(milestone_index)
            .expect("Milestone not found");

        assert!(
            milestone.proof_submitted,
            "Creator must submit proof before admin can approve"
        );
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

        let mut milestone = campaign
            .milestones
            .get(milestone_index)
            .expect("Milestone not found");

        assert!(milestone.approved, "Milestone must be approved by admin");
        assert!(!milestone.claimed, "Milestone already claimed");

        milestone.claimed = true;
        campaign.milestones.set(milestone_index, milestone);

        env.storage()
            .instance()
            .set(&DataKey::Campaign(campaign_id), &campaign);
    }

    /// Overall claim (backward compatibility — marks campaign as done).
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

    /// Refund campaign if failed (deadline passed + goal not met). Marks as refundable.
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

        campaign.claimed = true;
        campaign.raised = 0;

        env.storage()
            .instance()
            .set(&DataKey::Campaign(campaign_id), &campaign);
    }

    /// ── Verified Creator System ───────────────────────────────────────────────

    /// Admin adds a verified creator (shows ✅ badge on their campaigns).
    pub fn add_verified_creator(env: Env, admin: Address, creator: Address) {
        admin.require_auth();

        // Must be called by the contract's global admin
        let contract_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::ContractAdmin)
            .expect("Contract not initialized");

        assert!(admin == contract_admin, "Only the contract admin can verify creators");

        env.storage()
            .instance()
            .set(&DataKey::VerifiedCreator(creator), &true);
        env.storage().instance().extend_ttl(200_000, 200_000);
    }

    /// Admin removes a verified creator.
    pub fn remove_verified_creator(env: Env, admin: Address, creator: Address) {
        admin.require_auth();

        let contract_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::ContractAdmin)
            .expect("Contract not initialized");

        assert!(admin == contract_admin, "Only the contract admin can modify creator list");

        env.storage()
            .instance()
            .set(&DataKey::VerifiedCreator(creator), &false);
    }

    /// Check if a creator address is verified.
    pub fn is_verified_creator(env: Env, creator: Address) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::VerifiedCreator(creator))
            .unwrap_or(false)
    }

    /// ── Read Functions ────────────────────────────────────────────────────────

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
