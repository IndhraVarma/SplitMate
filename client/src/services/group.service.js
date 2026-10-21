import api, { request } from './api.js';

export const listGroups = () => request(api.get('/groups'));
export const createGroup = (payload) => request(api.post('/groups', payload));
export const getGroup = (groupId) => request(api.get(`/groups/${groupId}`));
export const updateGroup = (groupId, payload) => request(api.patch(`/groups/${groupId}`, payload));
export const deleteGroup = (groupId) => request(api.delete(`/groups/${groupId}`));

export const listMembers = (groupId) => request(api.get(`/groups/${groupId}/members`));
export const addMember = (groupId, payload) =>
  request(api.post(`/groups/${groupId}/members`, payload));
export const removeMember = (groupId, userId) =>
  request(api.delete(`/groups/${groupId}/members/${userId}`));

export const inviteToGroup = (groupId, email) =>
  request(api.post(`/groups/${groupId}/invitations`, { email }));
export const listGroupInvitations = (groupId) => request(api.get(`/groups/${groupId}/invitations`));
export const revokeInvitation = (groupId, id) =>
  request(api.delete(`/groups/${groupId}/invitations/${id}`));
export const listMyInvitations = () => request(api.get('/groups/invitations/mine'));
export const acceptInvitation = (token) => request(api.post('/groups/invitations/accept', { token }));

export const listExpenses = (groupId, params) =>
  request(api.get(`/groups/${groupId}/expenses`, { params }));
export const getExpense = (groupId, id) => request(api.get(`/groups/${groupId}/expenses/${id}`));
export const createExpense = (groupId, payload) =>
  request(api.post(`/groups/${groupId}/expenses`, payload));
export const updateExpense = (groupId, id, payload) =>
  request(api.put(`/groups/${groupId}/expenses/${id}`, payload));
export const deleteExpense = (groupId, id) =>
  request(api.delete(`/groups/${groupId}/expenses/${id}`));

export const getBalances = (groupId) => request(api.get(`/groups/${groupId}/balances`));

export const listSettlements = (groupId, params) =>
  request(api.get(`/groups/${groupId}/settlements`, { params }));
export const createSettlement = (groupId, payload) =>
  request(api.post(`/groups/${groupId}/settlements`, payload));
export const deleteSettlement = (groupId, id) =>
  request(api.delete(`/groups/${groupId}/settlements/${id}`));
