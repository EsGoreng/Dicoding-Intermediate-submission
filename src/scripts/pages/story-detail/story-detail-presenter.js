export default class StoryDetailPresenter {
  #view = null;
  #model = null;
  #id = null;

  constructor({ view, model }) {
    this.#view = view;
    this.#model = model;

    this.#initUrlParams();
  }

  #initUrlParams() {
    const pathname = window.location.hash.replace('#', '');
    this.#id = pathname.split('/').pop();
  }

  async getStoryDetail() {
    try {
      const response = await this.#model.getStoryById(this.#id);

      if (response.error) {
        throw new Error(response.message);
      }

      this.#view.displayStoryDetail(response.story);
    } catch (error) {
      this.#view.displayErrorMessage(error.message);
    }
  }
}
