const API_TIMEOUT_MS = 15000;
const WEB_CONTRIBUTIONS_DISABLED = true;
let stripePayoutsReady = false;
const ADMIN_PAGE_SIZE = 20;
let portalUser = null;
let adminActiveTab = 'overview';
let adminItems = [];
let adminPage = 0;

const api = async (path, options = {}) => {
  const { timeoutMs = API_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(path, {
      credentials: 'include',
      ...fetchOptions,
      signal: fetchOptions.signal || controller.signal,
      headers: { 'content-type': 'application/json', ...(fetchOptions.headers || {}) },
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The server took too long to respond. Please try again.');
    throw new Error('Unable to connect to DocumentXchange. Check your connection and try again.');
  } finally {
    window.clearTimeout(timeout);
  }
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  return data;
};

const setMessage = (id, message, success = false) => {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message || '';
  element.classList.toggle('success', success);
};

async function getSession() {
  try { return await api('/api/auth/get-session'); } catch { return null; }
}

async function getCurrentUserProfile() {
  try { return await api('/api/users/me'); } catch { return null; }
}

function getSafeAccountReturnTo() {
  const requested = new URLSearchParams(location.search).get('returnTo');
  if (!requested || !requested.startsWith('/') || requested.startsWith('//') || requested.includes('\\')) return '/portal';
  try {
    const target = new URL(requested, location.origin);
    if (target.origin !== location.origin) return '/portal';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/portal';
  }
}

function initAccount() {
  const actions = document.getElementById('oauth-actions');
  if (!actions) return;
  const returnTo = getSafeAccountReturnTo();
  actions.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-provider]');
    if (!button) return;
    const provider = button.dataset.provider;
    const providerName = provider === 'apple' ? 'Apple' : 'Google';
    const buttons = actions.querySelectorAll('button');
    buttons.forEach((item) => { item.disabled = true; });
    button.classList.add('loading');
    setMessage('auth-message', `Opening ${providerName} sign in…`);
    try {
      const result = await api('/api/auth/sign-in/social', { method: 'POST', body: JSON.stringify({ provider, callbackURL: `${location.origin}${returnTo}` }) });
      if (!result?.url) throw new Error(`Sign in with ${providerName} is unavailable right now.`);
      location.assign(result.url);
    } catch (error) { setMessage('auth-message', error.message); }
    finally { buttons.forEach((item) => { item.disabled = false; }); button.classList.remove('loading'); }
  });

  getSession().then((session) => { if (session?.user) location.replace(returnTo); });
}

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '';
const formatCurrency = (value) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value) || 0);

function getNotificationContent(type, payload = {}) {
  const content = {
    'document.sold': ['Document Sold', `Your document '${payload.document_title || 'Unknown'}' was purchased`, '🛍️'],
    'purchase.complete': ['Purchase Complete', `You purchased '${payload.document_title || 'Unknown'}'`, '🛍️'],
    'review.received': ['New Review', `You received a ${payload.rating || ''}★ review on '${payload.document_title || 'Unknown'}'`, '⭐'],
    'request.match_found': ['Match Found', `A document matching your request was found (${payload.confidence || 0}% match)`, '📄'],
    'request.fulfilled': ['Request Fulfilled', 'Your requested document has been uploaded and is ready to review.', '📄'],
    'request.fulfillment_superseded': ['Request Already Closed', payload.message || 'Your document is published, but this request is no longer available.', '📄'],
    'duplicate.detected': ['Duplicate Detected', `Your document '${payload.document_title || 'Unknown'}' may be a duplicate`, '📄'],
    'ai.processing_complete': ['Processing Complete', payload.status === 'pending_review' ? `'${payload.document_title || 'Unknown'}' is waiting for administrator review` : `'${payload.document_title || 'Unknown'}' is ready`, '✅'],
    'ai.processing_failed': ['Document Needs Attention', `'${payload.document_title || 'Unknown'}' did not pass validation. ${payload.reason || ''}`.trim(), '⚠️'],
    'quality.issue_found': ['Quality Issues', `${payload.issue_count || 0} quality issue(s) found in '${payload.document_title || 'Unknown'}'`, '⚠️'],
    'admin.document_pending_review': ['Document Needs Review', `'${payload.document_title || 'A new upload'}' is waiting for admin approval`, '📄'],
    'seller.verified': ["You're Verified!", "You've earned the Verified seller badge", '✓'],
    'badge.earned': [`${payload.badge_emoji || '🏅'} Badge Earned!`, `You earned the ${payload.badge_label || 'new'} badge. ${payload.message || ''}`.trim(), '🏅'],
    'wallet.withdrawal_complete': ['Withdrawal Processed', `$${payload.amount || '0'} has been sent to your account`, '💵'],
    'saved_search.match': [payload.match_type === 'request' ? 'New Request Match' : 'New Document Match', `A new ${payload.match_type === 'request' ? 'request' : 'document'} matches your saved search '${payload.search_name || 'Unknown'}'`, '🔎'],
  }[type];
  return content || ['Notification', payload.message || type, '🔔'];
}

function getRelativeTime(value) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172800) return 'Yesterday';
  return formatDate(value);
}

