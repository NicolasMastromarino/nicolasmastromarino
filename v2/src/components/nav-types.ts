// Navigation order drives the direction of the page transition: going to a
// later page slides content left (forward), going to an earlier one slides
// it right (back). Anything outside the list (blog posts) counts as deeper.
const ORDER = ["/", "/services", "/case-studies", "/about", "/blog", "/contact"];

function rank(path: string) {
  if (path === "/") return 0;
  const idx = ORDER.findIndex((p) => p !== "/" && (path === p || path.startsWith(`${p}/`)));
  return idx === -1 ? 0 : idx;
}

export function navTypes(from: string, to: string): string[] {
  const a = rank(from);
  const b = rank(to);
  if (to.startsWith(`${from}/`) && from !== "/") return ["nav-forward"];
  if (from.startsWith(`${to}/`) && to !== "/") return ["nav-back"];
  return [b >= a ? "nav-forward" : "nav-back"];
}
