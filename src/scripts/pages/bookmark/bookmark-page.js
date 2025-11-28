import {
  generateLoaderAbsoluteTemplate,
  generateReportItemTemplate,
  generateReportsListEmptyTemplate,
  generateReportsListErrorTemplate,
} from '../../templates';
import HomePresenter from '../home/home-presenter';
import Map from '../../utils/map';
import * as CeritaDuniaAPI from '../../data/api';

export default class BookmarkPage {
  #presenter = null;
  #map = null;
  #stories = [];
  #markers = [];
  #userLocation = null;

  async render() {
    return `
      <section class="container">
        <h1 class="section-title">Cerita Tersimpan</h1>

        <div class="stories-map__container">
          <div class="stories-map" id="stories-map"></div>
          <div id="map-loading-container"></div>
        </div>

        <div class="stories-list__container">
          <div id="stories-list"></div>
          <div id="stories-list-loading-container"></div>
        </div>
      </section>
    `;
  }

  async afterRender() {
    this.#presenter = new HomePresenter({
      view: this,
      model: CeritaDuniaAPI,
    });
    await this.#presenter.showSavedStories();
  }

  // reuse helpers from HomePage implementation (duplicated here)
  #calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = this.#toRad(lat2 - lat1);
    const dLon = this.#toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.#toRad(lat1)) *
        Math.cos(this.#toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  #toRad(v) {
    return (v * Math.PI) / 180;
  }

  // --- List rendering ---
  populateReportsList(message, reports) {
    const container = document.getElementById('stories-list');
    if (!container) {
      console.warn('populateReportsList: #stories-list not found');
      return;
    }

    if (!Array.isArray(reports) || reports.length === 0) {
      this.populateReportsListEmpty();
      return;
    }

    const html = reports
      .map((story) => {
        const itemHtml = generateReportItemTemplate({
          ...story,
          reporterName: story.name || 'Anonymous',
        });
        return `<div class="report-item-wrapper" data-story-id="${story.id}">${itemHtml}</div>`;
      })
      .join('');

    container.innerHTML = `<div class="stories-list">${html}</div>`;

    // attach click handlers to wrappers to open map marker popup
    const wrappers = container.querySelectorAll('[data-story-id]');
    wrappers.forEach((w) => {
      w.addEventListener('click', () => {
        const id = w.getAttribute('data-story-id');
        const m = this.#markers.find(
          (mk) => String(mk.options && mk.options.storyId) === String(id),
        );
        if (m) {
          if (typeof m.openPopup === 'function') m.openPopup();
          if (typeof this.#map.setView === 'function') this.#map.setView(m.getLatLng(), 15);
        }
        // small highlight
        w.classList.add('story-item--active');
        setTimeout(() => w.classList.remove('story-item--active'), 1500);
      });
    });
  }

  populateReportsListEmpty() {
    const el = document.getElementById('stories-list');
    if (!el) return console.warn('populateReportsListEmpty: #stories-list not found');
    el.innerHTML = generateReportsListEmptyTemplate();
  }

  populateReportsListError(message) {
    const el = document.getElementById('stories-list');
    if (!el) return console.warn('populateReportsListError: #stories-list not found');
    el.innerHTML = generateReportsListErrorTemplate(message);
  }

  // --- Map initialization ---
  async initialMap(stories = []) {
    this.#stories = Array.isArray(stories) ? stories : [];
    this.#markers = [];

    this.#map = await Map.build('#stories-map', {
      zoom: 5,
      locate: true,
    });

    if (Array.isArray(this.#stories)) {
      this.#stories.forEach((story) => {
        if (story.lat && story.lon) {
          try {
            const m = this.#map.addMarker(
              [parseFloat(story.lat), parseFloat(story.lon)],
              { storyId: story.id },
              {
                content:
                  '<div class="map-popup">' +
                  '<h3>' +
                  (story.name || 'Anonymous') +
                  '</h3>' +
                  '<p>' +
                  (story.description || '').substring(0, 100) +
                  '...</p>' +
                  '<a href="#/stories/' +
                  story.id +
                  '" class="btn">Lihat Cerita</a>' +
                  '</div>',
              },
            );

            this.#markers.push(m);

            // when marker clicked, highlight list item
            if (m && typeof m.on === 'function') {
              m.on('click', () => {
                const listItem = document.querySelector(`[data-story-id="${story.id}"]`);
                if (listItem) {
                  listItem.classList.add('story-item--active');
                  setTimeout(() => listItem.classList.remove('story-item--active'), 2000);
                }
              });
            }
          } catch (e) {
            // ignore individual marker errors
            console.warn('marker add failed', e);
          }
        }
      });
    }

    // show user location if available
    try {
      const pos = await Map.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 });
      const { latitude, longitude } = pos.coords;
      this.#userLocation = { latitude, longitude };
      this.#map.addMarker(
        [latitude, longitude],
        { isUser: true },
        { content: `Anda di sini<br>${latitude.toFixed(5)}, ${longitude.toFixed(5)}` },
      );
      this.#map.changeCamera([latitude, longitude], 13);
    } catch (err) {
      // ignore geolocation errors
    }
  }

  showMapLoading() {
    const el = document.getElementById('map-loading-container');
    if (!el) return;
    el.innerHTML = generateLoaderAbsoluteTemplate();
  }

  hideMapLoading() {
    const el = document.getElementById('map-loading-container');
    if (!el) return;
    el.innerHTML = '';
  }

  showLoading() {
    const el = document.getElementById('stories-list-loading-container');
    if (!el) return;
    el.innerHTML = generateLoaderAbsoluteTemplate();
  }

  hideLoading() {
    const el = document.getElementById('stories-list-loading-container');
    if (!el) return;
    el.innerHTML = '';
  }
}
