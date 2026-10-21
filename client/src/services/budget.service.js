import api, { request } from './api.js';

export const getBudgetSummary = (params) => request(api.get('/budgets', { params }));
export const saveBudget = (payload) => request(api.post('/budgets', payload));
export const deleteBudget = (id) => request(api.delete(`/budgets/${id}`));
