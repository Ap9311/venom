// Intercept and demote Firestore/Firebase offline and connection-related console errors to warnings
const originalConsoleError = console.error;
console.error = function (...args) {
  const message = args.map(arg => typeof arg === 'string' ? arg : (arg instanceof Error ? arg.message : JSON.stringify(arg))).join(' ');
  if (
    message.includes('Could not reach Cloud Firestore backend') ||
    message.includes('the client is offline') ||
    message.includes('Failed to get document because the client is offline') ||
    message.includes('Firestore (') ||
    message.includes('Service Worker registration failed') ||
    message.includes('Please check your Firebase configuration or network status') ||
    message.includes('Error checking block status')
  ) {
    console.warn('[Offline Warning - Intercepted]:', ...args);
    return;
  }
  originalConsoleError.apply(console, args);
};

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
