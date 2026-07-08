import { type TestLogger } from "@paperback/types";

import { MangaDraft } from "../MangaDraft/main.js";
import sourceInfo from "../MangaDraft/pbconfig.js";
import { TestSuite, registerDefaultTests } from "./suite.js";

export async function runTests(logger: TestLogger) {
  const suite = new TestSuite("MangaDraft tests", logger);
  registerDefaultTests(suite, MangaDraft, sourceInfo);

  await suite.run();
}
