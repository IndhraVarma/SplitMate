import api, { request } from './api.js';

export const login = (payload) => request(api.post('/auth/login', payload));
export const register = (payload) => request(api.post('/auth/register', payload));
export const logout = () => request(api.post('/auth/logout'));
export const fetchMe = () => request(api.get('/auth/me'));
export const updateProfile = (payload) => request(api.patch('/auth/me', payload));
export const changePassword = (payload) => request(api.post('/auth/change-password', payload));
export const searchUsers = (q) => request(api.get('/auth/users/search', { params: { q } }));
