import type { Tag } from "@paperback/types";

import { fetchPage, scrapeGlobals } from "./utils";

const RELOAD_MS = 1000 * 60 * 60 * 8;

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

export default class CatalogParameters {
  private genres: Map<number, [string, string]> = new Map();
  private languages: Map<number, [string, string]> = new Map();
  private status: Map<number, string> = new Map();
  private formats: Map<string, string> = new Map();
  private lastUpdated?: Date;

  constructor() {}

  async load() {
    const $document = await fetchPage("https://www.mangadraft.com/catalog");
    const { data } = scrapeGlobals($document, ["data"]);
    this.genres.clear();
    for (const genre of data.genres) {
      this.genres.set(genre.id, [genre.slug, genre.name]);
    }
    this.languages.clear();
    for (const language of data.languages) {
      this.languages.set(language.id, [language.abbr, language.native]);
    }
    this.status.clear();
    for (const status of data.status) {
      this.status.set(status.value, status.label);
    }
    this.formats.clear();
    for (const format of data.formats) {
      this.formats.set(format.value, format.label);
    }
    this.lastUpdated = new Date();
  }

  async loadIfNeeded() {
    const last = this.lastUpdated;
    if (last === undefined || Date.now() - last.getTime() >= RELOAD_MS) {
      await this.load();
    }
  }

  getGenreTags(): Tag[] {
    return Array.from(this.genres.entries())
      .sort((a, b) => a[0] - b[0])
      .map((v) => {
        return { id: v[1][0], title: v[1][1] };
      });
  }

  getLanguageTagById(id: number, emoji?: boolean): Tag {
    const lang = this.languages.get(id)!;
    return { id: lang[0], title: emoji ? emojify(lang) : lang[1] };
  }

  getLanguageTags(): Tag[] {
    return Array.from(this.languages.entries())
      .sort((a, b) => a[0] - b[0])
      .map((v) => {
        return { id: v[1][0], title: emojify(v[1]) };
      });
  }

  getFormatTagByValue(value: string): Tag {
    return { id: value, title: FORMAT_ENGLISH[value] || this.formats.get(value)! };
  }

  getFormatTags(): Tag[] {
    return Array.from(
      this.formats.entries().map((entry) => {
        return { id: entry[0], title: FORMAT_ENGLISH[entry[0]] || entry[1] };
      }),
    );
  }

  getStatusTagById(id: number): Tag {
    return { id: id.toString(), title: STATUS_ENGLISH[id] || this.status.get(id)! };
  }

  getStatusTags(): Tag[] {
    return Array.from(this.status.entries())
      .sort((a, b) => a[0] - b[0])
      .map((entry) => {
        return { id: entry[0].toString(), title: STATUS_ENGLISH[entry[0]] || entry[1] };
      });
  }
}
