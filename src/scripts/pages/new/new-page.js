import NewPresenter from './new-presenter';
import * as StoryAPI from '../../data/api';
import Camera from '../../utils/camera';
import Map from '../../utils/map';
import { getAccessToken } from '../../utils/auth';

export default class NewPage {
  #presenter = null;
  #camera = null;
  #cameraClickHandler = null;
  #cameraRotated = false;
  #cameraMirrored = false;
  #map = null;
  #locationMarker = null;

  async render() {
    return `
      <section class="new-story">
        <div class="new-story__header">
          <h1 class="new-story__header__title">Bagikan Ceritamu</h1>
          <p>Bagikan cerita dan pengalamanmu kepada dunia</p>
        </div>

        <div class="new-form__container">
          <form id="new-story-form" class="new-form">
            <div class="form-control">
              <label for="description-input" class="new-form__description__title">Cerita Anda</label>
              <div class="new-form__description__container">
                <textarea 
                  id="description-input" 
                  name="description" 
                  placeholder="Tulis cerita Anda di sini..."
                  required
                ></textarea>
              </div>
            </div>

            

            <div class="form-control">
              <label for="photo-input" class="new-form__photo__title">Foto</label>
              <div class="new-form__photo__container">
                <input 
                  type="file" 
                  id="photo-input" 
                  name="photo"
                  accept="image/*"
                  required
                >
                <div style="margin-top:8px;">
                  <button id="open-camera-button" type="button" class="btn btn-outline">Buka Kamera</button>
                </div>
                <small class="photo-size-hint">*Maksimal ukuran foto 1MB</small>
                <div id="photo-preview" class="photo-preview"></div>
              </div>
            </div>

            <!-- Camera UI (hidden by default) -->
            <div id="photo-camera-container" class="new-form__camera__container" hidden>
              <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
                <select id="camera-select"></select>
                <button id="close-camera-button" type="button" class="btn btn-transparent">Tutup Kamera</button>
              </div>
              <video id="camera-video" class="new-form__camera__video" autoplay playsinline></video>
              <canvas id="camera-canvas" class="new-form__camera__canvas"></canvas>
              <div class="new-form__camera__tools">
                <div style="display:flex; gap:8px; align-items:center;">
                  <button id="mirror-camera-button" type="button" class="btn btn-outline">Mirror</button>
                  <button id="rotate-camera-button" type="button" class="btn btn-outline">Rotate</button>
                  <button id="take-photo-btn" type="button" class="btn">Ambil Foto</button>
                </div>
              </div>
            </div>

            <div class="form-control">
              <label class="new-form__location__title">Lokasi (Opsional)</label>
              <div class="new-form__location__container">
                <div class="new-form__location__inputs">
                  <input 
                    type="number" 
                    id="lat-input" 
                    name="lat" 
                    placeholder="Latitude"
                    step="any"
                  >
                  <input 
                    type="number" 
                    id="lon-input" 
                    name="lon" 
                    placeholder="Longitude"
                    step="any"
                  >
                  <button id="use-current-location-btn" type="button" class="btn btn-outline" style="margin-left:8px;">Gunakan Lokasi Saya</button>
                </div>

                <div class="new-form__location__map__container" style="margin-top:12px;">
                  <div id="new-story-map" class="new-form__location__map"></div>
                  <div id="new-story-map-loading"></div>
                </div>
              </div>
            </div>

            <div class="form-buttons">
              <div id="submit-button-container">
                <button class="btn" type="submit">Bagikan Cerita</button>
              </div>
              <a class="btn btn-outline" href="#/">Batal</a>
            </div>
          </form>
        </div>
      </section>
    `;
  }

