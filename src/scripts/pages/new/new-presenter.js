import * as SyncUtil from '../../utils/sync';

export default class NewPresenter {
  #view;
  #model;

  constructor({ view, model }) {
    this.#view = view;
    this.#model = model;
  }

  async addNewStory({ description, photo, lat, lon }) {
    this.#view.showSubmitLoadingButton();
    try {
      // If offline, enqueue for background sync
      if (!navigator.onLine) {
        // store token at enqueue time
        const token = (await import('../../utils/auth')).getAccessToken();
        await SyncUtil.enqueueStory({ description, photo, lat, lon, token });
        this.#view.storyAddedSuccessfully(
          'Anda sedang offline. Cerita disimpan sementara dan akan disinkronkan saat koneksi kembali.',
        );
        return;
      }

      // Try online submission
      const response = await this.#model.addNewStory({ description, photo, lat, lon });

      if (!response.ok) {
        // If response failed due to network/server, enqueue for later sync
        console.error('addNewStory: response failed:', response);
        const token = (await import('../../utils/auth')).getAccessToken();
        await SyncUtil.enqueueStory({ description, photo, lat, lon, token });
        this.#view.storyAddedSuccessfully(
          'Gagal mengunggah sekarang. Cerita disimpan sementara dan akan disinkronkan nanti.',
        );
        return;
      }

      this.#view.storyAddedSuccessfully('Cerita berhasil dibagikan!');
    } catch (error) {
      console.error('addNewStory: error:', error);
      // On unexpected error (likely network), enqueue for later sync
      try {
        const token = (await import('../../utils/auth')).getAccessToken();
        await SyncUtil.enqueueStory({ description, photo, lat, lon, token });
        this.#view.storyAddedSuccessfully(
          'Anda sedang offline atau terjadi gangguan. Cerita disimpan dan akan disinkronkan saat koneksi kembali.',
        );
      } catch (e) {
        this.#view.storyAddedFailed(error.message || 'Gagal membagikan cerita');
      }
    } finally {
      this.#view.hideSubmitLoadingButton();
    }
  }
}
