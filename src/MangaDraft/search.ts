import {
  AdvancedSearchForm,
  Section,
  SelectRow,
  type SearchQuery,
  type SortingOption,
} from "@paperback/types";

import type CatalogParameters from "./catalog";

export enum ProjectOrder {
  Trending = 0,
  Popular,
  Recent,
  Likes,
  Comments,
  Views,
  Name,
}

function getProjectOrderQueryValue(order: ProjectOrder) {
  switch (order) {
    case ProjectOrder.Recent:
      return "news";
    default:
      return ProjectOrder[order].toLowerCase();
  }
}

export function getProjectOrderQueryParam(order?: ProjectOrder) {
  return (order && `order=${getProjectOrderQueryValue(order)}`) || "";
}

export function getProjectOrderFromId(id: string | number): ProjectOrder {
  return (typeof id == "number" ? id : parseInt(id)) as ProjectOrder;
}

export const SORTING_OPTIONS: SortingOption[] = Object.keys(ProjectOrder)
  .filter((v) => !isNaN(Number(v)))
  .map((v) => {
    return { id: v, label: ProjectOrder[parseInt(v)]! };
  });

export type ProjectSearchMetadata = {
  type: "all" | "bd.manga" | "webtoons" | "novels" | "artbooks";
  section: "indepolis" | "original" | "neoville";
  status: "any" | `${number}`;
  format: string;
  genre: string;
  language: string;
};

export const DEFAULT_SEARCH_METADATA: ProjectSearchMetadata = {
  type: "all",
  section: "indepolis",
  status: "any",
  format: "any",
  genre: "any",
  language: "any",
};

export function getProjectSearchQueryParams(params: ProjectSearchMetadata) {
  let string = `type=${params.type}&section=${params.section}`;
  if (params.status != "any") string += `&status=${params.status}`;
  if (params.format != "any") string += `&format=${params.format}`;
  if (params.genre != "any") string += `&genre=${params.genre}`;
  if (params.language != "any") string += `&language=${params.language}`;
  return string;
}

export class ProjectSearchForm extends AdvancedSearchForm {
  private visible: boolean;
  private query: ProjectSearchMetadata;
  private catalogParams: CatalogParameters;

  constructor(query: SearchQuery<ProjectSearchMetadata>, catalogParams: CatalogParameters) {
    super();
    this.visible = query.title.trim().length == 0;
    this.query = query.metadata || DEFAULT_SEARCH_METADATA;
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
