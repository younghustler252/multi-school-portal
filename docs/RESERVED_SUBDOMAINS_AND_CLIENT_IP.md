# Reserved subdomains and client IP behind a reverse proxy

Status: findings and proposal, written BEFORE the implementation (the implementation follows in separate commits).
Scope: backend only. Authentication and tenant resolution (`tenant-resolver.middleware.ts`, login, token logic) are not changed.
Custom-domain management stays future scope (`DEPLOYMENT.md` §8). Note: `DEPLOYMENT.md` is not on any branch I could fetch,
so this was written from the code, not from §8 or the M2 document. Please compare it with them.

---

## 1. Reserved subdomains

### What is there today
- The list is `RESERVED_SUBDOMAINS` in `modules/auth/domain/auth.enums.ts` (24 labels, including `www` and `admin`).
- It is checked in exactly two places, each with its own copy of the rule
  `RESERVED_SUBDOMAINS.includes(x) || x === env.ADMIN_SUBDOMAIN.toLowerCase()`:
  - `auth/usecases/register.usecase.ts` (self-registration)
  - `school/usecases/platform/create-school.usecase.ts` (platform-created school)
- The DTOs (`RegisterDto`, `CreateSchoolDto`) trim and lowercase the value and enforce `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`, 3 to 50 characters.
- The tenant resolver already treats `www.<base>` and `<ADMIN_SUBDOMAIN>.<base>` as the platform (public) context.

### Gaps
1. **Two copies of one rule.** A third place that creates a school (an import, a script, a future endpoint) would have to remember both halves. The configured admin label is compared inline each time.
2. **Normalisation lives only in the DTO.** The use cases compare the raw string. A caller that skips the DTO (script, test, queue job) could pass `WWW` or ` admin`.
3. **The list is hard-coded and short.** Labels a platform normally needs are missing: mail/DNS (`mx`, `ns1`, `ns2`, `imap`, `pop`, `webmail`, `autodiscover`), operations (`metrics`, `monitor`, `grafana`, `health`, `internal`, `git`), and platform words (`platform`, `root`, `superadmin`, `sandbox`, `preview`, `stage`, `prod`). Operators also cannot add their own without a code change.
4. **Only the admin label comes from configuration.** If an operator changes `ADMIN_SUBDOMAIN`, the old default `admin` stays reserved (fine), but nothing else is configurable.
5. **Existing data is not checked.** A school that already holds a reserved label (created before a label was added to the list) keeps working, but it would collide with the platform host. There is no report for it.

Not a gap: the resolver. `a.b.<base>` is already `invalid`, and a reserved label that is not `www`/admin simply finds no school.

### Proposal
- One module, `src/shared/utils/subdomain.ts`, is the single source:
  `normaliseSubdomain(label)`, `reservedSubdomains()` and `isReservedSubdomain(label)`.
  A label is reserved when, after trim and lowercase, it is in the built-in list, equals `ADMIN_SUBDOMAIN`, or is in the new optional
  environment variable `RESERVED_SUBDOMAINS_EXTRA` (comma separated).
- `auth.enums.ts` keeps exporting `RESERVED_SUBDOMAINS` (now re-exported from the shared module), so nothing else breaks.
- `register.usecase.ts` and `create-school.usecase.ts` call `isReservedSubdomain` and drop their copied rule. Behaviour for callers is unchanged (the same "not available" conflict error, which does not reveal whether the label is reserved or taken).
- Tests: every built-in label, the configured admin label (set to a non-default value), extras from the environment, case and whitespace variants, a normal school name is not blocked, and a source-level check that both use cases go through the shared function.
- Existing data: a read-only script `scripts/report-reserved-subdomains.ts` lists schools whose subdomain is now reserved. It changes nothing.

---

## 2. Client IP behind a reverse proxy

### The seven `req.ip` usages
| # | File | Used for |
|---|------|----------|
| 1 | `infrastructure/middleware/request-context.middleware.ts` | request context IP (audit) |
| 2 | `modules/auth/controllers/auth.controller.ts` | login/refresh/logout metadata: login lockout counters, session IP |
| 3 | `modules/user/controllers/user.controller.ts` | profile, password change, sessions (audit, login attempts) |
| 4 | `modules/school/controllers/school.controller.ts` (`ipOf`) | school-admin actions (audit) |
| 5 | `modules/school/controllers/school-platform.controller.ts` | impersonation ticket (audit) |
| 6 | `modules/staff/controllers/staff.controller.ts` | staff actions (audit) |
| 7 | `modules/guardians/controllers/guardian.controller.ts` | guardian actions (audit) |

Not in that count but affected the same way: all `express-rate-limit` limiters (`globalLimiter`, `authLimiter`, `otpLimiter`, `uploadLimiter`, `webhookLimiter`) key on `req.ip` by default, and `loginAttemptService` keys on email + IP.

