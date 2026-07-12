import type { Response } from "@paperback/types";
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

async function fetch(url: string, referer: string = url): Promise<[Response, string]> {
  const [response, data] = await Application.scheduleRequest({
    method: "GET",
    url: url,
    headers: {
      Referer: referer,
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    },
  });
  if (response.status != 200) {
    throw new Error(`Failed to fetch "${url}" - Error ${response.status}`);
  }
  return [response, Application.arrayBufferToUTF8String(data)];
}

/**
 * Fetches HTML from the given URL and parses it with cheerio
 * @param url The URL
 * @param referer An optional 'Referer' header. Defaults to `url`
 * @returns A Cheerio document representing the HTML response
 */
export async function fetchPage(url: string, referer: string = url) {
  return cheerio.load((await fetch(url, referer))[1]);
}

/**
 * Fetches JSON from the given URL
 * @param url The URL
 * @param referer An optional 'Referer' header. Defaults to `url`
 * @returns The JSON
 * @throws {SyntaxError} If the response isn't valid JSON
 */
export async function fetchJson(url: string, referer: string = url) {
  return JSON.parse((await fetch(url, referer))[1]);
}

/**
 * Extracts JSON-serializable values assigned to `window` globals from
 * inline `<script>` elements in an HTML document
 *
 * Only assignments of the form `window.foo = ...;` are matched. The
 * assigned value must be valid JSON
 *
 * @param $doc A Cheerio document representing the parsed HTML
 * @returns An object mapping global variable names to their parsed values
 * @throws {SyntaxError} If a matched assignment contains invalid JSON
 */
export function scrapeGlobals($doc: CheerioAPI): Record<string, any>;

/**
 * Extracts JSON-serializable values assigned to `window` globals from
 * inline `<script>` elements in an HTML document
 *
 * Only assignments of the form `window.foo = ...;` are matched. The
 * assigned value must be valid JSON
 *
 * @param $doc A Cheerio document representing the parsed HTML
 * @param filter Optional list of global variable names to extract. If omitted,
 * all matching globals are returned
 * @returns An object mapping global variable names to their parsed values
 * @throws {SyntaxError} If a matched assignment contains invalid JSON
 * @throws {TypeError} If a global variable in `filter` is not found
 */
export function scrapeGlobals<const T extends string[]>(
  $doc: CheerioAPI,
  filter: T,
): Record<T[number], any>;

export function scrapeGlobals($doc: cheerio.CheerioAPI, filter?: string[]) {
  const globals: Record<string, any> = {};
  const regex = /window\.([A-Za-z_$][\w$]*)\s*=\s*([\s\S]*?);(?=\s*(?:window\.|$))/g;
  for (const script of $doc("script:not([src])")) {
    const code = $doc(script).text() ?? "";
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      let [, name, value] = match;
      if (!name || !value) {
        continue;
      }
      if (filter && !filter.includes(name!)) {
        continue;
      }
      try {
        globals[name!] = JSON.parse(value);
      } catch (err) {
        if (err instanceof SyntaxError) {
          throw new SyntaxError(`Failed to parse value of "window.${name}": ${err.message}`, {
            cause: err.cause,
          });
        }
      }
    }
  }
  if (filter) {
    for (const name of filter) {
      if (!globals[name]) {
        throw new TypeError(`Could not find "window.${name}" in page`);
      }
    }
  }
  return globals;
}

/**
 * Extracts a segment of the URL path
 * @param url The URL
 * @param i Which number segment to take
 * @returns The path segment
 * @throws {TypeError} If the path segment cannot be found
 */
export function extractPathSegment(url: string, i: number): string {
  const segments = Array.from(url.matchAll(/(?<=\/)[^/#?]+/)).map((v) => v[0]);
  if (i < 0) {
    i = segments.length + i;
  }
  if (i < 0 || i >= segments.length) {
    throw new TypeError(`Could not find path segment #${i} in "${url}"`);
  }
  return segments[i]!;
}
