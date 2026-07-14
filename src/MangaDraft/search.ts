import {
  AdvancedSearchForm,
  Section,
  SelectRow,
  type SearchQuery,
  type SortingOption,
} from "@paperback/types";

import type CatalogParameters from "./catalog";

/**
 * Enum representing different ways projects can be ordered
 * in the MangaDraft catalog
 */
export enum ProjectOrder {
  Trending = 1,
  Popular,
  Recent,
  Likes,
  Comments,
  Views,
  Name,
}

export namespace ProjectOrder {
  /**
   * Converts a numeric ID to a `ProjectOrder` enum member
   * @param id The ID as a string or number
   * @returns The associated enum member
   */
  export function fromId(id: string | number): ProjectOrder {
    id = typeof id == "number" ? id : parseInt(id);
    if (!ProjectOrder[id]) throw new TypeError(`Unrecognized project order ID: ${id}`);
    return id as ProjectOrder;
  }

  /**
   * Builds an API query parameter for the given project order
   * @param order The project order
   * @returns The query parameter, as it would appear in /api/catalog/projects
   */
  export function getQueryParam(order?: ProjectOrder) {
    if (!order) return "";
    const value = order === ProjectOrder.Recent ? "news" : ProjectOrder[order].toLowerCase();
    return `order=${value}`;
  }
}

export const SORT_OPTIONS: SortingOption[] = Object.keys(ProjectOrder)
  .filter((v) => !isNaN(Number(v)))
  .map((v) => {
    return { id: v, label: ProjectOrder[parseInt(v)]! };
  });

/**
 * Type containing all options for filtering a catalog search
 */
export type ProjectSearchMetadata = {
  type: "all" | "bd.manga" | "webtoons" | "novels" | "artbooks";
  section: "indepolis" | "original" | "neoville";
  status: "any" | `${number}`;
  format: string;
  genre: string;
  language: string;
};

export namespace ProjectSearchMetadata {
  export const DEFAULT: ProjectSearchMetadata = {
    type: "all",
    section: "indepolis",
    status: "any",
    format: "any",
    genre: "any",
    language: "any",
  };

  /**
   * Builds a list of API query parameters for the given search metadata
   * @param metadata The metadata (defaults to `DEFAULT` if not provided)
   * @returns The API query parameters, as they would appear in /api/catalog/projects
   */
  export function getQueryParams(metadata?: ProjectSearchMetadata) {
    metadata = metadata || DEFAULT;
    let string = `type=${metadata.type}&section=${metadata.section}`;
    if (metadata.status != "any") string += `&status=${metadata.status}`;
    if (metadata.format != "any") string += `&format=${metadata.format}`;
    if (metadata.genre != "any") string += `&genre=${metadata.genre}`;
    if (metadata.language != "any") string += `&language=${metadata.language}`;
    return string;
  }
}

export class ProjectSearchForm extends AdvancedSearchForm {
  private visible: boolean;
  private query: ProjectSearchMetadata;
  private catalogParams: CatalogParameters;

  constructor(query: SearchQuery<ProjectSearchMetadata>, catalogParams: CatalogParameters) {
    super();
    this.visible = query.title.trim().length == 0;
    this.query = query.metadata || ProjectSearchMetadata.DEFAULT;
    this.catalogParams = catalogParams;
  }

  override getSearchQueryMetadata(): ProjectSearchMetadata {
    return this.query;
  }

  override getSections() {
    if (!this.visible) return [];
    return [
      Section("filter", [
        SelectRow("catalog", {
          title: "Catalog",
          layout: "list",
          value: [this.query.type],
          minItemCount: 1,
          maxItemCount: 1,
          items: [
            { id: "all", title: "All" },
            { id: "bd.manga", title: "BD / Manga" },
            { id: "webtoons", title: "Webtoon" },
            { id: "novels", title: "Light Novel" },
            { id: "artbooks", title: "Artbook" },
          ],
          onValueChange: Application.Selector(this as ProjectSearchForm, "handleTypeChange"),
        }),
        SelectRow("section", {
          title: "Section",
          layout: "list",
          value: [this.query.section],
          minItemCount: 1,
          maxItemCount: 1,
          items: [
            { id: "indepolis", title: "Indepolis" },
            { id: "original", title: "Original" },
            { id: "neoville", title: "Neoville" },
          ],
          onValueChange: Application.Selector(this as ProjectSearchForm, "handleSectionChange"),
        }),
        SelectRow("status", {
          title: "Status",
          layout: "list",
          value: [this.query.status],
          minItemCount: 1,
          maxItemCount: 1,
          items: [{ id: "any", title: "Any" }, ...this.catalogParams!.getStatusTags()],
          onValueChange: Application.Selector(this as ProjectSearchForm, "handleStatusChange"),
        }),
        SelectRow("format", {
          title: "Format",
          layout: "list",
          value: [this.query.format],
          minItemCount: 1,
          maxItemCount: 1,
          items: [{ id: "any", title: "Any" }, ...this.catalogParams!.getFormatTags()],
          onValueChange: Application.Selector(this as ProjectSearchForm, "handleFormatChange"),
        }),
        SelectRow("genre", {
          title: "Genre",
          layout: "list",
          value: [this.query.genre],
          minItemCount: 1,
          maxItemCount: 1,
          items: [{ id: "any", title: "Any" }, ...this.catalogParams!.getGenreTags()],
          onValueChange: Application.Selector(this as ProjectSearchForm, "handleGenreChange"),
        }),
        SelectRow("language", {
          title: "Language",
          layout: "list",
          value: [this.query.language],
          minItemCount: 1,
          maxItemCount: 1,
          items: [{ id: "any", title: "Any" }, ...this.catalogParams!.getLanguageTags()],
          onValueChange: Application.Selector(this as ProjectSearchForm, "handleLanguageChange"),
        }),
      ]),
    ];
  }

  async handleTypeChange(type: string[]) {
    this.query.type = type[0]! as any;
    this.reloadForm();
  }

  async handleSectionChange(section: string[]) {
    this.query.section = section[0]! as any;
    this.reloadForm();
  }

  async handleStatusChange(status: string[]) {
    this.query.status = status[0]! as any;
    this.reloadForm();
  }

  async handleFormatChange(format: string[]) {
    this.query.format = format[0]!;
    this.reloadForm();
  }

  async handleGenreChange(genre: string[]) {
    this.query.genre = genre[0]!;
    this.reloadForm();
  }

  async handleLanguageChange(language: string[]) {
    this.query.language = language[0]!;
    this.reloadForm();
  }
}
