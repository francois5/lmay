/**
 * Database operations and models
 */

// Simple in-memory database for demo
let users = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
];

let nextId = 3;

async function initDatabase() {
  console.log('Database initialized with sample data');
  return true;
}

async function getUsers() {
  return users;
}

async function createUser(name, email) {
  if (!name || !email) {
    throw new Error('Name and email are required');
  }
  
  const user = {
    id: nextId++,
    name,
    email,
    createdAt: new Date().toISOString()
  };
  
  users.push(user);
  return user;
}

async function getUserById(id) {
  return users.find(user => user.id === parseInt(id));
}

module.exports = {
  initDatabase,
  getUsers,
  createUser,
  getUserById
};