/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import {
  ContentRating,
  SourceIntents,
  type ExtensionInfo,
} from "@paperback/types";

export default {
  name: "MangaDraft",
  description: "Extension that pulls content from https://mangadraft.com/",
  version: "1.0.0-alpha.4",
  icon: "icon.png",
  language: "fr",
  contentRating: ContentRating.EVERYONE,
  capabilities: [
    SourceIntents.SETTINGS_FORM_PROVIDING,
    SourceIntents.DISCOVER_SECTION_PROVIDING,
    SourceIntents.SEARCH_RESULT_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
  ],
  badges: [],
  developers: [
    {
      name: "Seize",
      github: "https://github.com/ndhaba",
    },
  ],
} satisfies ExtensionInfo;
