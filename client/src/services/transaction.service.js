import api, { request } from './api.js';

export const listTransactions = (params) => request(api.get('/transactions', { params }));
export const getTransaction = (id) => request(api.get(`/transactions/${id}`));
export const createTransaction = (payload) => request(api.post('/transactions', payload));
export const updateTransaction = (id, payload) => request(api.patch(`/transactions/${id}`, payload));
export const deleteTransaction = (id) => request(api.delete(`/transactions/${id}`));

export const getSummary = (params) => request(api.get('/transactions/summary', { params }));
export const getCategoryBreakdown = (params) =>
  request(api.get('/transactions/analytics/categories', { params }));
export const getMonthlyTrend = (params) =>
  request(api.get('/transactions/analytics/monthly', { params }));
export const getDailyTrend = (params) =>
  request(api.get('/transactions/analytics/daily', { params }));
export const getPaymentMethodBreakdown = (params) =>
  request(api.get('/transactions/analytics/payment-methods', { params }));
