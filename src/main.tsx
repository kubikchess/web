// SPDX-License-Identifier: GPL-3.0-or-later
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './i18n';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element is missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
