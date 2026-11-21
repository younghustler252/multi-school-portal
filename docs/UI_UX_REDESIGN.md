# Web UI/UX redesign — assessment, direction and component guide

Branch: `feature/ui-ux-redesign` (from `refactor/web`). Scope: `apps/web` only. No backend, auth, API-client or permission-logic changes.

This file is the Stage 0 assessment plus the running reference for the design system. Everything under "Current state" was read from the repository; anything not verified is marked as such.

---

## 1. Current state (verified from the repo)

### Architecture
- npm-workspaces monorepo: `apps/web` (Next 16 App Router, React 19, TypeScript), `apps/api`, `packages/contracts` (shared types such as `MyPermissions`, `PersonaType`, `LoginResult`).
- Route groups: `(auth)`, `(marketing)`, `(dashboard)` for school-side sessions (`/home`, `/school/*`, `/teaching/*`, `/finance/*`, `/insights/*`, `/family/*`, `/learning/*`, `/settings`), `(super-admin)` for platform sessions, plus `onboarding` and `billing`.
- Feature folders under `src/features/<module>/{components,hooks,services,types}`; shared UI in `src/components/{ui,layout,feedback}`.
- Data: TanStack Query. Forms: react-hook-form + zod. Toasts: sonner. Command palette primitive: cmdk (wrapped in `ui/command.tsx`, currently unused by the shell).

### Session, school context and permissions (all kept as-is)
- `stores/auth.store.ts` + pure `lib/auth/session-reducer.ts`. Nothing is persisted; HttpOnly cookies are the session and the app bootstraps from `/users/me` and `/users/me/permissions`.
- School context comes from the subdomain (`use-current-subdomain`, `usePublicSchoolInfo`). Login can return persona or school selection; the API also has `/auth/switch-persona` (a client method exists, no UI uses it).
- `lib/route-access.ts` is one rule table that drives the route guard, the sidebar (`visibleNav`) and `/home`. This is good architecture and the redesign builds on it rather than replacing it.
- API access is centralized (`lib/api/*`, base URL from `get-api-base-url.ts`).

### Design system
- shadcn "base-nova" style on Base UI, Tailwind 4, OKLCH tokens in `globals.css`, complete light and dark token sets, `next-themes`.
- Font: Inter, with Inter-specific `font-feature-settings`.
- Primitives present in `components/ui`: alert-dialog, avatar, badge, button, card, checkbox, command, dialog, dropdown-menu, file-drop, image-upload-fields, info-row, input, input-group, label, loading-button (`AppButton`), mobile-card, popover, select, select-with-other, separator, sheet, skeleton, sonner, stat-card, switch, table, tabs, textarea.
- Feedback: `confirm-dialog`, `feature-gate`, `coming-soon`.

### Problems found
| # | Finding | Evidence |
|---|---------|----------|
| 1 | Topbar search box does nothing (no handler, no results). Same in the platform topbar. | `layout/topbar.tsx`, `layout/admin-topbar.tsx` |
| 2 | User menu shows a generic icon, although the profile carries `photoUrl`. | `topbar.tsx`, `lib/auth/session-types.ts` |
| 3 | Avatar logic is duplicated: `StudentAvatar`, a raw `<img>` in `family/children`, another in `photo-upload`. Neither fallback handles a failed image load. | `features/students/components/student-avatar.tsx`, `app/(dashboard)/family/children/page.tsx` |
| 4 | Two near-identical sidebars and topbars (school and platform). | `sidebar.tsx` / `admin-sidebar.tsx`, `topbar.tsx` / `admin-topbar.tsx` |
| 5 | No collapsible desktop navigation, no breadcrumbs, no skip link. | `dashboard-shell.tsx` |
| 6 | "Back to landing" uses a log-out icon. | `sidebar.tsx` |
| 7 | `StatCard` renders a literal `●` character as its icon. | `ui/stat-card.tsx` |
| 8 | Buttons are 32px high and inputs 40px, with no larger touch targets on touch devices. | `ui/button.tsx`, `ui/input.tsx` |
| 9 | Input border (`--input`) is too light to meet the 3:1 non-text contrast target. | `globals.css` |
| 10 | No tooltip, empty-state or error-state component; pages hand-write "No students found." rows. | `components/ui`, `school/students/page.tsx` |
| 11 | Tables are hand-rolled per page. `@tanstack/react-table` is a dependency but `useReactTable` is not used anywhere. Only 7 files use `MobileCard`, so most list pages have no deliberate mobile layout (not individually checked). | grep |
| 12 | No reduced-motion handling in the global styles. | `globals.css` |
| 13 | Brand token (`oklch(0.55 0.16 145)`, a saturated grass green) does not match the declared `themeColor` `#1F7A4D`. | `globals.css`, `app/layout.tsx` |
| 14 | `bg-hero-radial` (a gradient) is used on the platform app shell and on auth/marketing pages. | `admin-shell.tsx`, others |

