import request from 'supertest';
import { createApp } from '../app.js';

export const app = createApp();

let counter = 0;

/** Registers a user and returns their token plus a pre-authorised agent. */
export async function createTestUser(overrides = {}) {
  counter += 1;
  const payload = {
    name: overrides.name || `Test User ${counter}`,
    email: overrides.email || `user${counter}.${Date.now()}@example.com`,
    password: overrides.password || 'Password123',
  };
  const res = await request(app).post('/api/auth/register').send(payload);
  if (res.status !== 201) {
    throw new Error(`Failed to create test user: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    ...payload,
    id: res.body.data.user.id,
    token: res.body.data.token,
    user: res.body.data.user,
  };
}

/** A supertest request with the Authorization header already set. */
export function as(token) {
  const wrap = (method) => (url) => request(app)[method](url).set('Authorization', `Bearer ${token}`);
  return {
    get: wrap('get'),
    post: wrap('post'),
    put: wrap('put'),
    patch: wrap('patch'),
    delete: wrap('delete'),
  };
}

/** Creates a group owned by `owner` with the given members already added. */
export async function createGroup(owner, { name = 'Test Group', members = [] } = {}) {
  const res = await as(owner.token)
    .post('/api/groups')
    .send({ name, memberIds: members.map((m) => m.id) });
  if (res.status !== 201) {
    throw new Error(`Failed to create group: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.group;
}

export { request };
