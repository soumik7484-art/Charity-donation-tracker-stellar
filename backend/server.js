const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./db');

dotenv.config({ path: require('path').join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Initialize DB
db.connectDB().then(() => {
  console.log(`Database initialized in [${db.getMode()}] mode`);
});

const { Groq } = require('groq-sdk');

// Instantiate Groq Client securely (API key loaded from environmental variables or secure runtime fallback)
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || ''
});

// Dynamic AI LLM & Heuristic Fraud Detection Helper function
async function runFraudCheck(donation, allDonations) {
  const { sender, amount, campaignId } = donation;
  let score = 0;
  let explanations = [];

  // Check 1: Suspiciously large donation
  if (amount > 500) {
    score += 35;
    explanations.push(`Very large donation size (${amount} XLM) relative to typical platform average.`);
  }

  // Check 2: Abnormal frequency (rapid transactions from same sender)
  const windowMs = 60 * 1000; // 1 minute window
  const recentDonations = allDonations.filter(d => 
    d.sender === sender && 
    (new Date() - new Date(d.timestamp)) < windowMs
  );
  if (recentDonations.length >= 3) {
    score += 40;
    explanations.push(`High transaction velocity: ${recentDonations.length + 1} donations detected within 1 minute.`);
  }

  // Check 3: Duplicate transaction detection
  const duplicate = allDonations.find(d => 
    d.sender === sender && 
    d.amount === amount && 
    d.campaignId === campaignId && 
    (new Date() - new Date(d.timestamp)) < 15000 // 15 seconds
  );
  if (duplicate) {
    score += 25;
    explanations.push(`Possible duplicate submission within 15 seconds (same amount: ${amount} XLM).`);
  }

  // Check 4: Wallet Reputation check (Frozen or marked list)
  const settings = db.get('settings') || { frozenAccounts: [] };
  const frozenList = settings.frozenAccounts || [];
  if (frozenList.includes(sender)) {
    score = 100;
    explanations.push(`Wallet ${sender} is currently frozen by administration.`);
  }

  let riskLevel = "Low";
  let action = "Auto-Approve";
  if (score >= 80) {
    riskLevel = "Critical";
    action = "Freeze Account & Hold Transaction";
  } else if (score >= 40) {
    riskLevel = "Medium";
    action = "Flag for Admin Manual Review";
  }

  if (explanations.length === 0) {
    explanations.push("Transaction shows regular parameters, standard velocity, and safe sender repute.");
  }

  // Enhance diagnostics with Groq Llama-3 model analysis if available
  let dynamicExplanation = explanations.join(" ");
  try {
    const prompt = `Analyze this blockchain donation for potential laundering, duplication, or velocity fraud.
Transaction details:
- Sender Wallet: ${sender}
- Campaign ID: ${campaignId}
- Amount: ${amount} XLM
- Heuristic Risk Score: ${score}
- Flags: ${explanations.join("; ")}

Write a concise 1-sentence risk summary for the administrator. Keep it under 25 words.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 45,
      temperature: 0.1
    });

    if (chatCompletion.choices[0]?.message?.content) {
      dynamicExplanation = `[Groq AI] ${chatCompletion.choices[0].message.content.trim()}`;
    }
  } catch (err) {
    console.error("Groq API error, falling back to heuristics:", err.message);
  }

  return {
    fraudScore: score,
    riskLevel,
    explanation: dynamicExplanation,
    recommendedAction: action
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// API ROUTES
// ───────────────────────────────────────────────────────────────────────────────

// 1. System Info
app.get('/api/info', (req, res) => {
  res.json({
    status: "Healthy",
    dbMode: db.getMode(),
    network: "Stellar Testnet",
    contracts: {
      charityTracker: "CBNOEZI2KQW2LT3PMYQLULE73YQ2RQMTMQNBQ5OJFYGUM2YGZ33QXXX6"
    }
  });
});

// 2. Campaigns API
app.get('/api/campaigns', (req, res) => {
  const campaigns = db.get('campaigns');
  res.json(campaigns);
});

app.post('/api/campaigns', (req, res) => {
  const { id, title, description, creator, goal, deadline, image, category } = req.body;
  const newCamp = {
    id: Number(id),
    title: title || "New Campaign",
    description: description || "No description provided.",
    creator: creator || "GD3HIWUDUIORRJEGMRZ6XNYEBU53XDIMUOEVMQOC5L2SFYTNQVQ5D6OB",
    goal: Number(goal) || 1000,
    raised: 0,
    deadline: Number(deadline) || 0,
    claimed: false,
    image: image || "🌱",
    category: category || "General",
    milestones: [
      { index: 0, title: "Milestone 1: Project Initiation", amount: Math.floor(goal * 0.4), approved: false, claimed: false },
      { index: 1, title: "Milestone 2: Execution Phase", amount: Math.floor(goal * 0.3), approved: false, claimed: false },
      { index: 2, title: "Milestone 3: Auditing & Wrap", amount: Math.floor(goal * 0.3), approved: false, claimed: false }
    ],
    utilizations: [],
    trustScore: 90
  };
  
  db.insert('campaigns', newCamp);

  // Push notification
  db.insert('notifications', {
    id: Date.now().toString(),
    type: "campaign",
    text: `New Campaign "${title}" was successfully launched on-chain!`,
    time: "Just now",
    read: false
  });

  res.json({ success: true, campaign: newCamp });
});

// 3. Admin: Update trust score or details
app.put('/api/campaigns/:id', (req, res) => {
  const id = Number(req.params.id);
  const updated = db.update('campaigns', c => c.id === id, c => ({ ...c, ...req.body }));
  res.json({ success: !!updated, campaign: updated });
});

// 4. Milestones & Escrow Escorting API
app.post('/api/campaigns/:id/milestones', (req, res) => {
  const id = Number(req.params.id);
  const { title, amount } = req.body;
  
  const camp = db.findOne('campaigns', c => c.id === id);
  if (!camp) return res.status(404).json({ error: "Campaign not found" });

  const newMilestone = {
    index: camp.milestones.length,
    title,
    amount: Number(amount),
    approved: false,
    claimed: false
  };

  const updated = db.update('campaigns', c => c.id === id, c => {
    c.milestones.push(newMilestone);
    return c;
  });

  res.json({ success: true, milestones: updated.milestones });
});

// Admin approves milestone (allows releasing escrow payout)
app.post('/api/campaigns/:id/milestones/:index/approve', (req, res) => {
  const id = Number(req.params.id);
  const mIndex = Number(req.params.index);

  const updated = db.update('campaigns', c => c.id === id, c => {
    if (c.milestones[mIndex]) {
      c.milestones[mIndex].approved = true;
    }
    return c;
  });

  if (!updated) return res.status(404).json({ error: "Campaign or milestone not found" });

  // Add notification
  db.insert('notifications', {
    id: Date.now().toString(),
    type: "milestone",
    text: `Milestone #${mIndex + 1} for "${updated.title}" was APPROVED by admin. Escrow release enabled.`,
    time: "Just now",
    read: false
  });

  res.json({ success: true, campaign: updated });
});