  async afterRender() {
    this.#presenter = new NewPresenter({
      view: this,
      model: StoryAPI,
    });

    this.#setupForm();
    this.#setupPhotoPreview();
    this.#setupCameraUI();
    this.#setupLocationMap();

    // No guest flow; users must be logged in to submit stories
  }

  async #setupLocationMap() {
    const mapContainer = document.getElementById('new-story-map');
    const mapLoadingContainer = document.getElementById('new-story-map-loading');
    const latInput = document.getElementById('lat-input');
    const lonInput = document.getElementById('lon-input');
    const useCurrentBtn = document.getElementById('use-current-location-btn');

    if (!mapContainer) {
      // no map container in DOM
      return;
    }

    if (mapLoadingContainer) {
      mapLoadingContainer.innerHTML = '';
    }

    try {
      this.#map = await Map.build('#new-story-map', { zoom: 12, locate: true });

      // click on map to set marker and inputs
      this.#map.addMapEventListener('click', (e) => {
        try {
          const { lat, lng } = e.latlng || e.latLng || {};
          if (lat === undefined || lng === undefined) return;

          // set inputs
          if (latInput) latInput.value = lat.toFixed(6);
          if (lonInput) lonInput.value = lng.toFixed(6);

          // add/replace marker
          if (this.#locationMarker) {
            try {
              this.#locationMarker.remove();
            } catch (err) {}
            this.#locationMarker = null;
          }

          try {
            this.#locationMarker = this.#map.addMarker(
              [lat, lng],
              {},
              { content: `Lokasi: ${lat.toFixed(6)}, ${lng.toFixed(6)}` },
            );
          } catch (err) {
            // ignore marker error
          }
        } catch (err) {
          console.error('map click handler error', err);
        }
      });

      // use current location button
      if (useCurrentBtn) {
        useCurrentBtn.addEventListener('click', async () => {
          try {
            const pos = await Map.getCurrentPosition({ enableHighAccuracy: true, timeout: 7000 });
            const { latitude, longitude } = pos.coords;
            if (latInput) latInput.value = latitude.toFixed(6);
            if (lonInput) lonInput.value = longitude.toFixed(6);

            // add marker and center
            if (this.#locationMarker) {
              try {
                this.#locationMarker.remove();
              } catch (err) {}
              this.#locationMarker = null;
            }
            try {
              this.#locationMarker = this.#map.addMarker(
                [latitude, longitude],
                {},
                { content: `Lokasi Anda: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}` },
              );
            } catch (err) {}
            this.#map.changeCamera([latitude, longitude], 14);
          } catch (err) {
            console.warn('Could not get current position', err);
            alert('Gagal mengambil lokasi Anda. Pastikan izin lokasi diaktifkan.');
          }
        });
      }
    } catch (err) {
      console.error('setupLocationMap error', err);
    }
  }

  #setupCameraUI() {
    const openBtn = document.getElementById('open-camera-button');
    const closeBtn = document.getElementById('close-camera-button');
    const cameraContainer = document.getElementById('photo-camera-container');
    const videoEl = document.getElementById('camera-video');
    const selectEl = document.getElementById('camera-select');
    const canvasEl = document.getElementById('camera-canvas');
    const takeBtn = document.getElementById('take-photo-btn');
    const mirrorBtn = document.getElementById('mirror-camera-button');
    const rotateBtn = document.getElementById('rotate-camera-button');
    const photoInput = document.getElementById('photo-input');
    const previewContainer = document.getElementById('photo-preview');

    if (
      !openBtn ||
      !closeBtn ||
      !cameraContainer ||
      !videoEl ||
      !selectEl ||
      !canvasEl ||
      !takeBtn
    ) {
      // required elements not present
      return;
    }

    openBtn.addEventListener('click', async () => {
      cameraContainer.hidden = false;
      cameraContainer.classList.add('open');
      // instantiate camera if not exists
      if (!this.#camera) {
        this.#camera = new Camera({ video: videoEl, cameraSelect: selectEl, canvas: canvasEl });
      }

      // reset transforms when opening
      this.#cameraRotated = false;
      this.#cameraMirrored = false;
      videoEl.classList.remove('video-rotated', 'video-mirrored');

      await this.#camera.launch();
    });

    closeBtn.addEventListener('click', async () => {
      cameraContainer.hidden = true;
      cameraContainer.classList.remove('open');
      if (this.#camera) {
        this.#camera.stop();
      }
    });

    // Mirror/rotate controls
    const updateVideoTransform = () => {
      videoEl.classList.toggle('video-mirrored', this.#cameraMirrored);
      videoEl.classList.toggle('video-rotated', this.#cameraRotated);
    };

    if (mirrorBtn) {
      mirrorBtn.addEventListener('click', () => {
        this.#cameraMirrored = !this.#cameraMirrored;
        updateVideoTransform();
      });
    }

    if (rotateBtn) {
      rotateBtn.addEventListener('click', () => {
        this.#cameraRotated = !this.#cameraRotated;
        updateVideoTransform();
      });
    }

    // take photo
    this.#cameraClickHandler = async () => {
      if (!this.#camera) return;
      const blob = await this.#camera.takePicture();
      if (!blob) return;

      // Convert blob to File and set to file input via DataTransfer
      try {
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: blob.type });
        const dt = new DataTransfer();
        dt.items.add(file);
        photoInput.files = dt.files;

        // show preview
        const reader = new FileReader();
        reader.onload = (e) => {
          previewContainer.innerHTML = `<img src="${e.target.result}" alt="Preview" class="photo-preview__image">`;
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('Error setting captured photo to input', err);
      }

      // close camera after capture
      cameraContainer.hidden = true;
      cameraContainer.classList.remove('open');
      this.#camera.stop();
    };

    takeBtn.addEventListener('click', this.#cameraClickHandler);
  }

  #setupForm() {
    const form = document.getElementById('new-story-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const formData = {
        description: document.getElementById('description-input').value,
        photo: document.getElementById('photo-input').files[0],
        lat: document.getElementById('lat-input').value || undefined,
        lon: document.getElementById('lon-input').value || undefined,
      };

      await this.#presenter.addNewStory(formData);
    });
  }

  #setupPhotoPreview() {
    const photoInput = document.getElementById('photo-input');
    const previewContainer = document.getElementById('photo-preview');

    photoInput.addEventListener('change', () => {
      const file = photoInput.files[0];
      if (file) {
        // Validasi ukuran file
        if (file.size > 1024 * 1024) {
          // 1MB
          alert('Ukuran foto harus kurang dari 1MB');
          photoInput.value = '';
          previewContainer.innerHTML = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          previewContainer.innerHTML = `
            <img src="${e.target.result}" alt="Preview" class="photo-preview__image">
          `;
        };
        reader.readAsDataURL(file);
      } else {
        previewContainer.innerHTML = '';
      }
    });
  }

  storyAddedSuccessfully(message) {
    alert(message);
    // Redirect ke halaman utama
    location.hash = '/';
  }

  storyAddedFailed(message) {
    alert(message);
  }

  showSubmitLoadingButton() {
    document.getElementById('submit-button-container').innerHTML = `
      <button class="btn" type="submit" disabled>
        <i class="fas fa-spinner loader-button"></i> Membagikan Cerita...
      </button>
    `;
  }

  hideSubmitLoadingButton() {
    document.getElementById('submit-button-container').innerHTML = `
      <button class="btn" type="submit">Bagikan Cerita</button>
    `;
  }
}
