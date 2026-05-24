// backend/controllers/clientController.js
const Client = require('../models/Client');

// 1. Add a New Gym Member
exports.addClient = async (req, res) => {
  try {
    const { name, phone, fee, joinDate } = req.body;
    
    // Auto-calculate next due date (+30 days from join date)
    const startDate = joinDate ? new Date(joinDate) : new Date();
    const nextDueDate = new Date(startDate);
    nextDueDate.setDate(nextDueDate.getDate() + 30);

    const newClient = new Client({
      userId: req.user._id, // We get this from your auth middleware!
      name,
      phone,
      fee,
      joinDate: startDate,
      nextDueDate,
      lastPaymentDate: startDate
    });

    await newClient.save();
    res.status(201).json({ message: 'Client added successfully!', client: newClient });
  } catch (error) {
    res.status(500).json({ message: 'Error adding client to database.' });
  }
};

// 2. Get Dashboard Statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const currentDate = new Date();

    // Find ONLY the clients that belong to this specific gym owner
    const clients = await Client.find({ userId: ownerId });

    const totalClients = clients.length;
    
    // Count how many clients have a due date in the past
    const dueClients = clients.filter(client => new Date(client.nextDueDate) < currentDate).length;

    // Calculate monthly revenue (sum of all client fees)
    const monthlyRevenue = clients.reduce((sum, client) => sum + client.fee, 0);

    res.status(200).json({
      totalClients,
      dueClients,
      monthlyRevenue,
      yearlyRevenue: monthlyRevenue * 12
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard stats.' });
  }
};