// NGO claims milestone payout
app.post('/api/campaigns/:id/milestones/:index/claim', (req, res) => {
  const id = Number(req.params.id);
  const mIndex = Number(req.params.index);

  const updated = db.update('campaigns', c => c.id === id, c => {
    const milestone = c.milestones[mIndex];
    if (milestone && milestone.approved && !milestone.claimed) {
      milestone.claimed = true;
      // Track actual utilization
      c.utilizations.push({
        amount: Math.floor(milestone.amount * 75), // Convert simulated value to INR equivalent if needed or keep standard
        category: "Milestone Payout",
        details: `Milestone: ${milestone.title}`
      });
    }
    return c;
  });

  if (!updated) return res.status(404).json({ error: "Failed to claim milestone. Check approval." });

  // Notify
  db.insert('notifications', {
    id: Date.now().toString(),
    type: "funds",
    text: `Funds released successfully for Milestones #${mIndex + 1} of "${updated.title}"`,
    time: "Just now",
    read: false
  });

  res.json({ success: true, campaign: updated });
});

// 5. Spend Reports & NGO Utilizations
app.post('/api/campaigns/:id/utilization', (req, res) => {
  const id = Number(req.params.id);
  const { amount, category, details } = req.body;

  const updated = db.update('campaigns', c => c.id === id, c => {
    c.utilizations.push({
      amount: Number(amount),
      category,
      details,
      timestamp: new Date().toISOString()
    });
    return c;
  });

  if (!updated) return res.status(404).json({ error: "Campaign not found" });
  res.json({ success: true, utilizations: updated.utilizations });
});

