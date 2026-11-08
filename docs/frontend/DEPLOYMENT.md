# Frontend deployment architecture (M2)

> **Status:** design + configuration. No domain or host is final. Every deployment value is an environment variable; `example.com` below is a placeholder.
> Written 2026-11-08 from the backend source (`tenant-resolver.middleware.ts`, `cors-origin.ts`, `auth.middleware.ts`, `env.ts`) and the owner's verified login contract.

## 1. The layout you proposed, and where it meets the backend

Proposed: `app.example.com` (web app), `api.example.com` (API), `admin.example.com` (platform admin), web on Netlify, API on a VPS.

Three facts about the **current** backend decide what is possible:

1. **The school is identified by the request's `Host` header, and nothing else.** `base`, `www.base` and `ADMIN_SUBDOMAIN.base` are the platform; `<label>.base` is the school with that subdomain; any other host is a school's verified custom domain. (Outside development there is no other way to say which school a request is for.)
2. **School addresses are `<subdomain>.<BASE_DOMAIN>`** (or the verified custom domain). So schools live at `greenfield.example.com`, not at `app.example.com`.
3. **CORS allows only `https://<anything>.<BASE_DOMAIN>`** (and every origin in development). A custom domain is never allowed.

What that means for each host in your layout:

| Host | What the backend does with it today |
|---|---|
| `admin.example.com` | Platform. Works as intended. |
| `app.example.com` | Treated as **a school whose subdomain is `app`** (404 `SCHOOL_NOT_FOUND`). It is only the platform if the API's `classifyHost` is changed to say so. |
| `api.example.com` | Treated as **a school whose subdomain is `api`**. A browser calling the API there carries `Host: api.example.com`, so the API cannot tell which school the call is for. |
| `greenfield.example.com` | The school. Needs the web app served on it too (wildcard DNS + wildcard TLS). |
| `portal.greenfield.edu.ng` | A custom domain. Needs its own DNS + TLS and a CORS exception if the API is on another host. |

**Consequence:** a single separate API host does not fit the current tenancy model. Two ways to resolve it (section 3). Nothing in the backend was changed for this document: the backend is yours.

## 2. Configuration (web)

All `NEXT_PUBLIC_*`, read at **build time** (a change needs a rebuild). One module reads them: `apps/web/src/lib/deployment.ts`. No other file contains a domain name.

| Variable | Meaning | Must match backend | Default |
|---|---|---|---|
| `NEXT_PUBLIC_BASE_DOMAIN` | Platform domain | `BASE_DOMAIN` | `localhost` |
| `NEXT_PUBLIC_ADMIN_SUBDOMAIN` | Admin host label | `ADMIN_SUBDOMAIN` | `admin` |
| `NEXT_PUBLIC_PUBLIC_SUBDOMAINS` | Extra labels that serve the platform itself (comma list, `www` always included) | the API's `classifyHost` | `www` |
| `NEXT_PUBLIC_API_URL` | Full API base: `/api/v1` (same origin) or `https://api.example.com/api/v1` | n/a | unset: development derivation |
| `NEXT_PUBLIC_API_HOST` | Development only: where `apps/api` listens | n/a | `localhost:5000` |
| `NEXT_PUBLIC_WEB_PORT` | Port in generated links | n/a | `3000` on localhost, none otherwise |

Behaviour that follows from them:
- **HTTPS:** a non-localhost base domain produces `https://` links only. Cookies are `Secure` in production (already so in the API).
- **Admin detection:** `classifyHost()` in `lib/deployment.ts` (same rules as the API). The middleware rewrites `/login` to `/admin-login` on the admin host and to `/portal-login` on a school host **or a custom domain**.
- **API base URL:** `NEXT_PUBLIC_API_URL` wins when set; otherwise the development rule applies (`greenfield.localhost:3000` → `greenfield.localhost:5000`). **Local development needs no configuration** and is unchanged.
- **Links to schools** (post-onboarding redirect, "last portal", super-admin labels) are built with `schoolUrl()` / `adminUrl()` from the configuration. A school with a custom domain should be linked by the `url` the API returns (login, impersonation already do this).

Variables go in the hosting provider's settings, never in a committed file. `apps/web/.env.production.example` lists placeholders.

## 3. How the browser reaches the API

### Option A: same origin per host (recommended)

Every host that serves the web app (admin, each school subdomain, each custom domain) forwards `/api/*` to the VPS **keeping the original host**. The web app uses `NEXT_PUBLIC_API_URL=/api/v1`.

