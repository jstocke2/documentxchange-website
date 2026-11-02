import React from 'react';
import { createRoot } from 'react-dom/client';
import Marketplace from './portal/Marketplace.jsx';

const root = document.getElementById('marketplace-react-root');
const mountMarketplace = () => {
  if (root) createRoot(root).render(<Marketplace />);
};

// Preserve the existing portal session gate: the public marketplace endpoint
// is not queried until the legacy shell has confirmed an authenticated user.
if (window.__DOCUMENTXCHANGE_PORTAL_READY__) mountMarketplace();
else window.addEventListener('documentxchange:portal-ready', mountMarketplace, { once: true });
