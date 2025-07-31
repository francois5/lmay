/**
 * API routes and handlers
 */

const express = require('express');
const { getUsers, createUser } = require('./database');

const router = express.Router();

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await getUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new user
router.post('/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await createUser(name, email);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;