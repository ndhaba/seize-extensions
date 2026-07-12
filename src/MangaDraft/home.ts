import {
  ContentRating,
  type ProminentCarouselItem,
  type SimpleCarouselItem,
} from "@paperback/types";

import { fetchPage, scrapeGlobals } from "./utils";

export type HomePageData = {
  originals: ProminentCarouselItem[];
  contest: {
    title: string;
    description: string;
    entries: SimpleCarouselItem[];
  };
  sponsors: SimpleCarouselItem[];
  trending: SimpleCarouselItem[];
};

export async function getHomePageData(): Promise<HomePageData> {
  const $document = await fetchPage("https://www.mangadraft.com/");
  const { data } = scrapeGlobals($document, ["banners", "data"]);
  return {
    originals: data.originals.map(dataEntryToProminentSectionItem),
    contest: {
      title: data.contest.title,
      description: data.contest.subtitle,
      entries: data.contest.data.map(dataEntryToSimpleSectionItem),
    },
    sponsors: data.sponsors.data.map(dataEntryToSimpleSectionItem),
    trending: data.trending.map(dataEntryToSimpleSectionItem),
  };
}

function dataEntryToSimpleSectionItem(entry: any): SimpleCarouselItem {
  return {
    type: "simpleCarouselItem",
    ...dataEntryToSectionItem(entry),
  };
}

function dataEntryToProminentSectionItem(entry: any): ProminentCarouselItem {
  return {
    type: "prominentCarouselItem",
    ...dataEntryToSectionItem(entry),
  };
}

function dataEntryToSectionItem(entry: any) {
  return {
    mangaId: entry.id.toString(),
    imageUrl: entry.avatar as string,
    title: (entry.title || entry.name) as string,
    contentRating: ContentRating.EVERYONE,
  };
}
