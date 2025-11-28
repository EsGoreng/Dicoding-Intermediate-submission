import StoryDetailPresenter from './story-detail-presenter';
import * as StoryAPI from '../../data/api';
import { showFormattedDate } from '../../utils';
import Map from '../../utils/map';

export default class StoryDetailPage {
  #presenter = null;
  #map = null;

  async #initMap(lat, lon, name) {
    this.#map = await Map.build('#map', {
      center: [lat, lon],
      zoom: 15,
    });

    this.#map.addMarker(
      [lat, lon],
      {},
      {
        content: `Story by ${name}<br>Koordinat: ${lat}, ${lon}`,
      },
    );
  }

  async render() {
    return `
      <section class="story-detail__container">
        <div id="story-detail">
          <div class="loader"></div>
        </div>
      </section>
    `;
  }

  async afterRender() {
    this.#presenter = new StoryDetailPresenter({
      view: this,
      model: StoryAPI,
    });

    await this.#presenter.getStoryDetail();
  }

  displayStoryDetail(story) {
    const { name, description, photoUrl, createdAt, lat, lon } = story;

    const html = `
      <article class="story-detail">
        <div class="story-detail__header">
          <div class="story-detail__meta">
            <h1 class="story-detail__author">Story by ${name}</h1>
            <p class="story-detail__date">
              <i class="fas fa-calendar-alt"></i> ${showFormattedDate(createdAt, 'id-ID')}
            </p>
          </div>
          ${
            lat && lon
              ? `
            <div class="story-detail__location">
              <i class="fas fa-map-marker-alt"></i>
              <span>Koordinat: ${lat}, ${lon}</span>
            </div>
          `
              : ''
          }
        </div>

        <div class="story-detail__image-container">
          <img src="${photoUrl}" alt="Photo by ${name}" class="story-detail__image">
        </div>

        <div class="story-detail__content">
          <p class="story-detail__description">${description}</p>
        </div>

        ${
          lat && lon
            ? `
            <div class="story-detail__map">
              <h2 class="story-detail__map__title">Lokasi</h2>
              <div id="map" class="story-detail__map__container"></div>
            </div>
          `
            : ''
        }
      </article>
    `;

    document.getElementById('story-detail').innerHTML = html;

    if (lat && lon) {
      this.#initMap(lat, lon, name);
    }
  }

  displayErrorMessage(message) {
    document.getElementById('story-detail').innerHTML = `
      <div class="story-detail__error">
        <h2>Gagal memuat cerita</h2>
        <p>${message}</p>
      </div>
    `;
  }
}
