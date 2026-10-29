# Design

PostFlow's interface is a calm, precise product UI in the lineage of Supabase, Vercel and GitHub (owner's choice, 2026-10-29). Familiar patterns, executed with their craft: neutral surfaces, hairline structure, one accent used for intent, typography doing the hierarchy. No themed world, no decoration.

## Principles

1. **Structure by line and space, not by boxes.** 1px hairline dividers and generous spacing separate content. Never nest cards inside cards. A surface is a card only when it is a distinct object (a post, a preview, a dialog).
2. **One accent, used for intent.** The accent marks the primary action, the active navigation item, focus and selected state. Everything else is neutral. Status colors (success, warning, danger, info) appear only where they carry meaning.
3. **Typography is the hierarchy.** Page title, section title, label, body, helper — five steps, consistent everywhere. No uppercase eyebrow labels over every block, no letter-spaced kickers.
4. **Settings-grade forms.** Fields are grouped in titled sections with a one-line description; long forms are split into steps or sections, never shown as a wall.
5. **Real content only.** Copy is short, specific and in plain Portuguese. No marketing filler, no emoji in UI chrome, no invented numbers.

## Theme

Both themes ship; dark is the default. Tokens live in `src/styles/tokens.css` and every component reads them — no hard-coded colors.

- **Neutrals:** a single gray scale (12 steps, Radix/Vercel-like). Dark: background near `#0a0a0a`, surface `#111`, elevated `#171717`, border `#262626`, strong border `#333`, text `#ededed`, muted `#a1a1a1`. Light: background `#fafafa`, surface `#fff`, elevated `#f5f5f5`, border `#e5e5e5`, strong border `#d4d4d4`, text `#171717`, muted `#666`.
- **Accent:** emerald (Supabase-like). Dark `#3ecf8e` with dark text on it; light `#0f9d63` with white text. Muted accent backgrounds at low alpha for selected rows and active nav.
- **Status:** success = accent family; warning amber; danger red; info blue — each with a muted background and border token, AA contrast in both themes.
- **Focus:** 2px ring in the accent at ~40% alpha with 1px offset, on every interactive element.

## Typography

- **Family:** Geist Sans for UI and Geist Mono for codes, hex values, IDs and tabular numbers (via `@fontsource` packages). Fallback: system-ui.
- **Scale (px / line-height / weight):** page title 24/32/600 (letter-spacing -0.02em); section title 16/24/600; body 14/20/400; label 13/20/500; helper and meta 12/16/400 in muted color. Numbers that compare are tabular.

## Shape, depth, motion

- Radius: 6px controls, 8px cards and popovers, 12px dialogs. Pills fully rounded only for status badges.
- Depth: borders, not shadows. Shadows only on overlays (popover, dialog, toast).
- Motion: 120–160ms ease-out for hover, focus and disclosure; dialogs fade + 4px rise. Respect `prefers-reduced-motion`.

## Layout and shell

- **Sidebar (240px):** workspace switcher at top (brand initial avatar + name + role, Vercel team-switcher style), then grouped navigation (Criar e planejar · Gerenciar · Administração) with 16px lucide icons, 32px rows, active item = muted accent background + accent icon. Footer: theme toggle, service status, user menu.
- **Top bar (56px):** breadcrumb on the left, page-level actions on the right; hairline bottom border.
- **Content:** max width 1200px for settings pages, full width for the calendar; 32px page padding (16px on phones).
- **Mobile:** sidebar becomes a drawer; content stacks; no horizontal scroll at 390px.

## Components

- **Buttons:** primary (accent fill), secondary (surface + border), ghost (text only), danger (red text, red fill only in confirmation). Height 32px (default) and 36px (large). Icon + label, icon 16px.
- **Inputs/selects/textareas:** 36px height, surface background, 1px border, accent border + ring on focus, helper text below in muted 12px, error text in danger.
- **Section (settings pattern):** section title + one-line description on top, fields below, separated from the next section by a hairline and 32px spacing. On wide screens a section may place title/description in a left column and fields in a right column (GitHub/Supabase settings pattern).
- **Sticky save bar:** appears at the bottom of a form when there are unsaved changes ("Alterações não salvas" + Descartar / Salvar), Vercel style.
- **Status badge:** small pill with dot, muted background of its status color.
- **Empty states:** one sentence of what this is, one primary action. No illustrations.

## Brand page (priority surface)

- **First registration (no brand yet):** a centered setup flow, max 720px, three steps shown as a simple step indicator ("1 Identidade · 2 Público e oferta · 3 Como a marca fala"). Each step asks only its essentials; optional fields are clearly marked "Opcional". The right side (on wide screens) shows a **live post preview** in the brand's name, primary color and tone, updating as the owner types — the moment that proves "the AI understood my brand". Finishing leads straight to creating the first post.
- **Editing an existing brand:** settings layout — page header, left section navigation (Identidade, Público e oferta, Voz e regras), sections in the GitHub/Supabase pattern, sticky live preview on the right, sticky save bar when dirty.
- Colors: palette chips as compact swatches with hex in mono; "Principal" clearly marked.

## Calendar

Keeps its month-grid layout and the day modal with stacked post cards (three columns). It inherits tokens, typography, buttons and badges only; no structural change.

## Anti-patterns (banned)

Gradients and glow, glassmorphism, cards inside cards, uppercase eyebrow labels on every block, emoji in UI chrome, decorative illustrations, more than one accent color, centered marketing hero blocks inside the app, generic AI copy ("potencialize", "revolucione").
