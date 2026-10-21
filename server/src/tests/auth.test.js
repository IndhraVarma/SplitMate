import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { app, request, as, createTestUser } from './helpers.js';
import { User } from '../models/User.js';

describe('POST /api/auth/register', () => {
  it('creates an account and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha Rao', email: 'asha@example.com', password: 'Password123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('asha@example.com');
    expect(res.body.data.token).toEqual(expect.any(String));
  });

  it('never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha Rao', email: 'asha2@example.com', password: 'Password123' });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('stores a bcrypt hash, never the plaintext password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha Rao', email: 'asha3@example.com', password: 'Password123' });

    const user = await User.findOne({ email: 'asha3@example.com' }).select('+passwordHash');
    expect(user.passwordHash).not.toBe('Password123');
    expect(user.passwordHash.startsWith('$2')).toBe(true);
    expect(await bcrypt.compare('Password123', user.passwordHash)).toBe(true);
  });

  it('normalises the email to lower case', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha Rao', email: 'ASHA4@Example.COM', password: 'Password123' });
    expect(res.body.data.user.email).toBe('asha4@example.com');
  });

  it.each([
    [{ name: 'A', email: 'a@example.com', password: 'Password123' }, 'name'],
    [{ name: 'Asha', email: 'not-an-email', password: 'Password123' }, 'email'],
    [{ name: 'Asha', email: 'a@example.com', password: 'short1' }, 'password'],
    [{ name: 'Asha', email: 'a@example.com', password: 'alllettersonly' }, 'password'],
    [{ name: 'Asha', email: 'a@example.com', password: '1234567890' }, 'password'],
  ])('rejects invalid registration input (%#)', async (payload, field) => {
    const res = await request(app).post('/api/auth/register').send(payload);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some((d) => d.field === field)).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    const payload = { name: 'Asha', email: 'dupe@example.com', password: 'Password123' };
    await request(app).post('/api/auth/register').send(payload);
    const res = await request(app).post('/api/auth/register').send(payload);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('ignores unexpected fields instead of trusting them', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha', email: 'strict@example.com', password: 'Password123', role: 'admin' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/login', () => {
  it('signs in with the right password', async () => {
    const user = await createTestUser({ password: 'Password123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Password123' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
  });

  it('rejects a wrong password', async () => {
    const user = await createTestUser({ password: 'Password123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'WrongPassword1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('gives the same answer for an unknown email, so accounts cannot be enumerated', async () => {
    const user = await createTestUser({ password: 'Password123' });
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'WrongPassword1' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'WrongPassword1' });

    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(unknownEmail.body.error.message).toBe(wrongPassword.body.error.message);
  });
});

describe('authentication middleware', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_MISSING');
  });

  it('rejects a malformed token', async () => {
    const res = await as('not-a-real-token').get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('rejects a token signed with a different secret', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const forged = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, 'some-other-secret');
    const res = await as(forged).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { config } = await import('../config/env.js');
    const expired = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, config.jwt.secret, {
      expiresIn: '-1s',
    });
    const res = await as(expired).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns the current user for a valid token', async () => {
    const user = await createTestUser();
    const res = await as(user.token).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
  });
});

describe('profile and password', () => {
  it('updates the display name', async () => {
    const user = await createTestUser();
    const res = await as(user.token).patch('/api/auth/me').send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('New Name');
  });

  it('changes the password and invalidates the old one', async () => {
    const user = await createTestUser({ password: 'Password123' });
    const change = await as(user.token)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'Password123', newPassword: 'BrandNew456' });
    expect(change.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Password123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'BrandNew456' });
    expect(newLogin.status).toBe(200);
  });

  it('refuses to change the password without the current one', async () => {
    const user = await createTestUser({ password: 'Password123' });
    const res = await as(user.token)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'WrongPassword1', newPassword: 'BrandNew456' });
    expect(res.status).toBe(401);
  });
});

describe('error envelope', () => {
  it('returns a JSON 404 for an unknown route', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('reports malformed JSON as a 400 rather than crashing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('never leaks a stack trace in an error response', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.body.error.stack).toBeUndefined();
  });

  it('serves a health check without authentication', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database).toBe('connected');
  });
});