### What is reusable
Keep: auth store/reducer, route-access table and `visibleNav`, API client, feature hooks/services, all Base UI wrappers, `ConfirmDialog`, `FeatureGate`, form stack, token architecture (CSS variables mapped through `@theme inline`).
Improve: Button, Input, Badge, Table (header style), StatCard, PageHeader, Avatar usage.
Replace: the decorative search boxes, the duplicated sidebar/topbar internals, the `●` glyph.

---

## 2. Design direction

**Tone:** calm, institutional, precise. Closer to a well-set financial or editorial product than to a "school" theme: paper-warm neutrals, deep green ink, one warm accent used sparingly, no gradients, soft low shadows, hairline borders.

### Colour (all tokens in `globals.css`)
- **Primary** `oklch(0.50 0.105 158)`. This is the green the product already declares as its `themeColor` (`#1F7A4D`), deepened and desaturated from the old grass green so it reads as trustworthy rather than playful. White text on it is about 6:1.
- **Neutrals** are warm "paper" surfaces (`--background`) with white cards, and a slightly green-tinted ink for text, so the greys belong to the brand instead of being cool default greys.
- **Highlight** `oklch(0.78 0.145 78)` (amber). One accent only: active-nav marker, setup nudges, key emphasis. It is not used for large fills.
- **Sidebar** is a deep ink green with light text, which gives the product a recognisable frame while the content area stays light and calm.
- **Status colours** (success, warning, info, destructive) are chosen so their text colour reaches 4.5:1 on their own 10% tint.
- **Charts** use a five-colour categorical set (green, blue, amber, terracotta, violet) with distinct lightness, so series do not rely on hue alone.
- **Dark mode** stays, because the token system already had a complete dark set; it was updated in the same pass so the two themes stay in sync. Not verified visually yet (see Known limitations).

### Typography
- **Interface and body: Source Sans 3.** Humanist, narrow, very legible at 13–15px, strong in dense tables, supports tabular and lining figures for money and counts, open licence (OFL), served as a variable font through `next/font` (self-hosted at build, no runtime request to Google).
- **Display and page titles: Newsreader.** A restrained text serif with optical sizing. Used only for page titles and display headings, which gives the product an educational, trustworthy voice and sets it apart from the usual all-sans SaaS look. Never used in tables, forms or navigation.
- Both are loaded with `latin` and `latin-ext` subsets because the app formats money in naira (`₦`), which sits in the latin-ext range. Whether both families contain the glyph could not be checked offline; if one does not, the browser falls back for that single character only.
- Scale is defined once as utilities in `globals.css`: `text-display`, `text-page-title`, `text-section`, `text-eyebrow`, `text-figure`, plus `tabular`. Pages should use these rather than ad-hoc sizes.

