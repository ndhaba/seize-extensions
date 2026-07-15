/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2025 Inkdex */

import {
  BasicRateLimiter,
  ContentRating,
  type Form,
  type AdvancedSearchForm,
  type Chapter,
  type ChapterDetails,
  type DiscoverSection,
  type DiscoverSectionItem,
  type ExtensionImpl,
  type Metadata,
  type PagedResults,
  type SearchQuery,
  type SearchResultItem,
  type SortingOption,
  type SourceManga,
  type Tag,
  type TagSection,
} from "@paperback/types";

import CatalogParameters from "./catalog";
import HomePage from "./home";
import type MangaDraftConfig from "./pbconfig";
import RatingTracker from "./rating";
import { SORT_OPTIONS, ProjectSearchForm, ProjectSearchMetadata, ProjectOrder } from "./search";
import SettingsForm from "./settings";
import { fetchJson, fetchPage, scrapeGlobals } from "./utils";

const CHAPTER_WORDS = new Set(["chapitre", "chapter", "episode"]);
const PROLOGUE_WORDS = new Set(["prologue"]);

const PROJECT_TYPES = [
  undefined,
  "Manga",
  "Bande dessinée",
  undefined,
  "Artbook",
  "Light Novel",
  undefined,
  "Webtoon",
  "Nolovel",
];

const ACCESS_TYPES: Partial<Record<string, string>> = {
  free: "Free",
  paying: "Paid",
  limited: "Limited",
};

// Main extension class
export class MangaDraftExtension implements ExtensionImpl<typeof MangaDraftConfig> {
  catalogParams: CatalogParameters = new CatalogParameters();
  ratingTracker: RatingTracker = new RatingTracker("mangadraft_ratings");
  homePage: HomePage = new HomePage(this.catalogParams, this.ratingTracker);

