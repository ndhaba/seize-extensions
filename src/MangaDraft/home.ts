import {
  ContentRating,
  DiscoverSectionType,
  type DiscoverSection,
  type DiscoverSectionItem,
  type PagedResults,
  type ProminentCarouselItem,
  type SimpleCarouselItem,
} from "@paperback/types";

import type CatalogParameters from "./catalog";
import { DEFAULT_SEARCH_METADATA } from "./search";
import { fetchPage, scrapeGlobals } from "./utils";

const RELOAD_MS = 1000 * 60 * 60 * 24;

/**
 * Class for loading and managing data from MangaDraft's home page
 */
export default class HomePage {
  // properties
  private lastUpdated: Date | undefined;
  private catalogParams: CatalogParameters;
  // data
  private originals: ProminentCarouselItem[] = [];
  private contestTitle: string = "";
  private contestDesc: string = "";
  private contestEntries: SimpleCarouselItem[] = [];
  private sponsors: SimpleCarouselItem[] = [];
  private trending: SimpleCarouselItem[] = [];

  constructor(catalogParams: CatalogParameters) {
    this.catalogParams = catalogParams;
  }

  /**
   * Loads the home page unconditionally
   */
  async load() {
    this.lastUpdated = new Date();
    const $document = await fetchPage("https://www.mangadraft.com/");
    const { data } = scrapeGlobals($document, ["banners", "data"]);
    this.originals = data.originals.map(parseProminentSectionItem);
    this.contestTitle = data.contest.title;
    this.contestDesc = data.contest.subtitle;
    this.contestEntries = data.contest.data.map(parseSimpleSectionItem);
    this.sponsors = data.sponsors.data.map(parseSimpleSectionItem);
    this.trending = data.trending.map(parseSimpleSectionItem);
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
              searchQuery: { title: "", metadata: { ...DEFAULT_SEARCH_METADATA, genre: tag.id } },
              name: tag.title,
            };
          }),
        };
      default:
        return { items: [] };
    }
  }
}

function parseSectionItem(entry: any) {
  return {
    mangaId: entry.id.toString(),
    imageUrl: entry.avatar as string,
    title: (entry.title || entry.name) as string,
    contentRating: ContentRating.EVERYONE,
  };
}

function parseSimpleSectionItem(entry: any): SimpleCarouselItem {
  return {
    type: "simpleCarouselItem",
    ...parseSectionItem(entry),
  };
}

function parseProminentSectionItem(entry: any): ProminentCarouselItem {
  return {
    type: "prominentCarouselItem",
    ...parseSectionItem(entry),
  };
}