### What goes wrong today
`app.ts` never sets `trust proxy`. With Express's default, `req.ip` is the TCP peer address. Behind Caddy, nginx or a load balancer that is **the proxy**, so:
- every user shares one rate-limit bucket (100 requests per 15 minutes in total; 10 failed logins in total), so one noisy user locks everyone out;
- login lockout counters and brute-force protection are keyed on the proxy, not the attacker;
- audit logs and session lists record the proxy's address for every action;
- `express-rate-limit` v8 logs `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` when the header is present but trust is off.

### Why not `trust proxy = true`
`true` trusts every hop, so Express takes the **left-most** `X-Forwarded-For` entry, which the client writes. Anyone can send `X-Forwarded-For: 1.2.3.4` and (a) dodge the rate limiter and login lockout with a fresh fake address each request, and (b) forge the IP in audit logs and in the session list. That is worse than the present behaviour, so it must not be the default and must not be used in production.

### How Express decides (Express 5)
`app.set("trust proxy", value)` tells Express which hops are *our* proxies. `req.ip` is then the first address, reading `X-Forwarded-For` from the right, that is **not** a trusted proxy. Accepted values:
- a number N: trust the N nearest hops (the app must be reachable only through them);
- an IP/CIDR or list (`"10.0.0.0/8, 172.16.0.0/12"`) or the names `loopback`, `linklocal`, `uniquelocal`: trust exactly those addresses. This is the safest form, because the check is on the address that actually connected to us;
- `false` (default): trust nothing.

Setting it also makes `req.protocol`, `req.secure` and `req.hostname` honour `X-Forwarded-Proto` / `-Host` from trusted peers only.

### Proposal
- New optional environment variable **`TRUST_PROXY`**, parsed and validated in `config/env.ts` through a small pure module `shared/utils/trust-proxy.ts`:
  - unset or empty: `false` (trust nothing; today's behaviour, correct for local development with no proxy);
  - a whole number 1 to 10: hop count;
  - otherwise a comma-separated list of IPs, CIDRs or `loopback`/`linklocal`/`uniquelocal`, each validated (a bad value stops startup with a clear message);
  - the literal `true` is **rejected** in production, and `*`/`0.0.0.0/0`/`::/0` (trust everyone) are rejected always.
- `app.ts` applies it with one line, `app.set("trust proxy", parseTrustProxy(env.TRUST_PROXY))`, before any middleware, and logs the effective setting once at startup (never the secrets).
- The setting is proxy-agnostic. Caddy, nginx, Traefik or a cloud load balancer all work with the same variable; only the value differs:
  - same host or container network, single proxy: `TRUST_PROXY=loopback` or the proxy's docker subnet, for example `172.18.0.0/16`;
  - a cloud load balancer in front of a proxy: its address range, or `2` if the topology is fixed and the app is firewalled to the proxy only.
- **Proxy requirements (operations, not code).** The proxy must set `X-Forwarded-For` from the real peer and pass `Host` unchanged, and the API port must be reachable only from the proxy (firewall or private network). With an address list Express is safe even if the proxy appends to an incoming `X-Forwarded-For`; with a hop count it is only safe if the proxy overwrites it. Caddy's `reverse_proxy` overwrites by default; nginx needs `proxy_set_header X-Forwarded-For $remote_addr;` (or accept append and use an address list), plus `proxy_set_header Host $host;` and `X-Forwarded-Proto $scheme`.
- Tests: the parser (all accepted and rejected forms) and a real Express app with a socket-level test proving that with trust off a forged `X-Forwarded-For` is ignored, that with the proxy trusted the real client is read, and that a forged left-hand entry is still ignored when the proxy appends to it.
- The seven call sites are **not** changed: they already read `req.ip`, which is exactly what `trust proxy` corrects, and the rate limiters pick it up automatically.

### Related findings (not changed here)
- `requestContext` (`request-context.middleware.ts`) is documented as "mount FIRST" but is not mounted in `app.ts`, so the request context's `ip`/`requestId` that audit and posting read is not populated from this middleware. Worth a separate look with the audit module owner; it is outside this change.
- `tenant-resolver.middleware.ts` reads `req.headers.host`. That is unaffected by `trust proxy`, but it requires the proxy to forward the original `Host`. Leaving it alone as asked.
- The auth cookie's `secure` flag is `NODE_ENV === "production"`, independent of the proxy. No change needed.
- Webhook routes (`/api/v1/webhooks`) use no IP allow-list today, so they are unaffected.

---

## Order of work
1. This document (this commit).
2. Reserved subdomains: shared module, two call sites, tests, report script.
3. `TRUST_PROXY`: parser, env, `app.ts`, tests, deployment notes.