  mainRateLimiter = new BasicRateLimiter("main", {
    numberOfRequests: 15,
    bufferInterval: 10,
    ignoreImages: true,
  });

  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
  }

  getDiscoverSections(): Promise<DiscoverSection[]> {
    return this.homePage.getDiscoverSections();
  }

  getDiscoverSectionItems(
    section: DiscoverSection,
    metadata?: number,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    return this.homePage.getDiscoverSectionItems(section, metadata);
  }

  // Populates the title details
  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    await this.catalogParams.loadIfNeeded();
    const project = await fetchJson(
      `https://www.mangadraft.com/api/project/${mangaId}?with=genres&locale=fr`,
      `https://www.mangadraft.com/`,
    );
    const tagGroups: TagSection[] = [];
    const metaTags: Tag[] = [];
    const languageTag = this.catalogParams.getLanguageTagById(project.data.language, true);
    metaTags.push(languageTag);
    metaTags.push({
      id: project.data.project_type_id,
      title: PROJECT_TYPES[project.data.project_type_id] || project.data.project_type,
    });
    if (project.data.original) {
      metaTags.push({
        id: "original",
        title: "Original",
      });
    }
    metaTags.push(this.catalogParams.getFormatTagByValue(project.data.publication_type));
    metaTags.push({
      id: "access:" + project.data.publication_mode,
      title: ACCESS_TYPES[project.data.publication_mode] || project.data.publication_mode_label,
    });
    tagGroups.push({
      id: "metadata",
      title: "Metadata",
      tags: metaTags,
    });
    tagGroups.push({
      id: "genres",
      title: "Genres",
      tags: project.data.genres.map(function (genre: any) {
        return {
          id: genre.slug,
          title: genre.name,
        };
      }),
    });
    let contentRating = ContentRating.EVERYONE;
    if (project.data.cautions) {
      for (const caution of project.data.cautions) {
        if (caution.caution_type_id === 13) {
          contentRating = ContentRating.ADULT;
        } else if (caution.caution_type_id === 12) {
          contentRating = ContentRating.MATURE;
        }
      }
    }
    if (this.ratingTracker.setContentRating(mangaId, contentRating)) {
      if (this.homePage.contains(mangaId)) {
        Application.invalidateDiscoverSections();
      }
    }
    return {
      mangaId: mangaId,
      mangaInfo: {
        thumbnailUrl: project.data.avatar,
        synopsis: project.data.description,
        primaryTitle: project.data.name,
        secondaryTitles: [],
        contentRating: contentRating,
        contentType: "comic",
        status: this.catalogParams.getStatusTagById(project.data.project_status_id).title,
        author: project.data.user.name,
        bannerUrl: project.data.background,
        shareUrl: project.data.url,
        tagGroups: tagGroups,
        additionalInfo: {
          slug: project.data.slug,
          projectType: project.data.project_type_id.toString(),
          langCode: languageTag.id,
          publishDate: project.data.created_at,
        },
      },
    };
  }

  // Populates the chapter list
  async getChapters(sourceManga: SourceManga, sinceDate?: Date): Promise<Chapter[]> {
    void sinceDate;
    const mangaId = sourceManga.mangaId;
    if (this.ratingTracker.setContentRating(mangaId, sourceManga.mangaInfo.contentRating)) {
      if (this.homePage.contains(mangaId)) {
        Application.invalidateDiscoverSections();
      }
    }
    switch (sourceManga.mangaInfo.additionalInfo!.projectType) {
      case "7": // webtoon
      case "8": // nolovel
        return await this.getChaptersFromAPI(sourceManga);
      default:
        return await this.getChaptersFromReader(sourceManga);
    }
  }

  async getChaptersFromAPI(source: SourceManga): Promise<Chapter[]> {
    const response = await fetchJson(
      `https://www.mangadraft.com/api/reader/${source.mangaId}/categories?number=200&paginate=between&locale=fr`,
    );
    return this.getUntomedChapters(response, source);
  }

  async getChaptersFromReader(source: SourceManga): Promise<Chapter[]> {
    const $document = await fetchPage(
      `https://www.mangadraft.com/reader/${source.mangaInfo.additionalInfo!.slug!}`,
    );
    const { categories } = scrapeGlobals($document, ["categories"]);
    if (categories.TOME?.length > 0) {
      return this.getTomedChapters(categories, source);
    } else if (Object.keys(categories.CHAPTER).length > 0) {
      return this.getUntomedChapters(categories, source);
    } else {
      return [
        {
          chapterId: "self",
          sourceManga: source,
          langCode: source.mangaInfo.additionalInfo!.langCode!,
          chapNum: 1,
          title: source.mangaInfo.primaryTitle,
          volume: 0,
          publishDate: new Date(source.mangaInfo.additionalInfo!.publishDate!),
        },
      ];
    }
  }

  getTomedChapters(cat: any, source: SourceManga): Chapter[] {
    const chapters: Chapter[] = [];
    let chapterCounter = 1;
    const pushChapter = (chapter: any, tome: any) => {
      const chapNumDefault = chapterCounter++;
      if (chapter.price_credit > 0) return;
      const [title, chapNum] = this.extractChapterNumber(chapter.name, chapNumDefault);
      // :(
      void chapNum;
      chapters.push({
        chapterId: chapter.id,
        sourceManga: source,
        langCode: source.mangaInfo.additionalInfo!.langCode!,
        chapNum: chapNumDefault,
        title: title,
        volume: tome.order,
        publishDate: new Date(chapter.published_at),
      });
    };
    for (const tome of cat.TOME) {
      if (cat.CHAPTER[tome.id]) {
        for (const chapter of cat.CHAPTER[tome.id]) {
          pushChapter(chapter, tome);
        }
      } else {
        pushChapter(tome, { order: 0 });
      }
    }
    return chapters;
  }

  getUntomedChapters(cat: any, source: SourceManga): Chapter[] {
    const chapters: Chapter[] = [];
    for (const chapter of cat.CHAPTER[cat.ROOT[0].id]) {
      if (chapter.price_credit > 0) continue;
      const [title, chapNum] = this.extractChapterNumber(chapter.name, chapter.order);
      // :(
      void chapNum;
      chapters.push({
        chapterId: chapter.id,
        sourceManga: source,
        langCode: source.mangaInfo.additionalInfo!.langCode!,
        chapNum: chapter.order,
        title: title,
        volume: 0,
        publishDate: new Date(chapter.published_at),
      });
    }
    return chapters;
  }

  extractChapterNumber(title: string, defaultEp: number): [string, number] {
    if (PROLOGUE_WORDS.has(title)) return [title, 9.5];
    const match = title.match(/(\w+) *(\d+) *[:-] *([\s\S]+)/);
    if (match === null) return [title, defaultEp];
    const [, word, no, realTitle] = match;
    if (!CHAPTER_WORDS.has(word!.toLowerCase())) return [title, defaultEp];
    return [realTitle!, parseInt(no!)];
  }

  // Populates a chapter with images
  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const $reader = await fetchPage(
      `https://www.mangadraft.com/reader/${chapter.sourceManga.mangaInfo.additionalInfo!.slug!}/c.${chapter.chapterId}`,
    );
    const { firstPage } = scrapeGlobals($reader, ["firstPage"]);
    const pages = await fetchJson(
      `https://www.mangadraft.com/api/reader/listPages?first_page=${firstPage.id}&grouped_by_category=true&locale=fr`,
    );
    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      type: "images",
      pages: pages[chapter.chapterId].map(function (page: any) {
        return page.url + "?size=full";
      }),
    };
  }

  // Populates search filters in a form
  async getAdvancedSearchForm(
    query: SearchQuery<ProjectSearchMetadata>,
  ): Promise<AdvancedSearchForm> {
    await this.catalogParams.loadIfNeeded();
    return new ProjectSearchForm(query, this.catalogParams);
  }

  // Populates search
  getSearchResults(
    query: SearchQuery<ProjectSearchMetadata>,
    metadata?: number,
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const trimmedTitle = query.title.trim();
    switch (trimmedTitle.length) {
      case 0:
        return this.getSearchResultsFromCatalog(query, metadata, sortingOption);
      case 1:
        return Promise.resolve({ items: [] });
      default:
        return this.getSearchResultsFromAutocomplete(trimmedTitle);
    }
  }

  async getSearchResultsFromAutocomplete(title: string) {
    const url = `https://www.mangadraft.com/api/search/autocomplete?value=${encodeURIComponent(title)}&locale=fr`;
    const response = await fetchJson(url, "https://www.mangadraft.com/catalog");
    const items: SearchResultItem[] = (response.data as any[])
      .filter((result: any) => result.type != "user")
      .map((result: any) => {
        return {
          mangaId: result.id.toString(),
          title: result.name,
          imageUrl: result.avatar,
          contentRating: this.ratingTracker.getContentRating(result.id),
        };
      });
    return { items };
  }

  async getSearchResultsFromCatalog(
    query: SearchQuery<ProjectSearchMetadata>,
    metadata?: number,
    sortingOption?: SortingOption,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata || 1;
    const sort = sortingOption ? ProjectOrder.fromId(sortingOption.id) : ProjectOrder.Trending;
    const url = `https://www.mangadraft.com/api/catalog/projects?number=16&page=${page}&${ProjectOrder.getQueryParam(sort)}&${ProjectSearchMetadata.getQueryParams(query.metadata)}&locale=fr`;
    const response = await fetchJson(url, "https://www.mangadraft.com/catalog");
    const items: SearchResultItem[] = (response.data as any[]).map((result: any) => {
      return {
        mangaId: result.id.toString(),
        title: result.name,
        subtitle: result.user.name,
        imageUrl: result.avatar,
        contentRating: this.ratingTracker.getContentRating(result.id),
      };
    });
    return {
      items: items,
      metadata: response.links.next ? page + 1 : undefined,
    };
  }

  getSortingOptions(query: SearchQuery<Metadata>): Promise<SortingOption[]> {
    if (query.title.length > 0) {
      return Promise.resolve([]);
    } else {
      return Promise.resolve(SORT_OPTIONS);
    }
  }

  getSettingsForm(): Promise<Form> {
    return Promise.resolve(new SettingsForm(this.catalogParams, this.homePage));
  }
}

export const MangaDraft = new MangaDraftExtension();