// 6. Record real-time on-chain donation & perform AI Fraud check
app.post('/api/donations', (req, res) => {
  const { txHash, blockNumber, amount, sender, receiver, campaignId, anonymous } = req.body;
  const donations = db.get('donations');

  const newDonation = {
    txHash: txHash || `mock-${Date.now().toString(16)}`,
    blockNumber: Number(blockNumber) || 3674629 + Math.floor(Math.random() * 50),
    timestamp: new Date().toISOString(),
    amount: Number(amount) || 1,
    sender: sender || "GD3HIWUDUIORRJEGMRZ6XNYEBU53XDIMUOEVMQOC5L2SFYTNQVQ5D6OB",
    receiver: receiver || "CBNOEZI2KQW2LT3PMYQLULE73YQ2RQMTMQNBQ5OJFYGUM2YGZ33QXXX6",
    campaignId: Number(campaignId) || 1,
    status: "Success",
    anonymous: !!anonymous
  };

  // Run AI Fraud analysis (asynchronously with Groq completions)
  runFraudCheck(newDonation, donations).then(fraudResults => {
    // If critical, flag but save. For demo hackathon purposes, we log it.
    const newAlert = {
      id: `alert-${Date.now()}`,
      txHash: newDonation.txHash,
      sender: newDonation.sender,
      amount: newDonation.amount,
      fraudScore: fraudResults.fraudScore,
      riskLevel: fraudResults.riskLevel,
      explanation: fraudResults.explanation,
      recommendedAction: fraudResults.recommendedAction,
      timestamp: new Date().toISOString()
    };

    db.insert('fraudAlerts', newAlert);
    db.insert('donations', newDonation);

    // Update campaign raised value locally if not synced
    db.update('campaigns', c => c.id === Number(campaignId), c => {
      c.raised += Number(amount);
      return c;
    });

    // Push notifications
    db.insert('notifications', {
      id: Date.now().toString(),
      type: "donation",
      text: `Donation of ${amount} XLM received! Risk: ${fraudResults.riskLevel} (Score: ${fraudResults.fraudScore})`,
      time: "Just now",
      read: false
    });

    if (fraudResults.riskLevel === 'Critical') {
      db.insert('notifications', {
        id: `crit-${Date.now()}`,
        type: "fraud",
        text: `⚠️ CRITICAL FRAUD ALERT: suspicious activity on wallet ${sender.slice(0, 8)}…`,
        time: "Just now",
        read: false
      });
    }

    res.json({ success: true, donation: newDonation, fraudAnalysis: fraudResults });
  }).catch(err => {
    console.error("Fraud analysis execution error:", err);
    res.status(500).json({ error: "Failed to run fraud checks" });
  });
})

// Redundant handler body removed during async refactor

app.get('/api/donations', (req, res) => {
  const donations = db.get('donations');
  res.json(donations);
});

// 7. Fraud Alerts API (Admin Panel monitor)
app.get('/api/admin/fraud', (req, res) => {
  const alerts = db.get('fraudAlerts');
  res.json(alerts);
});

// Admin freeze / unfreeze account
app.post('/api/admin/freeze', (req, res) => {
  const { walletAddress } = req.body;
  const settings = db.get('settings') || { frozenAccounts: [] };
  
  if (!settings.frozenAccounts.includes(walletAddress)) {
    settings.frozenAccounts.push(walletAddress);
  }
  db.set('settings', settings);

  res.json({ success: true, frozenAccounts: settings.frozenAccounts });
});

app.post('/api/admin/unfreeze', (req, res) => {
  const { walletAddress } = req.body;
  const settings = db.get('settings') || { frozenAccounts: [] };
  
  settings.frozenAccounts = settings.frozenAccounts.filter(a => a !== walletAddress);
  db.set('settings', settings);

  res.json({ success: true, frozenAccounts: settings.frozenAccounts });
});

app.get('/api/admin/settings', (req, res) => {
  const settings = db.get('settings') || { frozenAccounts: [] };
  res.json(settings);
});

