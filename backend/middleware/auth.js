// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protectAndCheckSubscription = async (req, res, next) => {
  try {
    let token;
    // Check if the frontend sent a token in the headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    const currentDate = new Date();
    let accessGranted = false;
    let accountStatus = 'active';

    // 🧠 LOGIC: Is Trial Active? OR Is Premium Active?
    if (currentDate <= user.trialEndDate) {
      accessGranted = true;
      accountStatus = 'trial';
    } else if (user.isPremium && currentDate <= user.planExpiry) {
      accessGranted = true;
      accountStatus = 'premium';
    }

    // Auto-downgrade logic (if premium expired, remove premium status)
    if (user.isPremium && currentDate > user.planExpiry) {
       user.isPremium = false;
       await user.save();
    }

    // ❌ Block access if neither trial nor premium is valid
    if (!accessGranted) {
      return res.status(403).json({ 
        message: 'Trial/Premium Expired. Pay ₹499 to continue.',
        code: 'SUBSCRIPTION_REQUIRED' 
      });
    }

    // ✅ If everything is good, attach user info and move to the next step
    req.user = user;
    req.accountStatus = accountStatus;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token failed. Please login again.' });
  }
};

module.exports = { protectAndCheckSubscription };