### Icons
Lucide React (already the app's only icon library, `lucide-react`). Conventions: `size-4` in buttons, menus and navigation, `size-5` for standalone icon buttons, default 2px stroke, no emoji, no decorative oversized icons. A nav or action icon must match what the action does (e.g. back-to-website no longer uses the log-out icon).

### Application shell
- Deep-green sidebar, collapsible to an icon rail on desktop (preference stored in `localStorage` as a convenience only), slide-in sheet on mobile.
- Top bar: menu button (mobile), a working "Jump to…" command palette (Ctrl/Cmd+K) that lists only the pages the session may open (same `visibleNav` as the sidebar), theme toggle, notifications, user menu with the real profile photo or initials.
- Breadcrumbs appear automatically on detail and create pages; on small screens they collapse to a single "back to parent" link.
- Skip-to-content link and a `main` landmark.
- One shared navigation list and user menu used by both the school and platform shells.

### Component architecture
1. **Tokens** (`globals.css`) →
2. **Primitives** (`components/ui`: Button, Input, Badge, Tooltip, PersonAvatar, StatCard, Table…) →
3. **Patterns** (`components/feedback`: EmptyState, ErrorState; `components/layout`: PageHeader, Breadcrumbs, NavList, UserMenu, CommandPalette) →
4. **Shells** (`DashboardShell`, `AdminShell`).
Pure logic (initials, persona labels, breadcrumb building, active-nav matching) lives in `src/lib` with no React or browser imports, so it is unit-testable and reusable by a future native app.

### Implementation sequence
1. Stage 1: tokens, fonts, Button/Input/Badge touch and status variants, Tooltip, PersonAvatar, StatCard, EmptyState, ErrorState, Table header.
2. Stage 2: shared NavList, collapsible Sidebar, UserMenu, CommandPalette, Breadcrumbs, PageHeader, both shells.
3. Stage 3: school dashboard pilot.
4. Stage 4: module-by-module adoption (tables first: `DataTable` pattern with a mobile card layout).
5. Stage 5: responsive and accessibility verification in a browser.

### Decisions that need your call
- **Brand colour change.** The primary is deepened to match the existing `themeColor`. If the exact old green is a brand requirement, change `--primary` in one place.
- **School/context selector.** Schools are separate subdomains and the API exposes no "list my schools" endpoint for an in-app switcher, so none was built. The API does have `/auth/switch-persona`, so a persona switcher is possible when a person holds several profiles; say if you want that in the user menu.

---

## 3. Component usage

**Typography classes** (`globals.css`): `text-display`, `text-page-title` (display serif), `text-section`, `text-eyebrow`, `text-figure`, `tabular` (UI sans). Do not set font sizes ad hoc on pages.

**`PersonAvatar`** (`ui/person-avatar`): the only way to show a person. `<PersonAvatar firstName lastName photoUrl fallbackText size="sm|md|lg|xl|number" />`. Pass `photoUrl` exactly as the API returned it. Empty or failing photo falls back to initials. `StudentAvatar` is a thin wrapper kept for existing callers.

**`Badge`**: variants `default | secondary | destructive | outline | success | warning | info`. Use the status variants instead of hand-coloured spans.

**`StatCard`**: `<StatCard label value hint accent icon />`. `icon` is an optional Lucide icon in a small chip; without it `accent` shows a dot. The old `●` glyph is gone.

**`Tooltip`** (`ui/tooltip`): for icon-only controls and the collapsed sidebar. Hover/focus only, so the control must also have an `aria-label`. `TooltipProvider` is mounted once in `AppShell`.

**`EmptyState` / `ErrorState`** (`feedback/`): `EmptyState title description icon action` for "nothing yet"; `ErrorState title description onRetry retrying` for failed requests (announces with `role="alert"`). Do not use one for the other.

**`Button` / `Input`**: unchanged API. On touch devices (`pointer-coarse`) they grow to 40-48px so touch targets reach about 44px; desktop density is unchanged.

**Shell**: `AppShell` (skip link, main landmark, breadcrumbs) takes a `sidebar` and a `topbar`. `SidebarFrame` + `NavList` are shared by the school and platform sidebars; the menu comes from `visibleNav(permissions)` and the components never decide permissions. `UserMenu`, `CommandPalette` (Ctrl/Cmd+K, pages only) and `ThemeToggle` are shared by both top bars. Pure logic (`lib/people`, `lib/breadcrumbs`, `lib/nav-active`) has no React or browser imports and has unit tests in `tests/lib`.
