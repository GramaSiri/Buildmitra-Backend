const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Counter = require('./Counter');

const ROLE_PREFIX = {
  buyer: 'BUY',
  contractor: 'CON',
  supplier: 'SUP',
  vendor: 'VEN',
  laboursupply: 'LAB',
  machinehire: 'MAC',
  realestate: 'REA',
  admin: 'ADM'
};

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },

 companyName: { type: String, default: "" },
gstNo: { type: String, default: "" },
officePhone: { type: String, default: "" },
address: { type: String, default: "" },
city: { type: String, default: "" },
state: { type: String, default: "" },
pincode: { type: String, default: "" },

  userCode: { type: String, unique: true, sparse: true },
  businessRole: {
    type: String,
    enum: ['buyer', 'contractor', 'supplier', 'vendor', 'laboursupply', 'machinehire', 'realestate', 'admin'],
    default: 'buyer'
  },

  password: { type: String, required: true },

  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isVerified: { type: Boolean, default: false },

  isActive: { type: Boolean, default: true },
  isMarketplaceVisible: { type: Boolean, default: true },
  blockedReason: { type: String, default: "" },
  assignedProjects: [{
    projectCode: String,
    projectName: String,
    accessRole: String
  }],

  quizStats: {
    totalAttempts: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 }
  },

  lastQuizDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', async function() {
  if (!this.userCode) {
    const prefix = ROLE_PREFIX[this.businessRole] || 'USR';

    const counter = await Counter.findOneAndUpdate(
      { key: prefix },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    this.userCode = `${prefix}-${String(counter.seq).padStart(6, '0')}`;
  }

  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(this.password, 10);
  return;
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
