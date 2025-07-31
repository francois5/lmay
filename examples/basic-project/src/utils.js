/**
 * Utility functions
 */

const { getUsers } = require('./database');

async function generateReport() {
  const users = await getUsers();
  
  return {
    timestamp: new Date().toISOString(),
    totalUsers: users.length,
    users: users.map(user => ({
      id: user.id,
      name: user.name
    }))
  };
}

function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = {
  generateReport,
  formatDate,
  validateEmail
};