import {
  DiscoverSectionType,
  type DiscoverSection,
  type DiscoverSectionItem,
  type PagedResults,
  type ProminentCarouselItem,
  type SimpleCarouselItem,
} from "@paperback/types";

import type CatalogParameters from "./catalog";
import type RatingTracker from "./rating";
import { ProjectSearchMetadata } from "./search";
import { fetchPage, scrapeGlobals } from "./utils";

const RELOAD_MS = 1000 * 60 * 60 * 8;
const STATE_KEY = "mangadraft_homepage";

/**
 * Type representing data from MangaDraft's home page
 */
type HomePageData = {
  originals: ProminentCarouselItem[];
  contestTitle: string;
  contestDesc: string;
  contestEntries: SimpleCarouselItem[];
  sponsors: SimpleCarouselItem[];
  trending: SimpleCarouselItem[];
};

/**
 * Exists purely to make sure mistakes don't happen when loading
 * and saving state
 */
type HomePageState = {
  lastUpdated: string;
  data: HomePageData;
};

/**
 * Class for loading and managing data from MangaDraft's home page
 */
export default class HomePage {
  private data: HomePageData;
  private lastUpdated: Date | undefined;
  private catalogParams: CatalogParameters;
  private ratingTracker: RatingTracker;
  private projects: Set<string> = new Set();

  constructor(catalogParams: CatalogParameters, ratingTracker: RatingTracker) {
    this.catalogParams = catalogParams;
    this.ratingTracker = ratingTracker;
    const state = Application.getState(STATE_KEY) as HomePageState | undefined;
    if (state) {
      this.data = state.data;
      this.lastUpdated = new Date(state.lastUpdated);
    } else {
      this.data = {
        originals: [],
        contestTitle: "",
        contestDesc: "",
        contestEntries: [],
        sponsors: [],
        trending: [],
      };
    }
  }

  /**
   * Loads the home page unconditionally
   */
  async load() {
    this.projects.clear();
    const $document = await fetchPage("https://www.mangadraft.com/");
    const { data } = scrapeGlobals($document, ["banners", "data"]);
    this.data.originals = data.originals.map((e: any) => this.parseProminentSectionItem(e));
    this.data.contestTitle = data.contest.title;
    this.data.contestDesc = data.contest.subtitle;
    this.data.contestEntries = data.contest.data.map((e: any) => this.parseSimpleSectionItem(e));
    this.data.sponsors = data.sponsors.data.map((e: any) => this.parseSimpleSectionItem(e));
    this.data.trending = data.trending.map((e: any) => this.parseSimpleSectionItem(e));
    this.lastUpdated = new Date();
    Application.setState(
      { lastUpdated: this.lastUpdated.toISOString(), data: this.data } as HomePageState,
      STATE_KEY,
    );
  }

  /**
   * Loads/reloads the home page only if needed
   *
   * This runs if it hasn't previously been loaded, and if
   * the discover sections haven't been updated in a while.
   */
  async loadIfNeeded() {
    const last = this.lastUpdated;
    if (last === undefined || Date.now() - last.getTime() >= RELOAD_MS) {
      await this.load();
    }
  }

  /**
   * Checks whether a project with the given ID is present in the home page's
   * discover section
   * @param id The project's ID
   * @returns Whether it is present
   */
  contains(id: number | string): boolean {
    return this.projects.has(id.toString());
  }

  /**
   * @returns A list of the discover sections to display
   */
  async getDiscoverSections(): Promise<DiscoverSection[]> {
    await this.loadIfNeeded();
    return [
      {
        id: "originals",
        title: "MangaDraft Originals",
        subtitle: "Des séries exclusives, à lire uniquement sur Mangadraft",
        type: DiscoverSectionType.prominentCarousel,
      },
      {
        id: "contest",
        title: this.data.contestTitle,
        subtitle: this.data.contestDesc,
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "trending",
        title: "Trending Today",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "sponsors",
        title: "Sponsored Projects",
        type: DiscoverSectionType.simpleCarousel,
      },
      {
        id: "genres",
        title: "Explore by Genre",
        type: DiscoverSectionType.genres,
      },
    ];
  }

  /**
   * Gets a list of items for a specific discover section
   * @param section The section
   * @param metadata Metadata for pagination
   * @returns The items
   */
  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata?: number,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    void metadata;

    switch (section.id) {
      case "originals":
        return { items: this.data.originals };
      case "contest":
        return { items: this.data.contestEntries };
      case "trending":
        return { items: this.data.trending };
      case "sponsors":
        return { items: this.data.sponsors };
      case "genres":
        await this.catalogParams.loadIfNeeded();
        return {
          items: this.catalogParams.getGenreTags().map((tag) => {
            return {
              type: "genresCarouselItem",
              searchQuery: {
                title: "",
                metadata: { ...ProjectSearchMetadata.DEFAULT, genre: tag.id },
              },
              name: tag.title,
            };
          }),
        };
      default:
        return { items: [] };
    }
  }

  private parseSectionItem(entry: any) {
    this.projects.add(entry.id.toString());
    return {
      mangaId: entry.id.toString(),
      imageUrl: entry.avatar as string,
      title: (entry.title || entry.name) as string,
      contentRating: this.ratingTracker.getContentRating(entry.id),
    };
  }

  private parseSimpleSectionItem(entry: any): SimpleCarouselItem {
    return {
      type: "simpleCarouselItem",
      ...this.parseSectionItem(entry),
    };
  }

  private parseProminentSectionItem(entry: any): ProminentCarouselItem {
    return {
      type: "prominentCarouselItem",
      ...this.parseSectionItem(entry),
    };
  }
}
