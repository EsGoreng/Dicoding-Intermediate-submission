export default class HomePresenter {
  #view;
  #model;
  #savedUtil = null;
  #cacheUtil = null;

  constructor({ view, model }) {
    this.#view = view;
    this.#model = model;
    this.#savedUtil = require('../../utils/saved');
    this.#cacheUtil = require('../../utils/cache');
  }

  async initialGalleryAndMap() {
    this.#view.showLoading();
    this.#view.showMapLoading();
    try {
      const response = await this.#model.getAllStories();

      if (!response.ok) {
        console.error('initialGallery: response:', response);

        // Try to show cached stories if online request failed
        if (!navigator.onLine) {
          await this._showCachedStories();
          return;
        }

        this.#view.populateReportsListError(response.message);
        return;
      }

      const stories = response.listStory || [];

      // Cache the stories for offline use
      if (stories.length > 0) {
        await this.#cacheUtil.cacheStories(stories);
      }

      this.#view.populateReportsList(response.message, stories);
      await this.#view.initialMap(stories);
      // attach save button handlers after rendering
      this._attachSaveHandlers(stories);
    } catch (error) {
      console.error('initialGallery: error:', error);

      // Try to show cached stories if fetch failed
      if (!navigator.onLine) {
        await this._showCachedStories();
        return;
      }

      this.#view.populateReportsListError(error.message);
    } finally {
      this.#view.hideLoading();
      this.#view.hideMapLoading();
    }
  }

  async _showCachedStories() {
    try {
      const cachedStories = await this.#cacheUtil.getCachedStories();

      if (cachedStories && cachedStories.length > 0) {
        this.#view.populateReportsList('Cerita dari Cache (Mode Offline)', cachedStories);
        await this.#view.initialMap(cachedStories);
        this._attachSaveHandlers(cachedStories);
      } else {
        this.#view.populateReportsListError(
          'Tidak ada koneksi internet dan tidak ada cerita yang di-cache',
        );
      }
    } catch (error) {
      console.error('_showCachedStories error:', error);
      this.#view.populateReportsListError('Error loading cached stories: ' + error.message);
    }
  }

  async showSavedStories() {
    try {
      this.#view.showLoading();
      const saved = await this.#savedUtil.getAllSaved();
      if (!saved || saved.length === 0) {
        this.#view.populateReportsList('No saved stories', []);
        return;
      }
      this.#view.populateReportsList('Saved stories', saved || []);
      await this.#view.initialMap(saved || []);
      this._attachSaveHandlers(saved || []);
    } catch (e) {
      console.error('showSavedStories error', e);
      this.#view.populateReportsListError(e.message);
    } finally {
      this.#view.hideLoading();
    }
  }

  _attachSaveHandlers(stories = []) {
    // attach click handlers for each save button
    const buttons = document.querySelectorAll('.story-item__save');
    buttons.forEach((btn) => {
      const id = btn.getAttribute('data-storyid');
      // prevent propagation to wrapper click
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        try {
          const isSaved = await this.#savedUtil.isSaved(id);
          if (isSaved) {
            await this.#savedUtil.removeStory(id);
            btn.innerHTML = '<i class="far fa-bookmark"></i> Simpan';
          } else {
            // find story object
            const storyObj = (stories || []).find((s) => String(s.id) === String(id));
            if (storyObj) {
              await this.#savedUtil.saveStory(storyObj);
              btn.innerHTML = '<i class="fas fa-bookmark"></i> Tersimpan';
            }
          }
        } catch (err) {
          console.error('save button handler error', err);
        }
      });

      // initial state render
      (async () => {
        try {
          const saved = await this.#savedUtil.isSaved(id);
          if (saved) btn.innerHTML = '<i class="fas fa-bookmark"></i> Tersimpan';
        } catch (e) {
          // ignore
        }
      })();
    });
  }
}
