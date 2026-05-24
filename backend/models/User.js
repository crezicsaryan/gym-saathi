// backend/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  gymName: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // Trial Logic
  trialStartDate: { type: Date, default: Date.now },
  trialEndDate: { 
    type: Date, 
    default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000) // +30 Days
  },
  
  // Premium Logic
  isPremium: { type: Boolean, default: false },
  planExpiry: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);