// 8. NGOs Registry & Trust Score Card
app.get('/api/ngos', (req, res) => {
  const ngos = db.get('ngos');
  res.json(ngos);
});

app.post('/api/ngos/verify', (req, res) => {
  const { address, verified } = req.body;
  const updated = db.update('ngos', n => n.address === address, n => {
    n.verified = verified;
    n.trustScore = verified ? 95 : 60;
    return n;
  });
  res.json({ success: !!updated, ngo: updated });
});

// 9. Notifications API
app.get('/api/notifications', (req, res) => {
  const list = db.get('notifications');
  res.json(list);
});

app.post('/api/notifications/clear', (req, res) => {
  db.set('notifications', []);
  res.json({ success: true });
});

// 10. Dashboard Stats & Analytics Endpoint
app.get('/api/analytics', (req, res) => {
  const donations = db.get('donations');
  const campaigns = db.get('campaigns');
  const alerts = db.get('fraudAlerts');

  const totalDonated = donations.reduce((sum, d) => sum + d.amount, 0);
  const supportCount = [...new Set(donations.map(d => d.campaignId))].length;
  
  // Calculate category breakdown
  const categorySplit = {};
  campaigns.forEach(c => {
    categorySplit[c.category] = (categorySplit[c.category] || 0) + c.raised;
  });

  // Calculate monthly metrics
  const monthly = [
    { name: 'Jan', amount: Math.floor(totalDonated * 0.1) },
    { name: 'Feb', amount: Math.floor(totalDonated * 0.15) },
    { name: 'Mar', amount: Math.floor(totalDonated * 0.25) },
    { name: 'Apr', amount: Math.floor(totalDonated * 0.3) },
    { name: 'May', amount: Math.floor(totalDonated * 0.2) }
  ];

  res.json({
    totalDonated,
    campaignsSupported: supportCount,
    impactScore: Math.floor(totalDonated * 12.5),
    alertsCount: alerts.length,
    criticalAlerts: alerts.filter(a => a.riskLevel === 'Critical').length,
    categoryBreakdown: categorySplit,
    monthlyTimeline: monthly
  });
});

// AI Chatbot Assistant Endpoint powered by Groq Llama-3
app.post('/api/chat', async (req, res) => {
  const { message, chatHistory, userApiKey } = req.body;
  const clientKey = userApiKey || process.env.GROQ_API_KEY || '';

  try {
    const chatGroq = new Groq({ apiKey: clientKey });
    const systemPrompt = `You are the CharityChain AI Assistant. Answer questions about Web3, Stellar, Soroban contracts, campaigns, and donation security. Be concise and friendly.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(chatHistory || []).map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      })),
      { role: 'user', content: message }
    ];

    const completion = await chatGroq.chat.completions.create({
      messages,
      model: 'llama-3.3-70b-versatile',
      max_tokens: 150,
      temperature: 0.7
    });

    const reply = completion.choices[0]?.message?.content || "I couldn't process that query. Please make sure your Groq API key is valid.";
    res.json({ success: true, reply });
  } catch (err) {
    console.error("Groq Chatbot Error:", err.message);
    res.status(500).json({ error: "Failed to query Groq model. Check your API key." });
  }
});

// Dynamic AI Categorization Endpoint powered by Groq
app.post('/api/campaigns/classify', async (req, res) => {
  const { title, description, userApiKey } = req.body;
  const clientKey = userApiKey || process.env.GROQ_API_KEY || '';

  try {
    const classGroq = new Groq({ apiKey: clientKey });
    const prompt = `Classify this charity campaign into exactly one of these categories:
Environment, Health & Water, Education, Disaster Relief, Animals, Technology.
Title: "${title}"
Description: "${description}"

Response must be exactly the category name, nothing else.`;

    const completion = await classGroq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 10,
      temperature: 0.1
    });

    const category = completion.choices[0]?.message?.content?.trim() || "Environment";
    res.json({ success: true, category });
  } catch (err) {
    console.error("Groq Classifier Error:", err.message);
    res.json({ success: false, category: "Environment" });
  }
});

app.listen(PORT, () => {
  console.log(`CharityChain API backend running on port ${PORT}`);
});
