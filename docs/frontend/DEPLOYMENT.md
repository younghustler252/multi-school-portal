# Frontend deployment architecture (M2)

> **Where this lives:** this is the authoritative copy. It exists on `phase2/m2-session` only, not yet on `refactor/modules`, which is why the backend developer could not find it. It will appear there when M2 is merged.

> **Status:** architecture DECIDED by the owner (2026-11-08); domain and hosting provider still configurable. Every deployment value is an environment variable; `example.com` below is a placeholder.
> Written 2026-11-08 from the backend source (`tenant-resolver.middleware.ts`, `cors-origin.ts`, `auth.middleware.ts`, `env.ts`) and the owner's verified login contract.

## 0. Decisions (owner, 2026-11-08)

1. **Same-origin API (Option A).** One API deployment on the VPS. Every frontend hostname forwards `/api/*` to it **preserving the original Host header**. The frontend uses `NEXT_PUBLIC_API_URL=/api/v1`. No separate API hostname for browsers.
2. **Cookies host-only.** `COOKIE_DOMAIN` stays unset. Platform and school sessions stay separate; the school-selection and impersonation handoffs stay as they are.
3. **Custom domains: yes, eventually.** Kept in the architecture. What is still missing is listed in section 8.
4. **Hosting:** Next.js frontend and API on the VPS behind one reverse proxy to start. Netlify can be reconsidered once its Host forwarding and wildcard-domain behaviour are verified.
5. **Domains:** root domain = public platform; `admin.<domain>` = administration; `<school>.<domain>` = a school; custom domains later. **There is no `app.` host and no `api.` host.** The domain itself stays an environment variable.

Section 1 below records why the earlier `app.` / `api.` proposal did not fit; Option B in section 3 is kept only as the rejected alternative.

## 1. The layout first proposed (superseded by section 0), and where it meets the backend

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

## 3a. The reverse proxy, and what was verified

`deploy/Caddyfile.example` is the routing for one VPS: `/api/*` to the API, everything else to Next.js, on the same hostname, with the domain and upstreams taken from environment variables (`BASE_DOMAIN`, `API_UPSTREAM`, `WEB_UPSTREAM`, `ACME_EMAIL`).

**What was tested (2026-11-08, Caddy 2.8.4, in a sandbox):** the file's routing block, with only the listen address and TLS switched off for the test, in front of two stand-in servers.
- For every kind of host (school subdomain, admin, root, `www`, a custom domain, an unknown subdomain) the API stand-in received **the browser's original Host** (including the port), and also `X-Forwarded-Host` / `X-Forwarded-Proto`. Caddy's `reverse_proxy` does not change `Host` unless told to.
- The stand-in applied the API's `classifyHost` rule and classified each host as expected: school subdomain → subdomain, admin/root/`www` → platform, a foreign domain → custom.
- **Negative control:** with `header_up Host {upstream_hostport}` added (what nginx does by default) the API saw `127.0.0.1` for every request, every school would be "not found", and `deploy/verify-host-forwarding.sh` reported FAIL on all hosts.

**What was NOT tested:** the real API. The stand-in uses a verbatim copy of `classifyHost`, because the real module needs the full dependency install and a database. Wildcard TLS, custom-domain TLS, nginx, and Netlify were not tested at all. The shipped Caddyfile has not been run with real certificates.

**To verify on the real deployment** (needs no special endpoint): `BASE_DOMAIN=<your domain> ./deploy/verify-host-forwarding.sh`. It calls `/api/v1/health` on made-up hostnames and reads the 404 message `School portal '<host>' not found`, which shows the hostname the real API received. Add `CUSTOM_DOMAIN=<host>` to check a custom domain. Run it after every proxy or hosting change.

**nginx, if ever used instead:** its default sends the upstream's own name as Host. The API location needs `proxy_set_header Host $host;` and `proxy_set_header X-Forwarded-Proto $scheme;`. Untested here.

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

## 7. Backend items this architecture depends on

Tenant resolution and authentication behaviour are unchanged by the web work. The backend developer has since implemented the two items that needed code (commits `5e152f2` findings, `7aea3de` reserved subdomains, `5390a4c` `TRUST_PROXY`, all on `refactor/modules`). The backend's own reference is `docs/RESERVED_SUBDOMAINS_AND_CLIENT_IP.md`; this section only records what the web deployment must line up with.

