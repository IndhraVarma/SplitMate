import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './constants.js';

/** Normalise `?page=&limit=` into safe numbers plus a mongo skip value. */
export function getPagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requested = Number.parseInt(query.limit, 10) || DEFAULT_PAGE_SIZE;
  const limit = Math.min(Math.max(1, requested), MAX_PAGE_SIZE);
  return { page, limit, skip: (page - 1) * limit };
}

export function buildPageMeta({ page, limit, total }) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
