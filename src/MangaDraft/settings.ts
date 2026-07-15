import { ButtonRow, Form, LabelRow, Section } from "@paperback/types";

import type CatalogParameters from "./catalog";
import type HomePage from "./home";

function pluralize(num: number, word: string) {
  return `${num} ${word}${num === 1 ? "" : "s"}`;
}

function timeSince(date: Date | undefined) {
  if (!date) return "Never";
  const delta = Date.now() - date.getTime();
  if (delta <= 60000) {
    return pluralize(Math.floor(delta / 1000), "second") + " ago";
  } else if (delta <= 60000 * 60) {
    return pluralize(Math.floor(delta / 60000), "minute") + " ago";
  } else if (delta <= 60000 * 60 * 24) {
    return pluralize(Math.floor(delta / 60000 / 60), "hour") + " ago";
  } else {
    return pluralize(Math.floor(delta / 60000 / 60 / 24), "day") + " ago";
  }
}

export default class SettingsForm extends Form {
  catalog: CatalogParameters;
  home: HomePage;

  constructor(catalog: CatalogParameters, home: HomePage) {
    super();
    this.catalog = catalog;
    this.home = home;
  }

  override getSections() {
    return [
      Section({ id: "dev", header: "Developer Settings" }, [
        LabelRow("homePageTime", {
          title: "Home Page Update",
          value: timeSince(this.home.lastTimeUpdated),
        }),
        LabelRow("catalogParamTime", {
          title: "Parameter Update",
          value: timeSince(this.catalog.lastTimeUpdated),
        }),
        ButtonRow("forceReloadEverything", {
          title: "Force Reload Everything",
          onSelect: Application.Selector(this as SettingsForm, "forceReloadEverything"),
        }),
      ]),
    ];
  }

  async forceReloadEverything() {
    await this.catalog.load();
    await this.home.load();
    this.reloadForm();
  }
}
