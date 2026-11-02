import React, { useEffect, useMemo, useRef, useState } from 'react';
import { requestJson } from '../shared/api.mjs';
import {
  buildMarketplaceParams,
  DEFAULT_MARKETPLACE_FILTERS,
  getMarketplacePagination,
  MARKETPLACE_PAGE_SIZE,
  normalizeMarketplaceResult,
} from './marketplace-state.mjs';

function useDebouncedValue(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);
  return debouncedValue;
}

function MarketplaceCard({ document }) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const title = document.title || 'Public record';
  const location = [document.county, document.state].filter(Boolean).join(', ');
  const previewUrl = `/api/documents/${encodeURIComponent(document.id)}/pages/1/preview?v=4`;

  return (
    <article className="portal-item marketplace-card">
      <figure className={`marketplace-preview-wrap${previewFailed ? ' preview-unavailable' : ''}`}>
        {!previewFailed && (
          <img
            className="marketplace-preview"
            src={previewUrl}
            alt={`Protected, blurred preview of ${title}`}
            loading="lazy"
            decoding="async"
            onError={() => setPreviewFailed(true)}
          />
        )}
        <span aria-hidden="true">DOCUMENTXCHANGE<br />PROTECTED PREVIEW</span>
      </figure>
      <h3>{title}</h3>
      <p>{location}</p>
      <div className="chip-row">
        <span className="chip">{document.category || 'Public record'}</span>
        <span className="chip">{document.page_count || 1} pages</span>
        {document.seller_is_verified && <span className="chip status">✓ Verified seller</span>}
      </div>
      <a className="button button-small" href={`/checkout?id=${encodeURIComponent(document.id)}`}>Review &amp; purchase</a>
    </article>
  );
}

export default function Marketplace() {
  const [filters, setFilters] = useState(DEFAULT_MARKETPLACE_FILTERS);
  const [page, setPage] = useState(0);
  const [documents, setDocuments] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const sectionRef = useRef(null);
  const debouncedQuery = useDebouncedValue(filters.q, 250);
  const states = useMemo(() => Object.keys(window.US_COUNTIES || {}), []);
  const counties = filters.state ? (window.US_COUNTIES?.[filters.state] || []) : [];
  const pagination = getMarketplacePagination(total, page);

  useEffect(() => {
    const controller = new AbortController();
    const params = buildMarketplaceParams({ ...filters, q: debouncedQuery }, page);
    setStatus('loading');
    setError('');
    requestJson(`/api/documents/search?${params}`, { signal: controller.signal })
      .then((result) => {
        const normalized = normalizeMarketplaceResult(result);
        const normalizedPagination = getMarketplacePagination(normalized.total, page);
        if (normalizedPagination.currentPage !== page) {
          setPage(normalizedPagination.currentPage);
          return;
        }
        setDocuments(normalized.items);
        setTotal(normalized.total);
        setStatus('ready');
      })
      .catch((requestError) => {
        if (requestError.name === 'AbortError') return;
        setDocuments([]);
        setTotal(0);
        setError(requestError.message);
        setStatus('error');
      });
    return () => controller.abort();
  }, [debouncedQuery, filters.state, filters.county, filters.category, filters.sort, page]);

  const updateFilter = (name, value) => {
    setPage(0);
    setFilters((current) => ({
      ...current,
      [name]: value,
      ...(name === 'state' ? { county: '' } : {}),
    }));
  };

  const goToPage = (nextPage) => {
    setPage(nextPage);
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const clearFilters = () => {
    setPage(0);
    setFilters(DEFAULT_MARKETPLACE_FILTERS);
  };

  const resultMessage = status === 'error'
    ? 'Search unavailable'
    : status === 'loading'
      ? 'Searching documents…'
      : total
        ? `Showing ${pagination.firstResult.toLocaleString()}–${pagination.lastResult.toLocaleString()} of ${total.toLocaleString()} documents`
        : 'No documents found';

  return (
    <div ref={sectionRef}>
      <div className="section-title"><div><p className="eyebrow">Public-record marketplace</p><h2>Find documents available to purchase</h2><p>Search titles, names, addresses, parcel numbers, document numbers, case numbers, and OCR-scanned text.</p></div></div>
      <form className="marketplace-search" id="marketplace-search" onSubmit={(event) => event.preventDefault()}>
        <label className="marketplace-query">Search records<input name="q" type="search" maxLength="300" placeholder="Name, address, parcel number, case number…" autoComplete="off" value={filters.q} onChange={(event) => updateFilter('q', event.target.value)} /></label>
        <label>State<select name="state" id="marketplace-state" value={filters.state} onChange={(event) => updateFilter('state', event.target.value)}><option value="">All states</option>{states.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
        <label>County<select name="county" id="marketplace-county" value={filters.county} disabled={!filters.state} onChange={(event) => updateFilter('county', event.target.value)}><option value="">All counties</option>{counties.map((county) => <option key={county} value={county}>{county}</option>)}</select></label>
        <label>Document type<input name="category" maxLength="100" placeholder="Deed, court filing…" autoComplete="off" value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} /></label>
        <label>Sort by<select name="sort" value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value)}><option value="relevance">Best match</option><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="price_asc">Fewest pages</option><option value="price_desc">Most pages</option><option value="most_popular">Most popular</option></select></label>
        <div className="marketplace-search-actions"><button className="button button-secondary" id="marketplace-clear" type="button" onClick={clearFilters}>Clear filters</button></div>
        <p className="marketplace-search-help">Results update automatically. Separate terms with commas to require every value, such as <strong>Smith, 123 Main Street, 2024-CV-100</strong>.</p>
      </form>
      <div className="marketplace-results-heading"><p id="marketplace-results-count" aria-live="polite">{resultMessage}</p></div>
      <div className="item-grid" id="marketplace-list" aria-busy={status === 'loading'}>
        {status === 'loading' && <p className="empty-state">Searching documents…</p>}
        {status === 'error' && <p className="empty-state">{error}</p>}
        {status === 'ready' && documents.map((document) => <MarketplaceCard document={document} key={document.id} />)}
        {status === 'ready' && documents.length === 0 && <p className="empty-state">No documents match those filters. Try fewer terms, clear a location filter, or use the U.S. mobile app to request the record you need.</p>}
      </div>
      <nav className={`pagination-controls${total <= MARKETPLACE_PAGE_SIZE ? ' hidden' : ''}`} id="marketplace-pagination" aria-label="Document result pages">
        <button className="button button-secondary" id="marketplace-previous" type="button" disabled={!pagination.hasPrevious || status === 'loading'} onClick={() => goToPage(page - 1)}>Previous</button>
        <span id="marketplace-page-status" aria-live="polite">Page {pagination.currentPage + 1} of {pagination.totalPages}</span>
        <button className="button button-secondary" id="marketplace-next" type="button" disabled={!pagination.hasNext || status === 'loading'} onClick={() => goToPage(page + 1)}>Next</button>
      </nav>
    </div>
  );
}
