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

const RELOAD_MS = 1000 * 60 * 60 * 24;

/**
 * Class for loading and managing data from MangaDraft's home page
 */
export default class HomePage {
  // properties
  private lastUpdated: Date | undefined;
  private catalogParams: CatalogParameters;
  private ratingTracker: RatingTracker;
  private projects: Set<string> = new Set();
  // data
  private originals: ProminentCarouselItem[] = [];
  private contestTitle: string = "";
  private contestDesc: string = "";
  private contestEntries: SimpleCarouselItem[] = [];
  private sponsors: SimpleCarouselItem[] = [];
  private trending: SimpleCarouselItem[] = [];

  constructor(catalogParams: CatalogParameters, ratingTracker: RatingTracker) {
    this.catalogParams = catalogParams;
    this.ratingTracker = ratingTracker;
  }

  /**
   * Loads the home page unconditionally
   */
  async load() {
    this.projects.clear();
    this.lastUpdated = new Date();
    const $document = await fetchPage("https://www.mangadraft.com/");
    const { data } = scrapeGlobals($document, ["banners", "data"]);
    this.originals = data.originals.map((e: any) => this.parseProminentSectionItem(e));
    this.contestTitle = data.contest.title;
    this.contestDesc = data.contest.subtitle;
    this.contestEntries = data.contest.data.map((e: any) => this.parseSimpleSectionItem(e));
    this.sponsors = data.sponsors.data.map((e: any) => this.parseSimpleSectionItem(e));
    this.trending = data.trending.map((e: any) => this.parseSimpleSectionItem(e));
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
        title: this.contestTitle,
        subtitle: this.contestDesc,
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
        return { items: this.originals };
      case "contest":
        return { items: this.contestEntries };
      case "trending":
        return { items: this.trending };
      case "sponsors":
        return { items: this.sponsors };
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
