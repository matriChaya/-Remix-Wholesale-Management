import { installGlobalStorageQuotaShield } from './utils/indexedDbStorage';
// Guarantee zero uncaught QuotaExceededError crashes across the entire app
installGlobalStorageQuotaShield();

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely handle transient Firebase Auth network errors (such as sandbox/iframe origin or offline mode)
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (
    reason?.name === 'FirebaseError' ||
    reason?.code?.startsWith?.('auth/') ||
    (typeof reason?.message === 'string' &&
      (reason.message.includes('auth/network-request-failed') ||
        reason.message.includes('network-request-failed') ||
        reason.message.includes('the client is offline')))
  ) {
    console.warn('Silenced transient Firebase Auth offline/network error:', reason?.message || reason);
    event.preventDefault();
  }
});

// Service Worker lifecycle: in development mode, unregister and clear caches to prevent stale chunk collisions
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name);
        }
      });
    }
  } else {
    // Production Service Worker for offline persistence & PWA installation
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.update().catch(() => {});
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  window.location.reload();
                }
              });
            }
          });
        })
        .catch((err) => {
          console.debug('Service Worker registration note:', err);
        });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

