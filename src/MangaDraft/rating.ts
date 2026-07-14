import type { ContentRating } from "@paperback/types";

/**
 * Helper class for tracking content ratings, useful for when
 * search and discover pages aren't immediately able to determine
 * content ratings from the payloads they receive.
 */
export default class RatingTracker {
  private key: string;
  private ratings: Partial<Record<string, ContentRating>>;

  constructor(key: string) {
    this.key = key;
    this.ratings = Application.getState(key) || {};
  }

  /**
   * Attempts to get the content rating of the project with the given ID
   * @param id The project's ID
   * @returns The project's content rating, if it has been previously stored
   */
  getContentRating(id: string | number): ContentRating | undefined {
    return this.ratings[id.toString()];
  }

  /**
   * Updates the rating of a specific project
   * @param id The project's ID
   * @param rating The content rating
   * @returns Whether or not the stored rating for the project has changed
   */
  setContentRating(id: string | number, rating: ContentRating): boolean {
    const changed = this.ratings[id] != rating;
    this.ratings[id] = rating;
    if (changed) Application.setState(this.ratings, this.key);
    return changed;
  }
}
