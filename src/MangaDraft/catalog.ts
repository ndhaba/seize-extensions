import type { Tag } from "@paperback/types";

import { fetchPage, scrapeGlobals } from "./utils";

const RELOAD_MS = 1000 * 60 * 60 * 8;
const STATE_KEY = "mangadraft_catalogpage";

const COUNTRY_EMOJIS: Partial<Record<string, string>> = {
  en: "🇬🇧",
  fr: "🇫🇷",
  it: "🇮🇹",
  es: "🇪🇸",
  de: "🇩🇪",
  pl: "🇵🇱",
  pt: "🇵🇹",
  fi: "🇫🇮",
  sv: "🇸🇪",
  jp: "🇯🇵",
};

const STATUS_ENGLISH = ["Ongoing", "Completed", "On Hiatus"];

const FORMAT_ENGLISH: Partial<Record<string, string>> = {
  serie: "Series",
  oneshot: "One-shot",
};

function emojify(genre: [string, string]) {
  const emoji = COUNTRY_EMOJIS[genre[0]];
  return emoji ? `${emoji} ${genre[1]}` : genre[1];
}

/**
 * Type representing the catalog parameters that should be
 * saved to state
 */
type CatalogParamState = {
  genres: [number, string, string][];
  languages: [number, string, string][];
  status: [number, string][];
  formats: [string, string][];
  lastUpdated: string;
};

/**
 * Class for dynamically loading catalog parameters for searching
 * on MangaDraft
 */
export default class CatalogParameters {
  private genres: Map<number, [string, string]> = new Map();
  private languages: Map<number, [string, string]> = new Map();
  private status: Map<number, string> = new Map();
  private formats: Map<string, string> = new Map();
  private lastUpdated?: Date;

  constructor() {
    const state = Application.getState(STATE_KEY) as CatalogParamState | undefined;
    if (!state) return;
    state.genres.forEach((v) => this.genres.set(v[0], [v[1], v[2]]));
    state.languages.forEach((v) => this.languages.set(v[0], [v[1], v[2]]));
    state.status.forEach((v) => this.status.set(v[0], v[1]));
    state.formats.forEach((v) => this.formats.set(v[0], v[1]));
    this.lastUpdated = new Date(state.lastUpdated);
  }

  /**
   * Loads/reloads the parameters unconditionally
   */
  async load() {
    const $document = await fetchPage("https://www.mangadraft.com/catalog");
    const { data } = scrapeGlobals($document, ["data"]);
    const state: CatalogParamState = {
      genres: [],
      languages: [],
      status: [],
      formats: [],
      lastUpdated: "",
    };
    this.genres.clear();
    for (const genre of data.genres) {
      this.genres.set(genre.id, [genre.slug, genre.name]);
      state.genres.push([genre.id, genre.slug, genre.name]);
    }
    this.languages.clear();
    for (const language of data.languages) {
      this.languages.set(language.id, [language.abbr, language.native]);
      state.languages.push([language.id, language.abbr, language.native]);
    }
    this.status.clear();
    for (const status of data.status) {
      this.status.set(status.value, status.label);
      state.status.push([status.value, status.label]);
    }
    this.formats.clear();
    for (const format of data.formats) {
      this.formats.set(format.value, format.label);
      state.formats.push([format.value, format.label]);
    }
    this.lastUpdated = new Date();
    state.lastUpdated = this.lastUpdated.toISOString();
    Application.setState(state, STATE_KEY);
  }

  /**
   * Loads/reloads the parameters only if needed
   *
   * This runs if parameters haven't previously been loaded, and if
   * the parameters haven't been updated in a while.
   */
  async loadIfNeeded() {
    const last = this.lastUpdated;
    if (last === undefined || Date.now() - last.getTime() >= RELOAD_MS) {
      await this.load();
    }
  }

  /**
   * @returns A list of `Tag`s representing MangaDraft's genres
   */
  getGenreTags(): Tag[] {
    return Array.from(this.genres.entries())
      .sort((a, b) => a[0] - b[0])
      .map((v) => {
        return { id: v[1][0], title: v[1][1] };
      });
  }

  /**
   * Gets the tag of the language with the given ID
   * @param id The ID
   * @param emoji Whether to include a county emoji in the label
   * @returns The tag
   */
  getLanguageTagById(id: number, emoji?: boolean): Tag {
    const lang = this.languages.get(id)!;
    return { id: lang[0], title: emoji ? emojify(lang) : lang[1] };
  }

  /**
   * @returns A list of `Tag`s representing MangaDraft's languages
   */
  getLanguageTags(): Tag[] {
    return Array.from(this.languages.entries())
      .sort((a, b) => a[0] - b[0])
      .map((v) => {
        return { id: v[1][0], title: emojify(v[1]) };
      });
  }

  /**
   * Gets the tag of the format with the given search value
   * @param value The search value
   * @returns The tag
   */
  getFormatTagByValue(value: string): Tag {
    return { id: value, title: FORMAT_ENGLISH[value] || this.formats.get(value)! };
  }

  /**
   * @returns A list of `Tag`s representing MangaDraft's formats
   */
  getFormatTags(): Tag[] {
    return Array.from(
      this.formats.entries().map((entry) => {
        return { id: entry[0], title: FORMAT_ENGLISH[entry[0]] || entry[1] };
      }),
    );
  }

  /**
   * Gets the tag of the status with the given ID
   * @param id The ID
   * @returns The tag
   */
  getStatusTagById(id: number): Tag {
    return { id: id.toString(), title: STATUS_ENGLISH[id] || this.status.get(id)! };
  }

  /**
   * @returns A list of `Tag`s representing MangaDraft's status values
   */
  getStatusTags(): Tag[] {
    return Array.from(this.status.entries())
      .sort((a, b) => a[0] - b[0])
      .map((entry) => {
        return { id: entry[0].toString(), title: STATUS_ENGLISH[entry[0]] || entry[1] };
      });
  }
}
