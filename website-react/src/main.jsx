import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from './App.jsx';
import '../../website/styles.css';

hydrateRoot(document.getElementById('root'),
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
