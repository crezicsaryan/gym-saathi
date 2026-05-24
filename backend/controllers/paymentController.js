// backend/controllers/paymentController.js
const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/User');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 1. Create an Order (When user clicks "Pay ₹499")
exports.createOrder = async (req, res) => {
  try {
    const options = {
      amount: 499 * 100, // Amount must be in paise (₹499 * 100)
      currency: "INR",
      receipt: `receipt_order_${req.user._id}`,
    };
    const order = await razorpay.orders.create(options);
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ message: "Error creating Razorpay order", error });
  }
};

// 2. Verify Payment (After user enters card details and pays)
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify the payment signature to ensure it's not a fake request
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      // ✅ PAYMENT SUCCESS! Upgrade the user to Premium
      const user = await User.findById(req.user._id);
      user.isPremium = true;
      user.planExpiry = new Date(+new Date() + 30 * 24 * 60 * 60 * 1000); // Add 30 days
      await user.save();

      return res.status(200).json({ message: "Payment successful! Welcome to Premium.", isPremium: true });
    } else {
      return res.status(400).json({ message: "Invalid payment signature" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error verifying payment" });
  }
};