1. **Trust the proxy: DONE (backend).** `TRUST_PROXY` env, unset = off. Accepts a hop count (1 to 10), `loopback` / `linklocal` / `uniquelocal`, or IPs/CIDRs. Production rejects `true`, `*` and `/0` ranges. **Deployment rule:** it must match the real topology. One Caddy/nginx on the same VPS: `TRUST_PROXY=loopback` (or `1`). Leaving it unset behind a proxy means every visitor shares the proxy's IP for rate limiting and audit records. Setting it too wide lets clients spoof their IP via `X-Forwarded-For`.
2. **Reserved labels: DONE (backend).** One rule, `isReservedSubdomain()`: built-in list + `ADMIN_SUBDOMAIN` + `RESERVED_SUBDOMAINS_EXTRA` (comma-separated), used by registration and platform create-school. It only blocks NEW schools; the backend ships a `report:reserved-subdomains` script to find schools that already hold a reserved label. Run it before go-live.
3. **`COOKIE_DOMAIN` unset in production** and `NODE_ENV=production` (cookies `Secure`). Unchanged. Still a deployment checklist item.
4. **Optional, defence in depth:** refuse a request whose `Host` is the raw upstream address instead of treating it as a custom domain. Not implemented; not required.

### Proxy header requirements
- Caddy: `reverse_proxy` already keeps `Host` and adds `X-Forwarded-For/-Proto/-Host`. Note it overwrites an incoming `X-Forwarded-For` unless the client is in `trusted_proxies`, which is what you want for a public-facing edge.
- nginx: its default REPLACES Host. Add `proxy_set_header Host $host;` plus `X-Forwarded-For $proxy_add_x_forwarded_for` and `X-Forwarded-Proto $scheme`.
- Check with `deploy/verify-host-forwarding.sh` on the real VPS (still outstanding; the sandbox run covered Caddy only).

### Separate backend finding (not web, not changed here)
`request-context.middleware` is documented as "mount FIRST" but is not mounted in `app.ts`. Worth the backend owner confirming whether that is intended.

## 8. Custom domains: what is still needed for complete support

Works today (backend): the resolver recognises a verified custom domain; login results and impersonation return the custom URL; host-only cookies and same-origin proxying work for any hostname.

Missing, in dependency order:

| # | Gap | Where | Notes |
|---|---|---|---|
| 1 | **No way to set or verify a custom domain.** The resolver only reads `customDomain` / `customDomainVerifiedAt`. I found no route or use case in the school module that writes them (searched the module's routes and use-case file names; confirm). | backend | Needs: request a domain, show the DNS record to create, verify it, set `customDomainVerifiedAt`, remove it. Platform-admin and/or school-admin screens afterwards. |
| 2 | **TLS for customer domains.** The proxy needs a certificate per verified domain, without issuing for arbitrary names. | backend + proxy | Caddy on-demand TLS with an `ask` endpoint that answers 200 only for a verified custom domain. That endpoint does not exist. The Caddyfile has the block commented out. DNS for the customer: CNAME/A to the VPS. |
| 3 | **School branding lookup.** `GET /school/public/:subdomain` looks a school up by the subdomain in the URL; a custom domain has none. | backend + web | Add a host-based variant (for example `GET /school/public`, using the tenant the request's Host already resolved) and have `portal-login` call it when the host is a custom domain. The existing endpoint also lets anyone test whether a subdomain exists; the host-based one avoids that. |
| 4 | **"Last portal" and the navbar shortcut** are stored and rebuilt from a subdomain. A custom-domain school is never saved. | web | Store the school's full `url` instead (login result and API both provide it). |
| 5 | **Super-admin school pages** print `<subdomain>.<base domain>` even when the school has a verified custom domain. | web | Show `customDomain` when verified (the API mapper already returns it). |
| 6 | **Emails and links** built from a subdomain. | backend | `url.service` already knows about `customDomain`; check every link goes through it. |
| 7 | **Onboarding redirect** after school creation uses the subdomain. | web | Fine for new schools (they start on a subdomain); revisit when a school can switch domains. |
| 8 | **CORS** | none | Not needed under Option A. If a separate API host is ever introduced, custom domains need their own rule. |

Items 3, 4 and 5 are the only web changes. They are small once the backend provides the host-based public endpoint.

## 9. Still open in the web app

- **Custom-domain branding:** see section 8, gap 3.
- Looking at the site by IP address (for example from a phone on the LAN) is classified as a custom domain, as the API does; use `*.localhost` or add a hosts entry.
- Netlify-specific configuration is deliberately not written: Host forwarding there is unverified (section 3).
