/**
 * API endpoint tests
 */

const request = require('supertest');
const app = require('../app');

describe('API Endpoints', () => {
  
  test('GET /api/health should return ok status', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);
      
    expect(response.body.status).toBe('ok');
    expect(response.body.version).toBe('1.0.0');
  });

  test('GET /api/users should return users list', async () => {
    const response = await request(app)
      .get('/api/users')
      .expect(200);
      
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  test('POST /api/users should create new user', async () => {
    const newUser = {
      name: 'Test User',
      email: 'test@example.com'
    };

    const response = await request(app)
      .post('/api/users')
      .send(newUser)
      .expect(201);
      
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe(newUser.name);
    expect(response.body.data.email).toBe(newUser.email);
    expect(response.body.data.id).toBeDefined();
  });

  test('POST /api/users should fail without required fields', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({})
      .expect(400);
      
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('required');
  });

});