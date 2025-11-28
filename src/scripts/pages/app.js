import { getActiveRoute } from '../routes/url-parser';
import {
  generateAuthenticatedNavigationListTemplate,
  generateMainNavigationListTemplate,
  generateUnauthenticatedNavigationListTemplate,
  generateSubscribeButtonTemplate,
  generateUnsubscribeButtonTemplate,
} from '../templates';
import { setupSkipToContent, transitionHelper } from '../utils';
import { getAccessToken, getLogout } from '../utils/auth';
import { routes } from '../routes/routes';
import {
  isPushSupported,
  getExistingSubscription,
  subscribeUser,
  unsubscribeUser,
} from '../utils/push';
import { subscribePushNotification, unsubscribePushNotification } from '../data/api';

export default class App {
  #content;
  #drawerButton;
  #drawerNavigation;
  #skipLinkButton;

  constructor({ content, drawerNavigation, drawerButton, skipLinkButton }) {
    this.#content = content;
    this.#drawerButton = drawerButton;
    this.#drawerNavigation = drawerNavigation;
    this.#skipLinkButton = skipLinkButton;

    this.#init();
  }

  #init() {
    setupSkipToContent(this.#skipLinkButton, this.#content);
    this.#setupDrawer();
  }

  #setupDrawer() {
    this.#drawerButton.addEventListener('click', () => {
      this.#drawerNavigation.classList.toggle('open');
    });

    document.body.addEventListener('click', (event) => {
      const isTargetInsideDrawer = this.#drawerNavigation.contains(event.target);
      const isTargetInsideButton = this.#drawerButton.contains(event.target);

      if (!(isTargetInsideDrawer || isTargetInsideButton)) {
        this.#drawerNavigation.classList.remove('open');
      }

      this.#drawerNavigation.querySelectorAll('a').forEach((link) => {
        if (link.contains(event.target)) {
          this.#drawerNavigation.classList.remove('open');
        }
      });
    });
  }

  #setupNavigationList() {
    const isLogin = !!getAccessToken();
    const navListMain = this.#drawerNavigation.children.namedItem('navlist-main');
    const navList = this.#drawerNavigation.children.namedItem('navlist');

    // User not log in
    if (!isLogin) {
      navListMain.innerHTML = '';
      navList.innerHTML = generateUnauthenticatedNavigationListTemplate();
      return;
    }

    navListMain.innerHTML = generateMainNavigationListTemplate();
    navList.innerHTML = generateAuthenticatedNavigationListTemplate();

    // Push notification tools
    const pushTools = document.getElementById('push-notification-tools');
    if (pushTools) {
      // clear
      pushTools.innerHTML = '';

      if (!isPushSupported()) {
        // Push not supported, leave empty
      } else {
        // decide which button to show based on existing subscription
        (async () => {
          try {
            let reg = await navigator.serviceWorker.getRegistration();
            if (!reg) {
              // try to register silently
              try {
                reg = await navigator.serviceWorker.register('/sw.js');
              } catch (e) {
                console.warn('Service worker registration failed', e);
              }
            }

            const existing = await getExistingSubscription();
            if (existing) {
              pushTools.innerHTML = generateUnsubscribeButtonTemplate();
            } else {
              pushTools.innerHTML = generateSubscribeButtonTemplate();
            }

            const subscribeBtn = document.getElementById('subscribe-button');
            const unsubscribeBtn = document.getElementById('unsubscribe-button');

            if (subscribeBtn) {
              subscribeBtn.addEventListener('click', async (ev) => {
                ev.preventDefault();
                try {
                  const subscription = await subscribeUser();
                  if (subscription) {
                    const subJson = subscription.toJSON();
                    // send to API
                    const resp = await subscribePushNotification(subJson);
                    if (resp && resp.ok) {
                      pushTools.innerHTML = generateUnsubscribeButtonTemplate();
                    } else {
                      console.warn('Failed to subscribe on server', resp);
                      alert('Gagal subscribe notifikasi pada server');
                    }
                  }
                } catch (err) {
                  console.error('subscribeBtn handler error', err);
                  alert('Subscribe failed: ' + (err.message || err));
                }
              });
            }

            if (unsubscribeBtn) {
              unsubscribeBtn.addEventListener('click', async (ev) => {
                ev.preventDefault();
                try {
                  const reg2 = await navigator.serviceWorker.getRegistration();
                  const sub = reg2 ? await reg2.pushManager.getSubscription() : null;
                  if (sub) {
                    const resp = await unsubscribePushNotification({ endpoint: sub.endpoint });
                    // attempt local unsubscribe
                    await sub.unsubscribe();
                    if (resp && resp.ok) {
                      pushTools.innerHTML = generateSubscribeButtonTemplate();
                    } else {
                      console.warn('Failed to unsubscribe on server', resp);
                      alert('Gagal unsubscribe notifikasi pada server');
                    }
                  } else {
                    pushTools.innerHTML = generateSubscribeButtonTemplate();
                  }
                } catch (err) {
                  console.error('unsubscribe handler error', err);
                  alert('Unsubscribe failed: ' + (err.message || err));
                }
              });
            }
          } catch (err) {
            console.error('push tools init error', err);
          }
        })();
      }
    }

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', (event) => {
        event.preventDefault();

        if (confirm('Apakah Anda yakin ingin keluar?')) {
          getLogout();

          // Redirect to login page
          location.hash = '/login';
        }
      });
    }
  }

  async renderPage() {
    const url = getActiveRoute();
    const route = routes[url];

    // Get page instance
    const page = route();

    const transition = transitionHelper({
      updateDOM: async () => {
        this.#content.innerHTML = await page.render();
        page.afterRender();
      },
    });

    transition.ready.catch(console.error);
    transition.updateCallbackDone.then(() => {
      scrollTo({ top: 0, behavior: 'instant' });
      this.#setupNavigationList();
    });
  }
}
