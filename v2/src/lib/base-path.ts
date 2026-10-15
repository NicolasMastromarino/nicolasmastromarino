/**
 * The site can live under a sub-path (the preview at /v2). Next prefixes links and its own assets,
 * but not plain strings: fetch URLs, files in /public used as raw hrefs, and icon URLs.
 * Leave NEXT_PUBLIC_BASE_PATH unset for a normal root deploy.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const withBase = (path: string) => `${BASE_PATH}${path}`;
