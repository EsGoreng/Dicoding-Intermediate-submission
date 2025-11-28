// CSS imports
import '../styles/styles.css';
import '../styles/responsives.css';
import 'tiny-slider/dist/tiny-slider.css';
import 'leaflet/dist/leaflet.css';

// Components
import App from './pages/app';
import Camera from './utils/camera';

document.addEventListener('DOMContentLoaded', async () => {
  const app = new App({
    content: document.getElementById('main-content'),
    drawerButton: document.getElementById('drawer-button'),
    drawerNavigation: document.getElementById('navigation-drawer'),
    skipLinkButton: document.getElementById('skip-link'),
  });

  // Ensure proper initial route - redirect to login if not authenticated and on root
  if (!location.hash) {
    location.hash = '/login';
  }

  await app.renderPage();

  // Register service worker for PWA (Workbox-generated sw.js will be at project root after build)
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
      console.log('Service worker registered');
    } catch (err) {
      console.warn('Service worker registration failed', err);
    }
  }

  // Register online listener to attempt processing any queued offline submissions
  try {
    const SyncUtil = await import('./utils/sync');
    if (SyncUtil && SyncUtil.registerOnlineListener) {
      SyncUtil.registerOnlineListener();
      // also attempt a flush on startup if online
      if (navigator.onLine && SyncUtil.processQueue) {
        SyncUtil.processQueue();
      }
    }
  } catch (err) {
    // ignore if sync util import fails
  }

  // Install prompt handling (beforeinstallprompt)
  let deferredPrompt = null;
  const installButton = document.getElementById('install-button');
  const installClose = document.getElementById('install-close');
  const installBanner = document.getElementById('pwa-install-banner');
  const DISMISS_KEY = 'pwaInstallDismissed';

  function showInstallBanner() {
    if (!installBanner) return;
    installBanner.setAttribute('aria-hidden', 'false');
    // focus install button for accessibility
    if (installButton) installButton.focus({ preventScroll: true });
  }

  function hideInstallBanner() {
    if (!installBanner) return;
    installBanner.setAttribute('aria-hidden', 'true');
  }

  window.addEventListener('beforeinstallprompt', async (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    deferredPrompt = e;

    // do not show banner if user previously dismissed
    const dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    if (dismissed) return;

    // attempt to load manifest to populate description/screenshots
    const descEl = document.getElementById('pwa-install-desc');
    const shotsEl = document.getElementById('pwa-install-screenshots');
    try {
      const res = await fetch('/app.webmanifest', { cache: 'no-store' });
      if (res && res.ok) {
        const mf = await res.json();
        if (mf.description && descEl) descEl.textContent = mf.description;
        if (Array.isArray(mf.screenshots) && mf.screenshots.length && shotsEl) {
          shotsEl.innerHTML = '';
          // show up to 3 thumbnails
          mf.screenshots.slice(0, 3).forEach((s) => {
            const img = document.createElement('img');
            img.src = s.src.startsWith('/') ? s.src : `/${s.src}`;
            img.alt = mf.name ? `${mf.name} screenshot` : 'screenshot';
            img.className = 'pwa-install-banner__screenshot';
            shotsEl.appendChild(img);
          });
          shotsEl.setAttribute('aria-hidden', 'false');
        }
      }
    } catch (err) {
      // ignore manifest fetch failures and proceed with default banner
      // console.warn('Failed to load manifest for install banner', err);
    }

    if (installBanner && installButton) {
      showInstallBanner();

      // when user clicks banner install, we will NOT trigger the browser prompt per user request
      const onInstallClick = () => {
        // simply hide the banner and remember dismissal so it won't reappear
        hideInstallBanner();
        localStorage.setItem(DISMISS_KEY, '1');
        // clear stored deferred prompt reference to avoid inadvertent prompting
        deferredPrompt = null;
      };

      const onCloseClick = () => {
        hideInstallBanner();
        localStorage.setItem(DISMISS_KEY, '1');
      };

      installButton.addEventListener('click', onInstallClick, { once: true });
      if (installClose) installClose.addEventListener('click', onCloseClick, { once: true });
    } else {
      // fallback: do nothing (do not call e.prompt()) per user request to remove prompts
    }
  });

  window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    // hide banner and clear dismissal
    hideInstallBanner();
    localStorage.removeItem(DISMISS_KEY);
  });

  window.addEventListener('hashchange', async () => {
    await app.renderPage();

    // Stop all active media
    Camera.stopAllStreams();
  });
});