- The API sees `Host: greenfield.example.com`, so tenancy works exactly as designed. No backend change for tenancy.
- **No CORS** (same origin) and **no third-party-cookie problem**, so **custom domains work**.
- Cookies stay **host-only** (see section 4).
- Needs a proxy that forwards the original `Host` (or sets `X-Forwarded-Host`, in which case the API must be changed to trust it from the proxy only: `trust proxy` + reading that header in `resolveTenant`).
- **Netlify: not verified.** Its documentation describes proxy rewrites (`status = 200`, optional extra request headers, 26-second timeout) but does not say whether the original `Host` is preserved or whether `X-Forwarded-Host` is set. Test with a request-echo endpoint before relying on it. Wildcard school subdomains and customer custom domains on Netlify also have plan/DNS requirements to check.
- **Alternative that avoids the question:** serve the Next.js app from the VPS behind one reverse proxy (for example Caddy or nginx) that routes `/api/*` to the API and everything else to Next.js on the same host. Wildcard and per-customer TLS are then handled in one place. Netlify can stay for the marketing site.

### Option B: separate API host (`api.example.com`)

`NEXT_PUBLIC_API_URL=https://api.example.com/api/v1`. Works only with backend changes, and has limits:
- The API must learn the school another way (for example from the CORS-validated `Origin`), and `api`, `app` must stop being read as schools (and be reserved).
- **Sessions collide:** cookies belong to the API host, so there is **one `accessToken` cookie for `api.example.com` for the whole browser**. Signing in to school B replaces school A's session; the platform admin session collides with school sessions. Host-only cookies on the school/admin hosts (the isolation you have today) are lost.
- **Custom domains break:** the API would be a third-party host for them (cookies blocked by browsers) and CORS refuses them.

Option B only suits a deployment with no custom domains and one school per browser. Option A is the one that keeps the verified login contract intact.

## 4. Cookies and "cross-subdomain" authentication

Recommendation: **do not set `COOKIE_DOMAIN`**. Keep cookies host-only (`HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`; this is what `auth.middleware.ts` already does).

Why: the cookie names are fixed (`accessToken`, `refreshToken`). With `Domain=.example.com` the admin session and every school's session would be the **same cookie** sent to every subdomain: signing in somewhere overwrites the session somewhere else. The verified contract says a person authenticates again on the school host; host-only cookies are what makes that safe.

So "cross-subdomain authentication" is deliberately **handoff, not sharing**:
- platform login → `SCHOOL_REDIRECT` / `SCHOOL_SELECTION_REQUIRED` → browser goes to the school's address → sign in again there;
- platform admin → school: impersonation ticket (single use, 60 seconds), exchanged on the school host for a school-scoped cookie.
No token or cookie is ever put in a URL or shared across hosts.

## 5. CORS and credentials

- **Option A:** none. Same origin.
- **Option B:** the API already sends `Access-Control-Allow-Credentials: true` with an echoed (never `*`) origin for `https://*.BASE_DOMAIN`, and the web client sends `withCredentials: true`. Custom domains would need an additional allow-rule. `BASE_DOMAIN` must be set correctly in production or every call is refused.

## 6. Local development

Unchanged and independent of all the above: `localhost:3000` / `greenfield.localhost:3000` / `admin.localhost:3000` against `apps/api` on `:5000` with `BASE_DOMAIN=localhost`; no `NEXT_PUBLIC_API_URL`, http, every origin allowed by the API in development.

## 7. Decisions needed from the owner

1. **Option A or B?** (A recommended. B needs the backend items below and gives up custom domains and per-school session isolation.)
2. Will schools get **custom domains**? (Decides A vs B almost on its own.)
3. Where will the web app run: **Netlify, or the VPS behind one reverse proxy**? If Netlify, someone must test Host forwarding (section 3).
4. What is `app.example.com` for? If it is the platform's own web app, the API's `classifyHost` must treat it as platform and `app`/`api` must be reserved school names.

## 8. Backend items this design depends on (not changed here)

- Reserve `app`, `api` (and any other platform labels) in `RESERVED_SUBDOMAINS`; today only the admin label and the reserved list are rejected at school creation.
- Option A with `X-Forwarded-Host`: `app.set("trust proxy", …)` for the proxy only, and read the forwarded host in `resolveTenant`.
- Option B: tenant resolution from a validated `Origin`, and a CORS rule for custom domains.
- Keep `COOKIE_DOMAIN` unset in production unless a single-session-per-browser design is chosen on purpose.

## 9. Still open in the web app

- **Custom-domain branding:** `usePublicSchoolInfo` looks a school up by subdomain; on a custom domain there is none, so the school login page cannot show branding there yet. Needs a host-based public-school endpoint.
- Looking at the site by IP address (for example from a phone on the LAN) is classified as a custom domain, as the API does; use `*.localhost` or add a hosts entry.
- Hosting-specific files (`netlify.toml`, proxy config) are deliberately not committed until section 7 is decided.