function setNotificationBadge(unreadCount) {
  const bell = document.getElementById('notification-bell');
  const badge = document.getElementById('notification-badge');
  if (!bell || !badge) return;
  bell.classList.toggle('has-unread', unreadCount > 0);
  bell.setAttribute('aria-label', unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications');
  badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
  badge.classList.toggle('hidden', unreadCount === 0);
}

async function loadNotifications(renderList = true) {
  const result = await api(`/api/notifications?limit=${renderList ? 50 : 1}`);
  setNotificationBadge(result.unread_count || 0);
  if (!renderList) return;
  const list = document.getElementById('notification-list');
  const items = result.items || [];
  list.innerHTML = items.length ? items.map((notification) => {
    const payload = notification.payload || {};
    const [title, body, icon] = getNotificationContent(notification.type, payload);
    return `<button class="notification-item${notification.read_at ? '' : ' unread'}" type="button" data-notification-id="${escapeHtml(notification.id)}" data-request-id="${escapeHtml(payload.request_id || '')}"><span class="notification-icon" aria-hidden="true">${escapeHtml(icon)}</span><span class="notification-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span></span><span class="notification-time">${escapeHtml(getRelativeTime(notification.created_at))}</span></button>`;
  }).join('') : '<p class="empty-state">No notifications yet. Saved-search matches, fulfilled requests, purchases, reviews, and badges will appear here.</p>';
}

function closeNotificationPanel() {
  document.getElementById('notification-panel')?.classList.add('hidden');
  document.getElementById('notification-scrim')?.classList.add('hidden');
  document.getElementById('notification-bell')?.setAttribute('aria-expanded', 'false');
}

function wireNotifications() {
  const bell = document.getElementById('notification-bell');
  const panel = document.getElementById('notification-panel');
  const scrim = document.getElementById('notification-scrim');
  bell.addEventListener('click', async () => {
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !opening);
    scrim.classList.toggle('hidden', !opening);
    bell.setAttribute('aria-expanded', String(opening));
    if (opening) {
      document.getElementById('notification-list').innerHTML = '<p class="empty-state">Loading notifications…</p>';
      try { await loadNotifications(true); } catch (error) { document.getElementById('notification-list').innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
    }
  });
  document.getElementById('notification-close').addEventListener('click', closeNotificationPanel);
  scrim.addEventListener('click', closeNotificationPanel);
  document.getElementById('notification-read-all').addEventListener('click', async () => {
    try { await api('/api/notifications/read-all', { method: 'POST', body: '{}' }); await loadNotifications(true); } catch (error) { setMessage('portal-message', error.message); }
  });
  document.getElementById('notification-list').addEventListener('click', async (event) => {
    const item = event.target.closest('[data-notification-id]');
    if (!item) return;
    try {
      await api(`/api/notifications/${encodeURIComponent(item.dataset.notificationId)}/read`, { method: 'POST', body: '{}' });
      await loadNotifications(true);
      if (item.dataset.requestId) { closeNotificationPanel(); location.hash = 'requests'; }
    } catch (error) { setMessage('portal-message', error.message); }
  });
  loadNotifications(false).catch(() => {});
  window.setInterval(() => loadNotifications(false).catch(() => {}), 60000);
}

// Keep this catalog aligned with DOCUMENT_TYPE_CATEGORIES and
// DOCUMENT_TYPE_DEFAULTS in utils/pricing.ts, which power the native apps.
const DOCUMENT_TYPE_CATEGORIES = {
  'Deeds & Transfers': ['Bargain and Sale Deed', 'Deed of Trust', 'Fiduciary Deed', 'Gift Deed', 'Grant Deed', 'Property Transfer', 'Quitclaim Deed', "Sheriff's Deed", "Trustee's Deed", 'Warranty Deed'],
  'Liens & Encumbrances': ['Abstract of Judgment', 'Federal Tax Lien', 'Foreclosure Notice / Lis Pendens', "Mechanic's Lien", 'Release of Lien', 'Tax Lien'],
  'Mortgages & Financing': ['Financing Statement', 'Mortgage', 'Mortgage Satisfaction'],
  'Court & Legal': ['Adoption Record', 'Bankruptcy Filing', 'Case File', 'Civil Court Filing', 'Criminal Court Filing', 'Judgment', 'Name Change Order', 'Restraining Order / Protective Order'],
  'Probate & Family': ['Affidavit', 'Divorce Decree', 'Guardianship / Conservatorship Filing', 'Power of Attorney', 'Probate Filing'],
  'Vital Records': ['Birth Certificate', 'Death Certificate', 'Marriage Certificate', 'Marriage License'],
  'Land & Property': ['Annexation Document', 'Boundary Line Agreement', 'Building Permit', 'Condemnation / Eminent Domain Filing', 'Easement', 'Lot Line Adjustment', 'Plat Map', 'Right of Way Agreement', 'Subdivision Plat', 'Survey'],
  'Business & UCC': ['Articles of Incorporation / LLC Formation', 'Fictitious Business Name (DBA)', 'Financing Statement', 'UCC Filing'],
  Other: ['HOA / CC&R Documents', 'Mineral Rights / Oil & Gas Lease'],
};

const DOCUMENT_TYPE_PAGE_ESTIMATES = {
  'Abstract of Judgment': 3, 'Adoption Record': 10, Affidavit: 3, 'Annexation Document': 8,
  'Articles of Incorporation / LLC Formation': 10, 'Bankruptcy Filing': 30, 'Bargain and Sale Deed': 4,
  'Birth Certificate': 2, 'Boundary Line Agreement': 5, 'Building Permit': 12, 'Case File': 75,
  'Civil Court Filing': 30, 'Condemnation / Eminent Domain Filing': 10, 'Criminal Court Filing': 40,
  'Death Certificate': 2, 'Deed of Trust': 20, 'Divorce Decree': 25, Easement: 10,
  'Federal Tax Lien': 4, 'Fictitious Business Name (DBA)': 3, 'Fiduciary Deed': 5,
  'Financing Statement': 4, 'Foreclosure Notice / Lis Pendens': 6, 'Gift Deed': 3, 'Grant Deed': 4,
  'Guardianship / Conservatorship Filing': 20, 'HOA / CC&R Documents': 15, Judgment: 8,
  'Lot Line Adjustment': 5, 'Marriage Certificate': 2, 'Marriage License': 2, "Mechanic's Lien": 5,
  'Mineral Rights / Oil & Gas Lease': 12, Mortgage: 18, 'Mortgage Satisfaction': 2,
  'Name Change Order': 5, 'Plat Map': 2, 'Power of Attorney': 4, 'Probate Filing': 50,
  'Property Transfer': 5, 'Quitclaim Deed': 3, 'Release of Lien': 3,
  'Restraining Order / Protective Order': 8, 'Right of Way Agreement': 8, "Sheriff's Deed": 4,
  'Subdivision Plat': 3, Survey: 4, 'Tax Lien': 5, "Trustee's Deed": 5, 'UCC Filing': 6,
  'Warranty Deed': 4,
};

const DOCUMENT_DETAIL_TYPES = {
  dob: new Set(['Birth Certificate', 'Death Certificate']),
  marriage: new Set(['Marriage Certificate', 'Marriage License']),
  deed: new Set(['Bargain and Sale Deed', 'Deed of Trust', 'Fiduciary Deed', 'Gift Deed', 'Grant Deed', 'Property Transfer', 'Quitclaim Deed', "Sheriff's Deed", "Trustee's Deed", 'Warranty Deed', 'Easement', 'Right of Way Agreement', 'Boundary Line Agreement', 'Lot Line Adjustment', 'Subdivision Plat', 'Plat Map', 'Survey', 'Annexation Document', 'Condemnation / Eminent Domain Filing']),
  court: new Set(['Adoption Record', 'Bankruptcy Filing', 'Case File', 'Civil Court Filing', 'Criminal Court Filing', 'Judgment', 'Name Change Order', 'Restraining Order / Protective Order', 'Divorce Decree', 'Guardianship / Conservatorship Filing', 'Probate Filing', 'Abstract of Judgment', 'Foreclosure Notice / Lis Pendens']),
};

function wireDocumentTypes(typeSelect, pageInput, helpText, details) {
  Object.entries(DOCUMENT_TYPE_CATEGORIES).forEach(([category, documentTypes]) => {
    const group = document.createElement('optgroup');
    group.label = category;
    documentTypes.forEach((documentType) => {
      const option = document.createElement('option');
      option.value = documentType;
      option.textContent = documentType;
      group.appendChild(option);
    });
    typeSelect.appendChild(group);
  });
  typeSelect.addEventListener('change', () => {
    const pages = DOCUMENT_TYPE_PAGE_ESTIMATES[typeSelect.value];
    pageInput.value = pages || '';
    helpText.textContent = pages
      ? `Typical ${typeSelect.value} request: ${pages} estimated page${pages === 1 ? '' : 's'}.`
      : 'Automatically estimated from the document type.';
    details.classList.toggle('hidden', !typeSelect.value);
    if (!typeSelect.value) details.open = false;
    details.querySelectorAll('[data-detail-group]').forEach((field) => {
      const visible = DOCUMENT_DETAIL_TYPES[field.dataset.detailGroup]?.has(typeSelect.value) || false;
      field.hidden = !visible;
      field.querySelectorAll('input').forEach((input) => { input.disabled = !visible; });
    });
  });
}

function populateDocumentTypeSelect(typeSelect) {
  Object.entries(DOCUMENT_TYPE_CATEGORIES).forEach(([category, documentTypes]) => {
    const group = document.createElement('optgroup');
    group.label = category;
    documentTypes.forEach((documentType) => group.appendChild(new Option(documentType, documentType)));
    typeSelect.appendChild(group);
  });
}

function loadStates(selects) {
  const states = Object.keys(window.US_COUNTIES || {});
  if (!states.length) throw new Error('The state and county list could not be loaded.');
  selects.forEach((select) => states.forEach((state) => {
    const option = document.createElement('option');
    option.value = state;
    option.textContent = state;
    select.appendChild(option);
  }));
}

function wireCounties(stateSelect, countySelect) {
  const emptyLabel = countySelect.options[0]?.textContent || 'Select county';
  stateSelect.addEventListener('change', () => {
    countySelect.replaceChildren(new Option(emptyLabel, ''));
    countySelect.disabled = !stateSelect.value;
    if (!stateSelect.value) return;
    const counties = window.US_COUNTIES[stateSelect.value] || [];
    counties.forEach((county) => {
      const option = document.createElement('option');
      option.value = county;
      option.textContent = county;
      countySelect.appendChild(option);
    });
  });
}

async function loadSavedSearches() {
  const list = document.getElementById('saved-search-list');
  try {
    const searches = await api('/api/saved-searches');
    list.innerHTML = searches.length ? searches.map((search) => {
      const filters = search.filters || {};
      return `<article class="portal-item"><button class="item-action" data-delete-search="${escapeHtml(search.id)}" aria-label="Delete ${escapeHtml(search.name)}">×</button><h3>${escapeHtml(search.name)}</h3><p>${escapeHtml(search.query || 'All matching activity')}</p><div class="chip-row">${[filters.state, filters.county, filters.document_type, filters.match_type === 'both' ? 'Requests + uploads' : filters.match_type].filter(Boolean).map((chip) => `<span class="chip">${escapeHtml(chip)}</span>`).join('')}<span class="chip status">${search.notify_on_match ? 'Alerts on' : 'Alerts off'}</span></div></article>`;
    }).join('') : '<p class="empty-state">No saved searches yet. Watch a county or save specific keywords to receive matching alerts.</p>';
  } catch (error) { list.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
}

async function loadRequests() {
  const list = document.getElementById('request-list');
  try {
    const result = await api('/api/requests?my=true&limit=50&sort=newest');
    const requests = result.items || [];
    list.innerHTML = requests.length ? requests.map((request) => `<article class="portal-item"><h3>${escapeHtml(request.title)}</h3><p>${escapeHtml([request.county, request.state].filter(Boolean).join(', '))}</p><p>${escapeHtml(request.description || 'No additional description')}</p><div class="chip-row"><span class="chip status">${escapeHtml(request.status || 'open')}</span><span class="chip">${request.estimated_page_count || '?'} pages</span><span class="chip">Posted ${formatDate(request.createdAt || request.created_at)}</span></div></article>`).join('') : '<p class="empty-state">You have not posted a request yet.</p>';
  } catch (error) { list.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
}

async function loadFavorites() {
  const list = document.getElementById('favorite-list');
  try {
    const result = await api('/api/favorites');
    const documents = result.documents || [];
    list.innerHTML = documents.length ? documents.map((document) => `<article class="portal-item"><button class="item-action" data-delete-favorite="${escapeHtml(document.id)}" aria-label="Remove ${escapeHtml(document.title)}">×</button><h3>${escapeHtml(document.title)}</h3><p>${escapeHtml([document.county, document.state].filter(Boolean).join(', '))}</p><div class="chip-row"><span class="chip">${escapeHtml(document.documentType || document.document_type || 'Public record')}</span></div></article>`).join('') : '<p class="empty-state">No saved documents yet. Favorites added in the app will appear here.</p>';
  } catch (error) { list.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
}

async function loadLibrary() {
  const libraryList = document.getElementById('library-list');
  try {
    const libraryResult = await api('/api/library');
    const grouped = new Map();
    (libraryResult.items || []).forEach((item) => { if (!grouped.has(item.document_id)) grouped.set(item.document_id, item); });
    const documents = [...grouped.values()];
    libraryList.innerHTML = documents.length ? documents.map((document) => `<article class="portal-item"><h3>${escapeHtml(document.document_title)}</h3><p>${escapeHtml([document.document_county, document.document_state].filter(Boolean).join(', '))}</p><div class="chip-row"><span class="chip">${document.document_page_count || '?'} pages</span><span class="chip status">Purchased</span></div><div class="library-actions"><button class="button button-small" type="button" data-download-document="${escapeHtml(document.document_id)}">Download document</button></div></article>`).join('') : '<p class="empty-state">Your purchased documents will appear here.</p>';
  } catch (error) { libraryList.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
}

async function loadPurchaseHistory() {
  const historyList = document.getElementById('purchase-history-list');
  try {
    const purchaseResult = await api('/api/purchases');
    // A pending row is only an initiated Stripe checkout/PaymentIntent. It is
    // not a purchase, charge, or entitlement and must not be presented to the
    // user as transaction history. Completed is the canonical finalized state;
    // succeeded is retained for compatibility with older records.
    const purchases = (purchaseResult.items || []).filter((purchase) => ['completed', 'succeeded'].includes(purchase.status));
    historyList.innerHTML = purchases.length ? purchases.map((purchase) => `<div class="history-row"><strong>${escapeHtml(purchase.documentTitle || 'Document purchase')}</strong><span>${escapeHtml(formatDate(purchase.createdAt))}</span><span class="chip status">${escapeHtml(purchase.status || 'completed')} · $${escapeHtml(purchase.totalAmount || '0.00')}</span><button class="button button-small button-secondary" type="button" data-review-purchase="${escapeHtml(purchase.id)}" data-review-title="${escapeHtml(purchase.documentTitle || 'Document purchase')}">Rate purchase</button></div>`).join('') : '<p class="empty-state">No purchase history yet.</p>';
  } catch (error) { historyList.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
}

async function loadSellerEarnings() {
  const summary = document.getElementById('seller-summary');
  const result = await api('/api/seller/earnings');
  const values = [formatCurrency(result.available_balance), formatCurrency(result.pending_balance), formatCurrency(result.total_earnings), String(result.pages_sold || 0)];
  summary.querySelectorAll('strong').forEach((element, index) => { element.textContent = values[index]; });
  const payoutButton = document.getElementById('request-payout');
  payoutButton.classList.toggle('hidden', Number(result.available_balance) <= 0);
  payoutButton.dataset.amount = String(result.available_balance || 0);
}

async function loadConnectStatus() {
  const card = document.getElementById('connect-card');
  const button = document.getElementById('connect-stripe');
  const uploadButton = document.querySelector('#seller .section-title [data-toggle="upload-form"]');
  const result = await api('/api/connect/status');
  stripePayoutsReady = Boolean(result.uploader_eligible);
  if (uploadButton) {
    uploadButton.disabled = !stripePayoutsReady;
    uploadButton.title = stripePayoutsReady ? '' : 'Complete U.S. contributor verification before uploading';
  }
  if (result.uploader_eligible) {
    card.classList.add('ready');
    card.querySelector('strong').textContent = 'U.S. contributor verification complete';
    card.querySelector('p').textContent = 'Your verified U.S. Stripe account can receive eligible DocumentXchange royalties.';
    button.textContent = 'Review payout account';
  } else {
    card.classList.remove('ready');
    card.querySelector('strong').textContent = 'U.S. contributor verification required';
    card.querySelector('p').textContent = (result.eligibility_reasons || [])[0] || 'Complete U.S. identity, address, and payout verification before uploading.';
    button.textContent = result.details_submitted ? 'Finish payout setup' : 'Set up payouts';
  }
}

async function loadSellerListings() {
  const list = document.getElementById('seller-list');
  try {
    const result = await api('/api/documents?my_uploads=true&limit=100&offset=0');
    const documents = result.items || [];
    list.innerHTML = documents.length ? documents.map((document) => {
      const canPublish = document.status === 'ready';
      const canDelete = !['published', 'sold'].includes(document.status);
      return `<article class="seller-item"><h4>${escapeHtml(document.title)}</h4><p>${escapeHtml([document.county, document.state].filter(Boolean).join(', '))} · ${document.page_count || 0} pages</p><div class="chip-row"><span class="chip">${escapeHtml(document.category)}</span><span class="chip status">${escapeHtml(document.status)}</span>${document.fulfills_request_id ? '<span class="chip">Request fulfillment</span>' : ''}</div><div class="seller-actions"><button class="button button-small button-secondary" type="button" data-inspect-document="${escapeHtml(document.id)}">View OCR checks</button>${!['published', 'sold'].includes(document.status) ? `<button class="button button-small button-secondary" type="button" data-edit-document="${escapeHtml(document.id)}">Edit details</button>` : ''}${canPublish ? `<button class="button button-small" type="button" data-publish-document="${escapeHtml(document.id)}" data-fulfillment-id="${escapeHtml(document.fulfills_request_id || '')}">Publish listing</button>` : ''}${canDelete ? `<button class="button button-small button-danger" type="button" data-delete-document="${escapeHtml(document.id)}">Delete</button>` : ''}</div></article>`;
    }).join('') : '<p class="empty-state">You have not uploaded any documents yet.</p>';
  } catch (error) { list.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
}

async function loadFulfillmentRequests() {
  const list = document.getElementById('fulfillment-list');
  const select = document.getElementById('fulfills-request');
  try {
    const result = await api('/api/requests?status=open&limit=20&sort=newest');
    const requests = result.items || [];
    select.replaceChildren(new Option('Not fulfilling a request', ''));
    requests.forEach((request) => select.appendChild(new Option(`${request.title} — ${request.county}, ${request.state}`, request.id)));
    list.innerHTML = requests.length ? requests.map((request) => `<article class="seller-item"><h4>${escapeHtml(request.title)}</h4><p>${escapeHtml([request.county, request.state].filter(Boolean).join(', '))} · about ${request.estimated_page_count || '?'} pages</p><div class="seller-actions"><a class="button button-small" href="documentxchange://request/${encodeURIComponent(request.id)}">Fulfill in the U.S. mobile app</a></div></article>`).join('') : '<p class="empty-state">There are no open requests available right now.</p>';
  } catch (error) { list.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
}

async function loadPayouts() {
  const list = document.getElementById('payout-list');
  try {
    const result = await api('/api/seller/payouts');
    const payouts = result.payouts || [];
    list.innerHTML = payouts.length ? payouts.map((payout) => `<div class="history-row"><strong>${formatCurrency(payout.amount)}</strong><span>${escapeHtml(formatDate(payout.created_at))}</span><span class="chip status">${escapeHtml(payout.status)}</span></div>`).join('') : '<p class="empty-state">No payouts yet. Eligible earnings will appear here after you request a payout.</p>';
  } catch (error) { list.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
}

const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
  reader.readAsDataURL(file);
});

async function convertPdfToPageFiles(file, currentCount, progressText) {
  const pdfjs = await import('/vendor/pdfjs/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (currentCount + pdf.numPages > 100) throw new Error('The selected files contain more than 100 pages. Split the document into a smaller listing.');
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    progressText.textContent = `Converting PDF page ${pageNumber} of ${pdf.numPages}…`;
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.7 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport }).promise;
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error(`Could not convert PDF page ${pageNumber}.`)), 'image/jpeg', 0.9));
    pages.push(new File([blob], `${file.name.replace(/\.pdf$/i, '')}-page-${String(pageNumber).padStart(3, '0')}.jpg`, { type: 'image/jpeg' }));
    page.cleanup();
  }
  return pages;
}

async function preparePageFiles(selectedFiles, progressText) {
  const prepared = [];
  for (const file of selectedFiles) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) prepared.push(...await convertPdfToPageFiles(file, prepared.length, progressText));
    else prepared.push(file);
    if (prepared.length > 100) throw new Error('A listing can contain no more than 100 pages.');
  }
  return prepared;
}

