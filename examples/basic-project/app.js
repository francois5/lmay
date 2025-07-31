#!/usr/bin/env node
/**
 * Main application entry point
 */

const express = require('express');
const path = require('path');
const apiRoutes = require('./src/api');
const { initDatabase } = require('./src/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('static'));

// Routes
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// Initialize and start server
async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch(console.error);
}

module.exports = app;