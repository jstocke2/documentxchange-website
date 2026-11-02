export const MARKETPLACE_PAGE_SIZE = 24;

export const DEFAULT_MARKETPLACE_FILTERS = Object.freeze({
  q: '',
  state: '',
  county: '',
  category: '',
  sort: 'relevance',
});

export function buildMarketplaceParams(filters, page = 0, pageSize = MARKETPLACE_PAGE_SIZE) {
  const safePage = Math.max(0, Number.isFinite(page) ? Math.floor(page) : 0);
  const safePageSize = Math.max(1, Number.isFinite(pageSize) ? Math.floor(pageSize) : MARKETPLACE_PAGE_SIZE);
  const params = new URLSearchParams({
    limit: String(safePageSize),
    offset: String(safePage * safePageSize),
    sort: String(filters?.sort || DEFAULT_MARKETPLACE_FILTERS.sort),
  });

  for (const key of ['q', 'state', 'county', 'category']) {
    const value = String(filters?.[key] || '').trim();
    if (value) params.set(key, value);
  }

  return params;
}

export function normalizeMarketplaceResult(result) {
  return {
    items: Array.isArray(result?.items) ? result.items : [],
    total: Math.max(0, Number(result?.total) || 0),
  };
}

export function getMarketplacePagination(total, page, pageSize = MARKETPLACE_PAGE_SIZE) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safePageSize = Math.max(1, Number.isFinite(pageSize) ? Math.floor(pageSize) : MARKETPLACE_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const currentPage = Math.min(Math.max(0, Number.isFinite(page) ? Math.floor(page) : 0), totalPages - 1);

  return {
    currentPage,
    totalPages,
    firstResult: safeTotal ? currentPage * safePageSize + 1 : 0,
    lastResult: Math.min((currentPage + 1) * safePageSize, safeTotal),
    hasPrevious: currentPage > 0,
    hasNext: currentPage + 1 < totalPages,
  };
}
