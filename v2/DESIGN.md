# Design

<!-- impeccable:design-schema 1 -->

## Visual world

Editorial-tech / systems-diagram world, pinned directly by the user from a reference artifact they built and preferred (`https://claude.ai/artifact/Lt3W36DeumxQwMpYrCU22X`). Replaces the earlier Dispatch/Ops Board direction outright: same product, same pages, new visual system end to end (colors, type, shapes, and several new components: the integration diagram, tools marquee, process rail, stat row).

One deliberate departure from the reference: it stacks small uppercase "eyebrow" labels directly above headings throughout. That pattern reads as generic AI-template regardless of source, so it was rebuilt as a `LabelDot` — the same colored-dot + mono-uppercase treatment, but placed beside the heading in a flex row (or standalone as a small badge), never stacked above it.

## Color strategy

Committed, with a full light/dark toggle (unlike the prior direction, which was light-only). Warm-neutral paper (`#F5F6F1` light / `#0D0F14` dark) is the dominant field; one saturated accent (a deep orange-red) carries CTAs and headline emphasis; a blue and a green exist as secondary accents for labels and diagram dots.

The reference's raw palette failed WCAG AA in four places (white-on-accent button text, accent-as-text, ink-faint body text in both modes, and the green accent-3 against the dark contact panel). All four were re-tuned to pass 4.5:1 while staying in the same hue family:

| Token | Reference value | Shipped value (light) | Why |
|---|---|---|---|
| `--accent` | `#FF4423` | `#C42E0A` | White button text on the reference's orange was 3.44:1 |
| `--ink-faint` | `#8A8E9B` | `#686C79` | 3.01:1 on the page background |
| `--ink-faint` (dark) | `#6D7180` | `#888C9B` | 3.95:1 on the dark background |
| `--accent-3` | `#5C8A1E` | `#74AD2A` | 4.47:1 against the dark contact panel |

Dark mode uses the reference's own dark values unchanged (they already passed). Toggle state lives in `data-theme` on `<html>`, set by an inline script in `<head>` before paint (see `src/components/theme-init.tsx`) and flipped client-side by `src/components/theme-toggle.tsx`, both reading/writing `localStorage['nm-theme']`.

## Typography

- Display (`--font-display`): Bricolage Grotesque, weights 600/800.
- Body/UI (`--font-sans`): IBM Plex Sans.
- Technical/labels (`--font-mono`): IBM Plex Mono. Used for stat labels, ticket/project IDs, and `LabelDot` text.

All three self-hosted via `next/font/google` in `src/app/[locale]/layout.tsx`.

## Components

- **Header** (`header-nav.tsx`): floating pill nav, sticky, backdrop-blurred, with the theme toggle, locale switcher, primary CTA, and a slide-down mobile menu below 768px.
- **IntegrationDiagram** (`integration-diagram.tsx`): static SVG recreation of the reference's hero diagram, using the site's actual tools (GoHighLevel, Kickserv, Airtable, Stripe, Google Sheets, Zapier) flowing into "ONE SYSTEM" and out to "Fewer manual tasks."
- **ToolsMarquee**: CSS-animated scrolling strip of tool-name pills, duplicated for a seamless loop.
- **TeaserCard** / **CapCard**: card-grid components for the two service tracks, used at different granularity (2 large teasers on Home, 4 capability tiles per track on Services).
- **ProcessRail**: the 5-step "Audit → Design → Build → Launch → Support" methodology, horizontal on desktop, vertical on mobile.
- **StatRow**: the three hero proof stats (10+ yrs / 2 systems run daily / 6+ platforms), all grounded in the resume (no invented metrics).
- Dark contact panel on `/contact` matches the reference exactly: `bg-ink` (which inverts to light in dark mode, same as the reference), translucent form fields.

## Explicitly not done

- No image-generation comp round for this redesign either — the user supplied their own fully-built reference, which stands in for a comp.
- No finish-reviewer/documenter subagent pass. Reviewed directly: contrast measured and fixed programmatically, mechanical `impeccable detect` run clean, all six pages checked in both languages and both themes, desktop and mobile.
