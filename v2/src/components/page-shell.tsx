import { ViewTransition, type ReactNode } from "react";

/**
 * Wraps a page so route changes animate directionally. Lives in each page,
 * not the layout: layouts persist across navigations so enter/exit would
 * never fire there.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
