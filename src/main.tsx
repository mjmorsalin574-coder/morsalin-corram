import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (import.meta.env.PROD) {
  // Register offline-first PWA service worker in production / packaged builds
  registerSW({
    immediate: true,
    onOfflineReady() {
      // App assets precached for offline airplane-mode play
    },
  });
} else if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  // Clean up any stale dev-sw.js service worker from earlier preview sessions
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const reg of registrations) {
        reg.unregister().catch(() => {});
      }
    })
    .catch(() => {});
  if (typeof caches !== 'undefined') {
    caches
      .keys()
      .then((keys) => {
        for (const key of keys) {
          if (key.includes('workbox')) {
            caches.delete(key).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="liquid-stage flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center text-[#f4f7ff]">
          <div className="glass-sheet max-w-sm rounded-3xl p-6">
            <h1 className="font-display text-lg font-bold tracking-wider text-white">
              MORSALIN CARROM
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              A display refresh is needed to load the board cleanly.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="glass-cta mt-4 min-h-[44px] w-full rounded-2xl px-4 py-2 text-sm font-semibold"
            >
              Reload Game
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
