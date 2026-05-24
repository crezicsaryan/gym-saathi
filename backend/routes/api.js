// backend/routes/api.js
const { createOrder, verifyPayment } = require('../controllers/paymentController');
const express = require('express');
const router = express.Router();

// Controllers
const { registerGymOwner, loginGymOwner } = require('../controllers/authController');
const { addClient, getDashboardStats } = require('../controllers/clientController');

// Middleware
const { protectAndCheckSubscription } = require('../middleware/auth');

// --- PUBLIC ROUTES (No token needed) ---
router.post('/auth/register', registerGymOwner);
router.post('/auth/login', loginGymOwner);

// --- PROTECTED ROUTES (Requires valid Token + Active Trial/Premium) ---
// --- PAYMENT ROUTES (Requires Token) ---
router.post('/payment/create-order', protectAndCheckSubscription, createOrder);
router.post('/payment/verify', protectAndCheckSubscription, verifyPayment);
router.post('/clients/add', protectAndCheckSubscription, addClient);
router.get('/dashboard/stats', protectAndCheckSubscription, getDashboardStats);

module.exports = router;