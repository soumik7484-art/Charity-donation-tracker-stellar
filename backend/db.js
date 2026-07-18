const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

// Initialize local JSON database if not exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    ngos: [
      {
        id: "GD3H-ALICE",
        address: "GD3HIWUDUIORRJEGMRZ6XNYEBU53XDIMUOEVMQOC5L2SFYTNQVQ5D6OB",
        name: "Save the Amazon Foundation",
        verified: true,
        documents: ["incorporation_doc.pdf", "tax_exemption_501c3.pdf"],
        successRate: 98,
        transparencyLevel: "Excellent",
        trustScore: 96,
        reviewsCount: 24,
        description: "NGO dedicated to preserving rainforest ecology and supporting indigenous communities."
      },
      {
        id: "NGO-WATER",
        address: "GB52...WATER",
        name: "Kenya Clean Water Alliance",
        verified: true,
        documents: ["ngo_registration.pdf"],
        successRate: 92,
        transparencyLevel: "High",
        trustScore: 94,
        reviewsCount: 12,
        description: "Drilling water wells and installing filtration systems in arid rural areas."
      }
    ],
    campaigns: [
      {
        id: 1,
        title: "Save the Amazon Rainforest",
        description: "Funding reforestation efforts to plant native trees across deforested areas of the Amazon basin and protect endangered wildlife habitats.",
        creator: "GD3HIWUDUIORRJEGMRZ6XNYEBU53XDIMUOEVMQOC5L2SFYTNQVQ5D6OB",
        image: "🌳",
        category: "Environment",
        milestones: [
          { index: 0, title: "Purchase 5,000 Saplings", amount: 300, approved: true, claimed: true },
          { index: 1, title: "Hire Planting Crews & Transport", amount: 400, approved: false, claimed: false },
          { index: 2, title: "Post-planting Satellite Monitoring Setup", amount: 300, approved: false, claimed: false }
        ],
        utilizations: [
          { amount: 15000, category: "Sapling Procurement", details: "Bought 2,500 native mahogany & rosewood saplings" },
          { amount: 10000, category: "Local Labor", details: "Paid 12 local conservationists for site prep" }
        ],
        trustScore: 96
      },
      {
        id: 2,
        title: "Clean Water Wells Kenya",
        description: "Building 3 solar-powered water pumps in the Kakuma region, providing clean drinking water to over 15,000 residents.",
        creator: "GD3HIWUDUIORRJEGMRZ6XNYEBU53XDIMUOEVMQOC5L2SFYTNQVQ5D6OB",
        image: "💧",
        category: "Health & Water",
        milestones: [
          { index: 0, title: "Geological Survey & Driller Mobilization", amount: 4000, approved: true, claimed: false },
          { index: 1, title: "Well Drilling & Casing Completion", amount: 5000, approved: false, claimed: false },
          { index: 2, title: "Solar Pump Installation & Handover", amount: 3000, approved: false, claimed: false }
        ],
        utilizations: [],
        trustScore: 94
      }
    ],
    donations: [
      {
        txHash: "3b2c0f117134cf43f8ffc1190da5adac380ed1033cd25d25ba06a684b577dcfa",
        blockNumber: 3674629,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        amount: 2,
        sender: "GD3HIWUDUIORRJEGMRZ6XNYEBU53XDIMUOEVMQOC5L2SFYTNQVQ5D6OB",
        receiver: "CBNOEZI2KQW2LT3PMYQLULE73YQ2RQMTMQNBQ5OJFYGUM2YGZ33QXXX6",
        campaignId: 1,
        status: "Success",
        anonymous: false
      }
    ],
    fraudAlerts: [
      {
        id: "alert-1",
        txHash: "3b2c...dcfa",
        sender: "GD3HIWUDUIORRJEGMRZ6XNYEBU53XDIMUOEVMQOC5L2SFYTNQVQ5D6OB",
        amount: 2,
        fraudScore: 8,
        riskLevel: "Low",
        explanation: "Transaction amount and frequency are well within normal limits. Wallet has high historical reputation.",
        recommendedAction: "None. Auto-approve.",
        timestamp: new Date().toISOString()
      }
    ],
    notifications: [
      { id: "1", type: "donation", text: "Donation of 2 XLM received for Save the Amazon Rainforest", time: "Just now", read: false }
    ],
    settings: {
      frozenAccounts: []
    }
  }, null, 2));
}

let dbMode = 'JSON';

function readJsonDb() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error("Error reading JSON db", e);
    return {};
  }
}

function writeJsonDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error writing JSON db", e);
  }
}

async function connectDB() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/charitychain';
  try {
    // Attempt Mongoose connection with a short timeout to prevent hanging if MongoDB is not running
    console.log("Connecting to MongoDB at:", mongoURI);
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 2000
    });
    dbMode = 'MONGO';
    console.log("Connected to MongoDB successfully!");
  } catch (err) {
    console.warn("MongoDB connection failed. Falling back to local JSON file-based database.");
    dbMode = 'JSON';
  }
}

module.exports = {
  connectDB,
  getMode: () => dbMode,
  
  // Data actions
  get: (collection) => {
    if (dbMode === 'MONGO') {
      // Mongoose logic (if models are compiled). For this hackathon solution, 
      // we'll run all writes/reads through the JSON fallback system if MongoDB isn't running.
      // If we fall back, it keeps it simple and guarantees zero crashes.
    }
    const data = readJsonDb();
    return data[collection] || [];
  },

  set: (collection, items) => {
    const data = readJsonDb();
    data[collection] = items;
    writeJsonDb(data);
    return items;
  },

  findOne: (collection, queryFn) => {
    const list = readJsonDb()[collection] || [];
    return list.find(queryFn);
  },

  insert: (collection, item) => {
    const data = readJsonDb();
    if (!data[collection]) data[collection] = [];
    data[collection].push(item);
    writeJsonDb(data);
    return item;
  },

  update: (collection, filterFn, updateFn) => {
    const data = readJsonDb();
    const list = data[collection] || [];
    const index = list.findIndex(filterFn);
    if (index !== -1) {
      list[index] = updateFn(list[index]);
      data[collection] = list;
      writeJsonDb(data);
      return list[index];
    }
    return null;
  }
};