async function showDocumentInspector(documentId) {
  const panel = document.getElementById('seller-inspector');
  const content = document.getElementById('inspector-content');
  panel.classList.remove('hidden');
  content.innerHTML = '<p class="empty-state">Loading OCR and validation results…</p>';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const record = await api(`/api/documents/${encodeURIComponent(documentId)}`);
    document.getElementById('inspector-title').textContent = record.title;
    const metadata = Object.entries(record.ocr_metadata || {}).filter(([, value]) => value !== null && value !== undefined && value !== '' && ['string', 'number', 'boolean'].includes(typeof value));
    content.innerHTML = `<div class="check-summary"><div class="check-card"><span>Listing status</span><strong>${escapeHtml(record.status)}</strong></div><div class="check-card"><span>OCR metadata</span><strong>${escapeHtml(record.metadata_status)}</strong></div><div class="check-card"><span>Completeness</span><strong>${escapeHtml(record.completeness_status || 'checking')}</strong></div></div>${record.ocr_error ? `<div class="ocr-error" role="alert"><strong>OCR scan failed</strong><p>${escapeHtml(record.ocr_error)}</p><button class="button button-small button-secondary" type="button" data-retry-ocr="${escapeHtml(record.id)}">Retry OCR scan</button></div>` : ''}${record.completeness_reason ? `<p>${escapeHtml(record.completeness_reason)}</p>` : ''}${metadata.length ? `<div class="metadata-grid">${metadata.map(([key, value]) => `<div class="metadata-field"><span>${escapeHtml(key.replaceAll('_', ' '))}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>` : record.ocr_error ? '' : '<p class="empty-state">OCR metadata is still processing or no searchable fields were found.</p>'}`;
  } catch (error) { content.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
}

async function monitorOcrResult(documentId) {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 5000));
    try {
      const record = await api(`/api/documents/${encodeURIComponent(documentId)}`);
      if (record.ocr_error) {
        setMessage('portal-message', `OCR scan failed for “${record.title}”: ${record.ocr_error}`);
        return;
      }
      if (record.metadata_status !== 'processing') return;
    } catch { return; }
  }
}

async function openEditListing(documentId) {
  const form = document.getElementById('edit-listing-form');
  const record = await api(`/api/documents/${encodeURIComponent(documentId)}`);
  form.elements.id.value = record.id;
  form.elements.title.value = record.title || '';
  form.elements.description.value = record.description || '';
  form.elements.category.value = record.category || '';
  form.elements.address.value = record.address || '';
  form.elements.state.value = record.state || '';
  form.elements.state.dispatchEvent(new Event('change'));
  form.elements.county.value = record.county || '';
  form.classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const BADGE_CATEGORIES = ['Contributions', 'Sales', 'Requests', 'Reputation', 'Earnings'];

async function loadReputation() {
  const summary = document.getElementById('reputation-summary');
  const badgeList = document.getElementById('badge-list');
  const reviewList = document.getElementById('reputation-reviews');
  if (!portalUser?.id || !summary || !badgeList) return;
  try {
    const [profile, badgeResult] = await Promise.all([
      api(`/api/seller/${encodeURIComponent(portalUser.id)}/profile`),
      api('/api/seller/badges'),
    ]);
    const stats = profile.stats || {};
    const values = [Number(stats.avg_rating || 0).toFixed(1), stats.total_reviews || 0, stats.total_docs || 0, stats.total_sales || 0, stats.fulfillment_count || 0];
    summary.querySelectorAll('strong').forEach((element, index) => { element.textContent = String(values[index]); });
    const badges = badgeResult.items || [];
    const nextBadge = badges.filter((badge) => !badge.earned).sort((a, b) => Number(b.progress) - Number(a.progress))[0];
    const next = document.getElementById('badge-next');
    if (nextBadge) {
      next.classList.remove('hidden');
      next.innerHTML = `<p class="eyebrow">Your next badge</p><div class="badge-next-title"><span>${escapeHtml(nextBadge.emoji)}</span><strong>${escapeHtml(nextBadge.label)}</strong></div><p>${escapeHtml(nextBadge.description)}</p>${renderBadgeProgress(nextBadge)}`;
    } else next.classList.add('hidden');
    badgeList.innerHTML = badges.length ? BADGE_CATEGORIES.map((category) => {
      const items = badges.filter((badge) => badge.category === category);
      if (!items.length) return '';
      return `<section class="badge-category"><h3>${escapeHtml(category)}</h3><div class="badge-grid">${items.map(renderBadgeCard).join('')}</div></section>`;
    }).join('') : '<p class="empty-state">Badge progress will appear after your first contribution.</p>';
    const reviews = profile.recent_reviews || [];
    reviewList.innerHTML = reviews.length ? reviews.map((review) => `<article class="review-card"><div><strong>${'★'.repeat(Number(review.rating_overall) || 0)}${'☆'.repeat(5 - (Number(review.rating_overall) || 0))}</strong><span>${escapeHtml(review.buyer_name || 'Verified buyer')} · ${escapeHtml(formatDate(review.created_at))}</span></div><p>${escapeHtml(review.review_text || 'Rating submitted without a written review.')}</p></article>`).join('') : '<p class="empty-state">No reviews yet. Reviews can only be left after a completed purchase.</p>';
  } catch (error) {
    badgeList.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    reviewList.innerHTML = '<p class="empty-state">Reputation details are temporarily unavailable.</p>';
  }
}

function renderBadgeProgress(badge) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(badge.progress || 0) * 100)));
  return `<div class="badge-progress"><span style="width:${percent}%;background:${escapeHtml(badge.color || '#168578')}"></span></div><small>${escapeHtml(badge.progress_label || `${percent}% complete`)}</small>`;
}

function renderBadgeCard(badge) {
  return `<article class="badge-card${badge.earned ? ' earned' : ''}" style="--badge-color:${escapeHtml(badge.color || '#168578')}"><div class="badge-icon">${badge.earned ? escapeHtml(badge.emoji) : '🔒'}</div><div><div class="badge-card-title"><strong>${escapeHtml(badge.label)}</strong>${badge.earned ? '<span>Earned</span>' : ''}</div><p>${escapeHtml(badge.description)}</p>${badge.earned ? `<small>${badge.earned_at ? `Earned ${escapeHtml(formatDate(badge.earned_at))}` : 'Earned'}</small>` : renderBadgeProgress(badge)}</div></article>`;
}

function adminMetric(label, value) {
  return `<div class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderAdminOverview(data) {
  return `<div class="admin-metrics">${adminMetric('Users', data.total_users || 0)}${adminMetric('Documents', data.total_documents || 0)}${adminMetric('Pending review', data.pending_review_documents || 0)}${adminMetric('Requests', data.total_requests || 0)}${adminMetric('Uploaded data', formatBytes(data.total_upload_bytes))}${adminMetric('Net platform revenue', formatCurrency(data.total_revenue))}</div><div class="admin-callout"><strong>Review priority</strong><p>${Number(data.pending_review_documents || 0)} document(s) are waiting for moderation. Use the Documents tab to inspect OCR, completeness, and publication status.</p></div>`;
}

function formatBytes(value) {
  const bytes = Number(value || 0); if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB']; let amount = bytes / 1024; let unit = units[0];
  for (let i = 1; i < units.length && amount >= 1024; i += 1) { amount /= 1024; unit = units[i]; }
  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${unit}`;
}

function getAdminSearchText(item) {
  const fieldsByTab = {
    users: ['name', 'display_name', 'email', 'role', 'status'],
    documents: ['title', 'county', 'state', 'uploader_name', 'category', 'status', 'completeness_reason'],
    requests: ['title', 'county', 'state', 'requester_name', 'status', 'description'],
    reports: ['document_title', 'reason', 'status', 'notes'],
    purchases: ['document_title', 'buyer_email', 'seller_email', 'payment_source', 'status', 'refund_status', 'refund_reason'],
    payouts: ['name', 'email'],
    audit: ['action', 'entity_type', 'entity_id', 'actor_name'],
  };
  return (fieldsByTab[adminActiveTab] || [])
    .map((field) => item?.[field])
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .join(' ')
    .toLocaleLowerCase();
}

function renderAdminItems() {
  const content = document.getElementById('admin-content');
  const toolbar = document.getElementById('admin-toolbar');
  const isSearchableTab = !['overview', 'analytics'].includes(adminActiveTab);
  toolbar?.classList.toggle('hidden', !isSearchableTab);
  const query = String(document.getElementById('admin-search')?.value || '').trim().toLocaleLowerCase();
  const items = query ? adminItems.filter((item) => getAdminSearchText(item).includes(query)) : adminItems;
  const totalPages = Math.max(1, Math.ceil(items.length / ADMIN_PAGE_SIZE));
  adminPage = Math.min(adminPage, totalPages - 1);
  const pageItems = items.slice(adminPage * ADMIN_PAGE_SIZE, (adminPage + 1) * ADMIN_PAGE_SIZE);
  const searchStatus = document.getElementById('admin-search-status');
  if (searchStatus) searchStatus.textContent = query ? `${items.length} of ${adminItems.length} results` : `${adminItems.length} results`;
  if (adminActiveTab === 'overview') { content.innerHTML = renderAdminOverview(adminItems[0] || {}); return; }
  if (adminActiveTab === 'analytics') {
    const data = adminItems[0] || {};
    content.innerHTML = `<div class="admin-metrics">${adminMetric('Gross sales', formatCurrency(data.gross_sales))}${adminMetric('Net revenue', formatCurrency(data.total_revenue))}${adminMetric('Seller royalties', formatCurrency(data.seller_royalties))}${adminMetric('Apple commission', formatCurrency(data.apple_commission))}${adminMetric('Stripe processing', formatCurrency(data.stripe_processing_fees))}${adminMetric('Stripe Connect', formatCurrency(data.stripe_connect_fees))}${adminMetric('Refunds', formatCurrency(data.refunds))}</div><h3>Activity by state</h3><div class="admin-list">${(data.by_state || []).map((row) => `<article class="admin-row"><strong>${escapeHtml(row.state)}</strong><span>${row.document_count} documents · ${row.request_count} requests</span></article>`).join('') || '<p class="empty-state">No state activity yet.</p>'}</div>`; return;
  }
  if (!items.length) { content.innerHTML = '<p class="empty-state">No matching records.</p>'; return; }
  const renderers = {
    users: (u) => `<article class="admin-row"><div><strong>${escapeHtml(u.name || u.email)}</strong><span>${escapeHtml(u.email)} · ${escapeHtml(u.role)} · ${Number(u.avg_rating || 0).toFixed(1)}★ · ${u.total_sales || 0} sales</span></div><div class="admin-actions"><button data-admin-user-verify="${escapeHtml(u.id)}" data-value="${!u.is_verified}" type="button">${u.is_verified ? 'Unverify' : 'Verify'}</button><button data-admin-user-role="${escapeHtml(u.id)}" data-role="${u.role === 'admin' ? 'provider' : 'admin'}" type="button">${u.role === 'admin' ? 'Remove admin' : 'Make admin'}</button><button data-admin-user-ban="${escapeHtml(u.id)}" data-banned="${u.role !== 'banned'}" type="button">${u.role === 'banned' ? 'Unban' : 'Ban'}</button><button class="danger" data-admin-delete-user="${escapeHtml(u.id)}" type="button">Delete</button></div></article>`,
    documents: (d) => `<article class="admin-row"><div><strong>${escapeHtml(d.title)}</strong><span>${escapeHtml([d.county, d.state].filter(Boolean).join(', '))} · ${escapeHtml(d.uploader_name || 'Unknown uploader')} · ${d.page_count || 0} pages · ${escapeHtml(d.status)}</span>${d.completeness_reason ? `<small>${escapeHtml(d.completeness_reason)}</small>` : ''}</div><div class="ranking-control"><label>Rank<input data-admin-rank="${escapeHtml(d.id)}" type="number" step="0.1" value="${escapeHtml(d.ranking_score ?? '')}"></label></div><div class="admin-actions"><a href="/checkout?id=${encodeURIComponent(d.id)}" target="_blank" rel="noopener">View details</a><button data-admin-document-status="${escapeHtml(d.id)}" data-status="published" type="button">Approve</button><button data-admin-document-status="${escapeHtml(d.id)}" data-status="rejected" type="button">Reject</button><button class="danger" data-admin-delete-document="${escapeHtml(d.id)}" type="button">Delete</button></div></article>`,
    requests: (r) => `<article class="admin-row"><div><strong>${escapeHtml(r.title)}</strong><span>${escapeHtml([r.county, r.state].filter(Boolean).join(', '))} · ${escapeHtml(r.requester_name || 'Unknown requester')} · ${escapeHtml(r.status)}</span></div><div class="admin-actions">${r.status === 'open' ? `<button data-admin-request-status="${escapeHtml(r.id)}" data-status="closed" type="button">Close</button>` : `<button data-admin-request-status="${escapeHtml(r.id)}" data-status="open" type="button">Reopen</button>`}<button class="danger" data-admin-delete-request="${escapeHtml(r.id)}" type="button">Delete</button></div></article>`,
    reports: (r) => `<article class="admin-row"><div><strong>${escapeHtml(r.document_title)}</strong><span>Pages ${(r.page_numbers || []).join(', ')} · ${escapeHtml(String(r.reason || '').replaceAll('_', ' '))} · ${escapeHtml(r.status)}</span>${r.notes ? `<small>${escapeHtml(r.notes)}</small>` : ''}</div><div class="admin-actions"><a href="/checkout?id=${encodeURIComponent(r.document_id)}" target="_blank" rel="noopener">Open document</a>${r.status === 'open' ? `<button data-admin-report-status="${escapeHtml(r.id)}" data-status="resolved" type="button">Resolve</button><button data-admin-report-status="${escapeHtml(r.id)}" data-status="dismissed" type="button">Dismiss</button>` : ''}</div></article>`,
    purchases: (p) => {
      const remaining = Math.max(0, Number(p.total_amount || 0) - Number(p.refund_amount || 0));
      const refundable = remaining > 0 && ['completed', 'succeeded'].includes(p.status);
      const appleHelp = p.payment_source === 'apple_iap' ? '<small>Apple approves App Store refunds. Record the request here; access changes only after Apple sends a signed refund notification.</small>' : '';
      const retryReversal = p.payout_status === 'reversal_failed' ? `<button class="danger" data-admin-retry-reversal="${escapeHtml(p.id)}" type="button">Retry seller payout recovery</button>` : '';
      const action = refundable ? (p.payment_source === 'apple_iap'
        && p.refund_status === 'apple_requested' ? '<a href="https://reportaproblem.apple.com/" target="_blank" rel="noopener">Open Apple refund portal</a>' : p.payment_source === 'apple_iap'
        ? `<button data-admin-apple-refund="${escapeHtml(p.id)}" type="button">Record Apple refund request</button><a href="https://reportaproblem.apple.com/" target="_blank" rel="noopener">Open Apple refund portal</a>`
        : `<button class="danger" data-admin-refund="${escapeHtml(p.id)}" data-remaining="${remaining.toFixed(2)}" data-source="${escapeHtml(p.payment_source)}" type="button">${p.payment_source === 'google_play' ? 'Refund & revoke in Google Play' : 'Refund'}</button>`) : '';
      return `<article class="admin-row"><div><strong>${escapeHtml(p.document_title || 'Document purchase')}</strong><span>${escapeHtml(p.buyer_email || p.buyer_id)} · ${escapeHtml(String(p.payment_source || '').replaceAll('_', ' '))} · ${formatCurrency(p.total_amount)} · ${escapeHtml(p.refund_status || 'none')}</span>${p.refund_amount ? `<small>Refunded ${formatCurrency(p.refund_amount)}${p.refund_reason ? ` — ${escapeHtml(p.refund_reason)}` : ''}</small>` : ''}${p.refund_failure_reason ? `<small>${escapeHtml(p.refund_failure_reason)}</small>` : ''}${appleHelp}</div><div class="admin-actions">${action}${retryReversal}</div></article>`;
    },
    payouts: (p) => `<article class="admin-row"><div><strong>${escapeHtml(p.name || p.email || 'Seller')}</strong><span>${escapeHtml(p.email || '')} · ${formatCurrency(p.pending_balance)} pending · ${formatCurrency(p.available_balance)} available · ${formatCurrency(p.total_paid_out)} paid</span></div><div class="admin-actions">${Number(p.available_balance) > 0 ? `<button data-admin-payout="${escapeHtml(p.user_id)}" data-amount="${escapeHtml(p.available_balance)}" type="button">Process payout</button>` : ''}</div></article>`,
    audit: (a) => `<article class="admin-row"><div><strong>${escapeHtml(a.action)}</strong><span>${escapeHtml(a.entity_type)}${a.entity_id ? ` · ${escapeHtml(a.entity_id)}` : ''} · ${escapeHtml(a.actor_name || 'System')} · ${escapeHtml(formatDate(a.created_at))}</span></div><details><summary>Changes</summary><pre>${escapeHtml(JSON.stringify({ before: a.old_value, after: a.new_value }, null, 2))}</pre></details></article>`,
  };
  const pagination = items.length > ADMIN_PAGE_SIZE ? `<nav class="pagination-controls" aria-label="Admin result pages"><button class="button button-secondary" data-admin-page="previous" type="button"${adminPage === 0 ? ' disabled' : ''}>Previous</button><span>Page ${adminPage + 1} of ${totalPages}</span><button class="button button-secondary" data-admin-page="next" type="button"${adminPage + 1 >= totalPages ? ' disabled' : ''}>Next</button></nav>` : '';
  content.innerHTML = `<div class="admin-list">${pageItems.map(renderers[adminActiveTab]).join('')}</div>${pagination}`;
}

async function loadAdminTab() {
  const content = document.getElementById('admin-content');
  content.innerHTML = `<p class="empty-state">Loading ${escapeHtml(adminActiveTab)}…</p>`;
  try {
    const endpoints = { overview: '/api/admin/analytics', analytics: '/api/admin/analytics', users: '/api/admin/users', documents: '/api/admin/documents', requests: '/api/admin/requests', reports: '/api/admin/reports', purchases: '/api/admin/purchases', payouts: '/api/admin/payouts', audit: '/api/admin/audit-logs?limit=100' };
    const result = await api(endpoints[adminActiveTab]);
    adminItems = ['overview', 'analytics'].includes(adminActiveTab) ? [result] : (result.items || []);
    renderAdminItems();
  } catch (error) { content.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; }
}

function wireAdmin() {
  if (portalUser?.role !== 'admin') return;
  document.getElementById('admin').classList.remove('hidden');
  document.getElementById('admin-nav').classList.remove('hidden');
  const adminTabs = document.getElementById('admin-tabs');
  const activateAdminTab = async (button) => {
    adminActiveTab = button.dataset.adminTab;
    adminPage = 0;
    document.querySelectorAll('[data-admin-tab]').forEach((tab) => {
      const selected = tab === button;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    document.getElementById('admin-search').value = '';
    document.getElementById('admin-toolbar').classList.toggle('hidden', ['overview', 'analytics'].includes(adminActiveTab));
    await loadAdminTab();
  };
  adminTabs.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-admin-tab]'); if (!button) return;
    await activateAdminTab(button);
  });
  adminTabs.addEventListener('keydown', async (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...adminTabs.querySelectorAll('[data-admin-tab]')];
    const current = tabs.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
      (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
    await activateAdminTab(tabs[next]);
  });
  document.getElementById('admin-search').addEventListener('input', () => { adminPage = 0; renderAdminItems(); });
  document.getElementById('admin-content').addEventListener('click', (event) => {
    const direction = event.target.closest('[data-admin-page]')?.dataset.adminPage;
    if (!direction) return;
    adminPage = Math.max(0, adminPage + (direction === 'next' ? 1 : -1));
    renderAdminItems();
    document.getElementById('admin-toolbar').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  loadAdminTab();
}

function wireReviews() {
  const dialog = document.getElementById('review-dialog');
  const form = document.getElementById('review-form');
  const stars = (name, label, required = false) => `<fieldset class="star-field"><legend>${escapeHtml(label)}</legend><div>${[1, 2, 3, 4, 5].map((value) => `<label><input type="radio" name="${name}" value="${value}"${required ? ' required' : ''}><span>★</span><small>${value}</small></label>`).join('')}</div></fieldset>`;
  const details = [['rating_accuracy', 'Accuracy of documents'], ['rating_completeness', 'Completeness of package'], ['rating_quality', 'PDF/image quality']];
  document.getElementById('review-ratings').innerHTML = `${stars('rating_overall', 'How was this document?', true)}<details class="review-details"><summary>Add details (optional)</summary>${details.map(([name, label]) => stars(name, label)).join('')}</details>`;
  document.getElementById('cancel-review').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(form));
    const optionalRating = (value) => value ? Number(value) : undefined;
    try { await api('/api/reviews', { method: 'POST', body: JSON.stringify({ purchase_id: values.purchase_id, rating_accuracy: optionalRating(values.rating_accuracy), rating_completeness: optionalRating(values.rating_completeness), rating_quality: optionalRating(values.rating_quality), rating_overall: Number(values.rating_overall), review_text: String(values.review_text || '').trim() || undefined }) }); dialog.close(); form.reset(); setMessage('portal-message', 'Rating submitted. The contributor’s reputation has been updated.', true); await loadReputation(); }
    catch (error) { setMessage('portal-message', error.message); }
  });
}

const portalLoaders = [loadLibrary, loadPurchaseHistory, loadSavedSearches, loadRequests, loadFavorites, loadSellerEarnings, loadConnectStatus, loadSellerListings, loadFulfillmentRequests, loadPayouts, loadReputation];

function showPortalStartupError(error) {
  const message = error?.message || 'The workspace could not be loaded. Refresh the page to try again.';
  setMessage('portal-message', message);
  ['library-list', 'purchase-history-list', 'saved-search-list', 'request-list', 'favorite-list', 'seller-list', 'fulfillment-list', 'payout-list'].forEach((id) => {
    const element = document.getElementById(id);
    if (element && /Loading/i.test(element.textContent)) element.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
  });
}

async function initPortal() {
  if (!document.querySelector('.workspace-shell')) return;
  const session = await getSession();
  if (!session?.user) { location.href = '/account'; return; }
  // Better Auth's basic session response contains only its standard user
  // fields. Load the authoritative profile so custom authorization fields
  // such as `role` are available before admin navigation is rendered.
  const currentUserProfile = await getCurrentUserProfile();
  portalUser = { ...session.user, ...(currentUserProfile || {}) };
  const profileName = String(portalUser.display_name || portalUser.name || '').trim();
  const hasUsableName = profileName && !profileName.includes('@') && profileName.toLowerCase() !== String(portalUser.email || '').toLowerCase();
  document.getElementById('welcome').textContent = hasUsableName ? `Welcome, ${profileName}` : 'Welcome back';
  window.__DOCUMENTXCHANGE_PORTAL_READY__ = true;
  window.dispatchEvent(new Event('documentxchange:portal-ready'));
  // Start data retrieval before optional UI wiring so one broken control cannot
  // leave every independent section stuck on its loading placeholder.
  const loading = Promise.allSettled(portalLoaders.map((loader) => loader()));
  wireNotifications();
  wireReviews();
  wireAdmin();
  document.getElementById('signout').addEventListener('click', async () => { await api('/api/auth/sign-out', { method: 'POST', body: '{}' }); location.href = '/'; });
  document.querySelectorAll('[data-toggle]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.toggle).classList.toggle('hidden')));
  const stateSelects = [document.getElementById('search-state'), document.getElementById('request-state'), document.getElementById('upload-state'), document.getElementById('edit-state')];
  try { loadStates(stateSelects); } catch (error) { setMessage('portal-message', `Location lists are unavailable: ${error.message}`); }
  wireCounties(stateSelects[0], document.getElementById('search-county'));
  wireCounties(stateSelects[1], document.getElementById('request-county'));
  wireCounties(stateSelects[2], document.getElementById('upload-county'));
  wireCounties(stateSelects[3], document.getElementById('edit-county'));
  const requestTypeSelect = document.getElementById('request-document-type');
  const requestPageEstimate = document.getElementById('request-page-estimate');
  const requestPageHelp = document.getElementById('request-page-help');
  const requestDetails = document.getElementById('request-details');
  wireDocumentTypes(requestTypeSelect, requestPageEstimate, requestPageHelp, requestDetails);
  populateDocumentTypeSelect(document.getElementById('upload-document-type'));
  populateDocumentTypeSelect(document.getElementById('edit-document-type'));
  const onboardingState = new URLSearchParams(location.search).get('seller_onboarding');
  if (onboardingState === 'complete') setMessage('portal-message', 'Payout setup was submitted. Stripe may take a moment to enable payouts.', true);
  if (onboardingState === 'refresh') setMessage('portal-message', 'Your payout setup session expired. Select “Finish payout setup” to continue.');
  document.getElementById('search-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
    const filters = { match_type: values.match_type };
    if (values.state) filters.state = values.state; if (values.county) filters.county = values.county;
    try { await api('/api/saved-searches', { method: 'POST', body: JSON.stringify({ name: values.name.trim(), query: values.query.trim(), filters, notify_on_match: Boolean(values.notify) }) }); form.reset(); form.classList.add('hidden'); setMessage('portal-message', 'Saved search created.', true); await loadSavedSearches(); } catch (error) { setMessage('portal-message', error.message); }
  });
  document.getElementById('request-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (WEB_CONTRIBUTIONS_DISABLED) { setMessage('portal-message', 'Creating requests is available only in the U.S. mobile app.'); return; }
    const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
    const documentType = values.document_type.trim();
    const details = values.description.trim();
    const description = [documentType ? `Document type: ${documentType}` : '', details].filter(Boolean).join('\n\n');
    const metadataFields = ['address', 'full_name', 'document_number', 'date_of_issue', 'date_of_expiry', 'issuing_authority', 'date_of_birth', 'spouse_name', 'marriage_date', 'property_address', 'parcel_number', 'grantor', 'grantee', 'case_number', 'court_name', 'additional_names'];
    const metadata = Object.fromEntries(metadataFields.map((field) => [field, String(values[field] || '').trim()]).filter(([, value]) => value));
    try { await api('/api/requests', { method: 'POST', body: JSON.stringify({ title: values.title.trim(), description, state: values.state, county: values.county, estimated_page_count: Number(values.estimated_page_count), ...metadata }) }); form.reset(); requestTypeSelect.dispatchEvent(new Event('change')); form.classList.add('hidden'); setMessage('portal-message', 'Request posted. It will remain open for 14 days.', true); await loadRequests(); } catch (error) { setMessage('portal-message', error.message); }
  });
  const uploadPages = document.getElementById('upload-pages');
  uploadPages.addEventListener('change', () => {
    const files = [...uploadPages.files];
    const summary = document.getElementById('upload-file-summary');
    if (!files.length) summary.textContent = 'Choose clear page images in their current order. The OCR system will verify and reorder them when possible.';
    else if (files.length > 100) summary.textContent = `${files.length} files selected. The maximum is 100 pages.`;
    else summary.textContent = `${files.length} file${files.length === 1 ? '' : 's'} selected. PDFs will be converted to page images before OCR checks.`;
  });
  document.getElementById('upload-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (WEB_CONTRIBUTIONS_DISABLED) { setMessage('portal-message', 'Document uploads are available only in the U.S. mobile app.'); return; }
    const form = event.currentTarget;
    const selectedFiles = [...uploadPages.files];
    if (!selectedFiles.length || selectedFiles.length > 100) { setMessage('portal-message', 'Select a PDF or between 1 and 100 page images.'); return; }
    if (selectedFiles.some((file) => file.size > 75 * 1024 * 1024)) { setMessage('portal-message', 'Each selected file must be 75 MB or smaller.'); return; }
    const progress = document.getElementById('upload-progress');
    const progressText = progress.querySelector('strong');
    const submitButton = form.querySelector('[type="submit"]');
    const values = Object.fromEntries(new FormData(form));
    if (!stripePayoutsReady) { setMessage('portal-message', 'Complete U.S. contributor and Stripe payout verification before uploading documents.'); return; }
    progress.classList.remove('hidden'); submitButton.disabled = true;
    try {
      progressText.textContent = 'Preparing selected document pages…';
      const files = await preparePageFiles(selectedFiles, progressText);
      if (!files.length || files.length > 100) throw new Error('The document must contain between 1 and 100 pages.');
      if (files.some((file) => file.size > 12 * 1024 * 1024)) throw new Error('Each converted page image must be 12 MB or smaller.');
      progressText.textContent = `Preparing ${files.length} page image${files.length === 1 ? '' : 's'}…`;
      const photoBase64List = await Promise.all(files.map(readFileAsBase64));
      progressText.textContent = 'Checking document quality, page order, completeness, and duplicates…';
      const document = await api('/api/documents', {
        method: 'POST', timeoutMs: 180000,
        body: JSON.stringify({ title: String(values.title).trim(), description: String(values.description || '').trim(), state: values.state, county: values.county, address: String(values.address || '').trim(), category: values.category, page_count: files.length, fulfills_request_id: values.fulfills_request_id || undefined, photo_base64_list: photoBase64List, photo_content_types: files.map((file) => file.type || 'image/jpeg'), photo_filenames: files.map((file) => file.name) }),
      });
      // High-confidence uploads publish immediately, so there is no later
      // Publish button to trigger the request-fulfillment endpoint. Link and
      // notify the request now; pending-review uploads will do this when an
      // admin or contributor publishes them later.
      if (values.fulfills_request_id && document.status === 'published') {
        await api(`/api/requests/${encodeURIComponent(values.fulfills_request_id)}/fulfill`, {
          method: 'POST', timeoutMs: 30000, body: JSON.stringify({ document_id: document.id }),
        });
      }
      form.reset(); uploadPages.dispatchEvent(new Event('change')); form.classList.add('hidden');
      setMessage('portal-message', `“${document.title}” was uploaded. OCR and full validation continue privately in the background and may take up to 5 minutes. We’ll notify you when the document is approved or needs attention.`, true);
      monitorOcrResult(document.id);
      await Promise.all([loadSellerListings(), loadFulfillmentRequests()]);
    } catch (error) { setMessage('portal-message', error.message); }
    finally { progress.classList.add('hidden'); submitButton.disabled = false; }
  });
  document.getElementById('connect-stripe').addEventListener('click', async () => {
    try {
      const result = await api('/api/connect/onboard', { method: 'POST', body: JSON.stringify({ platform: 'web' }) });
      if (!result.url) throw new Error('Stripe payout setup is unavailable right now.');
      location.assign(result.url);
    } catch (error) { setMessage('portal-message', error.message); }
  });
  document.getElementById('request-payout').addEventListener('click', async (event) => {
    const amount = Number(event.currentTarget.dataset.amount || 0);
    if (!amount || !window.confirm(`Request a payout of ${formatCurrency(amount)}?`)) return;
    try { await api('/api/seller/payouts', { method: 'POST', body: '{}' }); setMessage('portal-message', 'Payout requested successfully.', true); await Promise.all([loadSellerEarnings(), loadPayouts()]); }
    catch (error) { setMessage('portal-message', error.message); }
  });
  document.getElementById('close-inspector').addEventListener('click', () => document.getElementById('seller-inspector').classList.add('hidden'));
  document.getElementById('cancel-edit-listing').addEventListener('click', () => document.getElementById('edit-listing-form').classList.add('hidden'));
  document.getElementById('edit-listing-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try {
      await api(`/api/documents/${encodeURIComponent(values.id)}`, { method: 'PATCH', body: JSON.stringify({ title: String(values.title).trim(), description: String(values.description || '').trim(), category: values.category, state: values.state, county: values.county, address: String(values.address || '').trim() }) });
      form.classList.add('hidden'); setMessage('portal-message', 'Listing details updated.', true); await loadSellerListings();
    } catch (error) { setMessage('portal-message', error.message); }
  });
  document.addEventListener('click', async (event) => {
    const searchId = event.target.dataset?.deleteSearch; const favoriteId = event.target.dataset?.deleteFavorite;
    const downloadDocumentId = event.target.dataset?.downloadDocument;
    const publishDocumentId = event.target.dataset?.publishDocument; const deleteDocumentId = event.target.dataset?.deleteDocument;
    const fulfillmentId = event.target.dataset?.fulfillmentId;
    const fulfillRequestId = event.target.dataset?.fulfillRequest;
    const inspectDocumentId = event.target.dataset?.inspectDocument; const editDocumentId = event.target.dataset?.editDocument;
    const reviewPurchaseId = event.target.dataset?.reviewPurchase;
    const adminUserVerify = event.target.dataset?.adminUserVerify; const adminUserRole = event.target.dataset?.adminUserRole; const adminUserBan = event.target.dataset?.adminUserBan; const adminDeleteUser = event.target.dataset?.adminDeleteUser;
    const adminDocumentStatus = event.target.dataset?.adminDocumentStatus; const adminDeleteDocument = event.target.dataset?.adminDeleteDocument; const adminRank = event.target.dataset?.adminRank;
    const adminRequestStatus = event.target.dataset?.adminRequestStatus; const adminDeleteRequest = event.target.dataset?.adminDeleteRequest; const adminReportStatus = event.target.dataset?.adminReportStatus; const adminPayout = event.target.dataset?.adminPayout; const adminRefund = event.target.dataset?.adminRefund;
    const adminAppleRefund = event.target.dataset?.adminAppleRefund; const adminRetryReversal = event.target.dataset?.adminRetryReversal;
    const retryOcrId = event.target.dataset?.retryOcr;
    try {
      if (reviewPurchaseId) {
        const dialog = document.getElementById('review-dialog'); const form = document.getElementById('review-form');
        form.reset(); form.elements.purchase_id.value = reviewPurchaseId; document.getElementById('review-document-title').textContent = event.target.dataset.reviewTitle || 'Document purchase'; dialog.showModal();
      }
      if (searchId) { await api(`/api/saved-searches/${encodeURIComponent(searchId)}`, { method: 'DELETE', body: '{}' }); await loadSavedSearches(); }
      if (favoriteId) { await api(`/api/favorites/document/${encodeURIComponent(favoriteId)}`, { method: 'DELETE', body: '{}' }); await loadFavorites(); }
      if (downloadDocumentId) { const result = await api(`/api/documents/${encodeURIComponent(downloadDocumentId)}/download-url`); if (result.url) location.assign(result.url); }
      if (publishDocumentId) {
        if (fulfillmentId && !stripePayoutsReady) throw new Error('Complete Stripe payout setup before publishing a request fulfillment.');
        await api(`/api/documents/${encodeURIComponent(publishDocumentId)}/publish`, { method: 'POST', body: '{}' });
        if (fulfillmentId) await api(`/api/requests/${encodeURIComponent(fulfillmentId)}/fulfill`, { method: 'POST', timeoutMs: 30000, body: JSON.stringify({ document_id: publishDocumentId }) });
        setMessage('portal-message', fulfillmentId ? 'Listing published and the requester was notified. Earnings begin only after their verified purchase.' : 'Listing published.', true);
        await Promise.all([loadSellerListings(), loadFulfillmentRequests()]);
      }
      if (deleteDocumentId && window.confirm('Delete this unpublished listing? This cannot be undone.')) { await api(`/api/documents/${encodeURIComponent(deleteDocumentId)}`, { method: 'DELETE', body: '{}' }); setMessage('portal-message', 'Listing deleted.', true); await loadSellerListings(); }
      if (fulfillRequestId) {
        if (WEB_CONTRIBUTIONS_DISABLED) throw new Error('Request fulfillment is available only in the U.S. mobile app.');
        if (!stripePayoutsReady) { location.hash = 'seller'; throw new Error('Set up and enable Stripe payouts before fulfilling a request.'); }
        document.getElementById('fulfills-request').value = fulfillRequestId; document.getElementById('upload-form').classList.remove('hidden'); document.getElementById('upload-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (inspectDocumentId) await showDocumentInspector(inspectDocumentId);
      if (editDocumentId) await openEditListing(editDocumentId);
      if (retryOcrId) { await api(`/api/documents/${encodeURIComponent(retryOcrId)}/ocr`, { method: 'POST', timeoutMs: 180000, body: '{}' }); setMessage('portal-message', 'OCR scan completed.', true); await showDocumentInspector(retryOcrId); }
      if (adminUserVerify) await api(`/api/admin/users/${encodeURIComponent(adminUserVerify)}`, { method: 'PATCH', body: JSON.stringify({ is_verified: event.target.dataset.value === 'true' }) });
      if (adminUserRole) await api(`/api/admin/users/${encodeURIComponent(adminUserRole)}`, { method: 'PATCH', body: JSON.stringify({ role: event.target.dataset.role }) });
      if (adminUserBan) await api(`/api/admin/users/${encodeURIComponent(adminUserBan)}`, { method: 'PATCH', body: JSON.stringify({ banned: event.target.dataset.banned === 'true' }) });
      if (adminDeleteUser && window.confirm('Permanently delete this user and their related data?')) await api(`/api/admin/users/${encodeURIComponent(adminDeleteUser)}`, { method: 'DELETE', body: '{}' });
      if (adminDocumentStatus) await api(`/api/admin/documents/${encodeURIComponent(adminDocumentStatus)}`, { method: 'PATCH', body: JSON.stringify({ status: event.target.dataset.status }) });
      if (adminDeleteDocument && window.confirm('Permanently delete this document?')) await api(`/api/admin/documents/${encodeURIComponent(adminDeleteDocument)}`, { method: 'DELETE', body: '{}' });
      if (adminRequestStatus) await api(`/api/admin/requests/${encodeURIComponent(adminRequestStatus)}`, { method: 'PATCH', body: JSON.stringify({ status: event.target.dataset.status }) });
      if (adminDeleteRequest && window.confirm('Permanently delete this request?')) await api(`/api/admin/requests/${encodeURIComponent(adminDeleteRequest)}`, { method: 'DELETE', body: '{}' });
      if (adminReportStatus) await api(`/api/admin/reports/${encodeURIComponent(adminReportStatus)}`, { method: 'PATCH', body: JSON.stringify({ status: event.target.dataset.status }) });
      if (adminRefund) {
        const remaining = Number(event.target.dataset.remaining || 0);
        const isGoogle = event.target.dataset.source === 'google_play';
        const enteredAmount = isGoogle ? remaining.toFixed(2) : window.prompt(`Refund amount (maximum ${formatCurrency(remaining)}):`, remaining.toFixed(2));
        if (enteredAmount === null) return;
        const amount = Number(enteredAmount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) throw new Error(`Enter an amount from $0.01 to ${formatCurrency(remaining)}.`);
        const reason = window.prompt('Refund reason (required):', 'Document unavailable or materially different');
        if (!reason?.trim()) throw new Error('A refund reason is required.');
        const fullRefund = Math.abs(amount - remaining) < 0.005;
        if (!window.confirm(`${isGoogle ? 'Google Play will refund and revoke' : fullRefund ? 'Fully refund' : 'Partially refund'} ${formatCurrency(amount)}? ${fullRefund ? 'The buyer’s document access will be revoked and the seller royalty reversed.' : 'The buyer keeps access; the matching portion of the seller royalty will be reversed.'}`)) return;
        await api(`/api/admin/purchases/${encodeURIComponent(adminRefund)}/refund`, { method: 'POST', body: JSON.stringify({ amount, reason: reason.trim(), revoke_access: fullRefund }) });
      }
      if (adminAppleRefund) {
        const reason = window.prompt('Reason for the Apple refund request (required):', 'Document unavailable or materially different');
        if (!reason?.trim()) throw new Error('A refund reason is required.');
        await api(`/api/admin/purchases/${encodeURIComponent(adminAppleRefund)}/apple-refund-request`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) });
      }
      if (adminRetryReversal && window.confirm('Retry recovery of the refunded seller payout through Stripe Connect?')) await api(`/api/admin/purchases/${encodeURIComponent(adminRetryReversal)}/retry-transfer-reversal`, { method: 'POST', body: '{}' });
      if (adminPayout && window.confirm(`Process ${formatCurrency(event.target.dataset.amount)} for this seller?`)) await api(`/api/admin/payouts/${encodeURIComponent(adminPayout)}/process`, { method: 'POST', body: JSON.stringify({ amount: Number(event.target.dataset.amount) }) });
      if ([adminUserVerify, adminUserRole, adminUserBan, adminDeleteUser, adminDocumentStatus, adminDeleteDocument, adminRequestStatus, adminDeleteRequest, adminReportStatus, adminRefund, adminAppleRefund, adminRetryReversal, adminPayout].some(Boolean)) { setMessage('portal-message', adminAppleRefund ? 'Apple refund request recorded. Apple must approve it before access changes.' : adminRefund ? 'Refund processed and both parties were notified.' : 'Admin action completed.', true); await loadAdminTab(); }
    } catch (error) { setMessage('portal-message', error.message); }
  });
  document.addEventListener('change', async (event) => {
    const documentId = event.target.dataset?.adminRank;
    if (!documentId) return;
    try { await api(`/api/admin/documents/${encodeURIComponent(documentId)}`, { method: 'PATCH', body: JSON.stringify({ ranking_score: Number(event.target.value) }) }); setMessage('portal-message', 'Document ranking score updated.', true); }
    catch (error) { setMessage('portal-message', error.message); }
  });
  await loading;
}

initAccount();
initPortal().catch(showPortalStartupError);
