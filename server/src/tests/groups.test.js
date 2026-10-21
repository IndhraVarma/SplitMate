import { describe, it, expect } from 'vitest';
import { app, request, as, createTestUser, createGroup } from './helpers.js';

describe('creating and reading groups', () => {
  it('creates a group with the creator as owner', async () => {
    const alice = await createTestUser();
    const res = await as(alice.token).post('/api/groups').send({ name: 'Goa Trip', type: 'trip' });
    expect(res.status).toBe(201);
    expect(res.body.data.group.name).toBe('Goa Trip');

    const detail = await as(alice.token).get(`/api/groups/${res.body.data.group.id}`);
    expect(detail.body.data.myRole).toBe('owner');
    expect(detail.body.data.members).toHaveLength(1);
  });

  it('adds registered members at creation time', async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const group = await createGroup(alice, { name: 'Flat 3B', members: [bob] });

    const detail = await as(alice.token).get(`/api/groups/${group.id}`);
    expect(detail.body.data.members.map((m) => m.userId).sort()).toEqual([alice.id, bob.id].sort());
  });

  it('lists only the groups the user belongs to', async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    await createGroup(alice, { name: 'Alice only' });
    await createGroup(bob, { name: 'Bob only' });

    const aliceList = await as(alice.token).get('/api/groups');
    expect(aliceList.body.data.groups.map((g) => g.name)).toEqual(['Alice only']);
  });

  it('rejects a group name that is too short', async () => {
    const alice = await createTestUser();
    const res = await as(alice.token).post('/api/groups').send({ name: 'A' });
    expect(res.status).toBe(422);
  });
});

describe('group privacy', () => {
  it('hides a group entirely from a non-member', async () => {
    const alice = await createTestUser();
    const mallory = await createTestUser();
    const group = await createGroup(alice, { name: 'Private' });

    for (const path of [
      `/api/groups/${group.id}`,
      `/api/groups/${group.id}/members`,
      `/api/groups/${group.id}/expenses`,
      `/api/groups/${group.id}/balances`,
      `/api/groups/${group.id}/settlements`,
    ]) {
      const res = await as(mallory.token).get(path);
      // 404, not 403 - a stranger cannot even confirm the group exists.
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_A_MEMBER');
    }
  });

  it('stops a non-member writing to the group', async () => {
    const alice = await createTestUser();
    const mallory = await createTestUser();
    const group = await createGroup(alice, { name: 'Private' });

    const expense = await as(mallory.token)
      .post(`/api/groups/${group.id}/expenses`)
      .send({
        description: 'Sneaky',
        amount: '100',
        date: '2026-03-01',
        paidBy: mallory.id,
        splitType: 'EQUAL',
        participants: [{ userId: mallory.id }],
      });
    expect(expense.status).toBe(404);

    const rename = await as(mallory.token).patch(`/api/groups/${group.id}`).send({ name: 'Mine' });
    expect(rename.status).toBe(404);

    const del = await as(mallory.token).delete(`/api/groups/${group.id}`);
    expect(del.status).toBe(404);
  });

  it('requires authentication', async () => {
    const alice = await createTestUser();
    const group = await createGroup(alice);
    const res = await request(app).get(`/api/groups/${group.id}`);
    expect(res.status).toBe(401);
  });

  it('stops a plain member from renaming or deleting the group', async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const group = await createGroup(alice, { members: [bob] });

    const rename = await as(bob.token).patch(`/api/groups/${group.id}`).send({ name: 'Bobs Group' });
    expect(rename.status).toBe(403);

    const del = await as(bob.token).delete(`/api/groups/${group.id}`);
    expect(del.status).toBe(403);
  });
});

describe('members and invitations', () => {
  it('adds a member by email and refuses to add them twice', async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const group = await createGroup(alice);

    const added = await as(alice.token)
      .post(`/api/groups/${group.id}/members`)
      .send({ email: bob.email });
    expect(added.status).toBe(201);

    const again = await as(alice.token)
      .post(`/api/groups/${group.id}/members`)
      .send({ email: bob.email });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_MEMBER');
  });

  it('explains that an unregistered email must be invited instead', async () => {
    const alice = await createTestUser();
    const group = await createGroup(alice);
    const res = await as(alice.token)
      .post(`/api/groups/${group.id}/members`)
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_REGISTERED');
  });

  it('issues an invitation token that the invited user can redeem', async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const group = await createGroup(alice);

    const invite = await as(alice.token)
      .post(`/api/groups/${group.id}/invitations`)
      .send({ email: bob.email });
    expect(invite.status).toBe(201);
    const { token } = invite.body.data.invitation;

    const accepted = await as(bob.token).post('/api/groups/invitations/accept').send({ token });
    expect(accepted.status).toBe(200);

    const bobGroups = await as(bob.token).get('/api/groups');
    expect(bobGroups.body.data.groups.map((g) => g.id)).toContain(group.id);
  });

  it('refuses an invitation token redeemed by the wrong account', async () => {
    const alice = await createTestUser();
    const bob = await createTestUser();
    const mallory = await createTestUser();
    const group = await createGroup(alice);

    const invite = await as(alice.token)
      .post(`/api/groups/${group.id}/invitations`)
      .send({ email: bob.email });

    const res = await as(mallory.token)
      .post('/api/groups/invitations/accept')
      .send({ token: invite.body.data.invitation.token });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVITATION_EMAIL_MISMATCH');
  });

  it('rejects a token that does not exist', async () => {
    const bob = await createTestUser();
    const res = await as(bob.token)
      .post('/api/groups/invitations/accept')
      .send({ token: 'a'.repeat(48) });
    expect(res.status).toBe(404);
  });
});
