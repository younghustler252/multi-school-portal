import { isIP } from "node:net";

/*
|--------------------------------------------------------------------------
| TRUST_PROXY: which hops in front of the API are OUR reverse proxy (so Express may believe X-Forwarded-For from them).
|
| Express then sets req.ip to the first address, reading X-Forwarded-For from the right, that is not a trusted proxy.
| A client can write anything into the left of that header, so trusting everyone ("true") lets anybody pick the IP that
| rate limits, login lockouts and audit logs see. That is refused here.
|
| Accepted values (proxy-agnostic: Caddy, nginx, Traefik or a cloud load balancer all work):
|   unset / "" / "false" / "0"   trust nothing (req.ip is the TCP peer)  [default; right for local development]
|   "1" .. "10"                  trust that many hops (only safe when the API is reachable ONLY through them)
|   "loopback", "linklocal", "uniquelocal"      Express' named ranges
|   "10.0.0.5", "172.18.0.0/16", "fd00::/8"     exact addresses or CIDR ranges of the proxy (safest)
|   any comma-separated mix of the last two kinds
| Rejected: "true" in production, "*", and any range with a /0 prefix (that is "everyone").
|--------------------------------------------------------------------------
*/

export type TrustProxySetting = false | number | string[];

const NAMED = new Set(["loopback", "linklocal", "uniquelocal"]);

export class TrustProxyConfigError extends Error {
    constructor(message: string) { super(`TRUST_PROXY: ${message}`); this.name = "TrustProxyConfigError"; }
}

function validateEntry(entry: string): string {
    const value = entry.trim();
    if (value === "*") throw new TrustProxyConfigError(`"*" would trust every client; list your proxy's address or range instead`);
    if (NAMED.has(value.toLowerCase())) return value.toLowerCase();

    const [address, prefix, ...rest] = value.split("/");
    const family = isIP(address);
    if (!family || rest.length > 0) throw new TrustProxyConfigError(`"${value}" is not an IP address, a CIDR range or one of loopback/linklocal/uniquelocal`);
    if (prefix !== undefined) {
        const bits = Number(prefix);
        const max = family === 4 ? 32 : 128;
        if (!/^\d+$/.test(prefix) || bits > max) throw new TrustProxyConfigError(`"${value}" has an invalid prefix length`);
        if (bits === 0) throw new TrustProxyConfigError(`"${value}" would trust every client`);
    }
    return value;
}

export function parseTrustProxy(raw: string | undefined, nodeEnv: string = "development"): TrustProxySetting {
    const text = (raw ?? "").trim();
    if (text === "" || text.toLowerCase() === "false") return false;

    if (text.toLowerCase() === "true") {
        if (nodeEnv === "production") throw new TrustProxyConfigError(`"true" trusts every client and lets anyone forge their IP; set the proxy's address, range or hop count`);
        return 1;   // development convenience: one hop
    }

    if (/^\d+$/.test(text)) {
        const hops = Number(text);
        if (hops === 0) return false;
        if (hops > 10) throw new TrustProxyConfigError(`hop count ${hops} is not plausible (1 to 10)`);
        return hops;
    }

    const entries = text.split(",").map(validateEntry);
    return entries;
}

/** A safe one-line description for the startup log. */
export function describeTrustProxy(setting: TrustProxySetting): string {
    if (setting === false) return "off (client IP = TCP peer)";
    if (typeof setting === "number") return `${setting} hop(s)`;
    return setting.join(", ");
}
