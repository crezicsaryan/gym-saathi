// backend/models/Client.js
const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  // This links the client to the specific Gym Owner who added them
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  
  name: { type: String, required: true },
  phone: { type: String, required: true },
  fee: { type: Number, required: true },
  
  joinDate: { type: Date, default: Date.now },
  nextDueDate: { type: Date, required: true },
  lastPaymentDate: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);