/*
|--------------------------------------------------------------------------
| WHERE next/image MAY LOAD PICTURES FROM
|--------------------------------------------------------------------------
| School logos and the platform logo are uploaded to our own Supabase Storage (public bucket), and the API stores the
| link Supabase gives back. That link starts with SUPABASE_URL, the same value the API uses. So the picture rules are
| built from SUPABASE_URL instead of a wildcard that would allow every Supabase project in the world:
|
|   - hosted project   https://abcd.supabase.co             -> https, abcd.supabase.co, /storage/v1/object/public/**
|   - custom domain    https://files.example.com            -> https, files.example.com, same path
|   - local Supabase   http://localhost:54321               -> http, localhost, port 54321, same path
|
| Only the public-file path is allowed, never the whole host. If SUPABASE_URL is missing or not a link, the old
| wildcard (https://*.supabase.co, public-file path only) stays in place so nothing breaks, and a warning is printed.
|
| Next.js refuses to fetch pictures from a local/private address for its image optimiser unless told otherwise, so
| for a local Supabase we also switch that on, in development only (never in production).
*/

export const PUBLIC_FILE_PATH = "/storage/v1/object/public/**";

export interface ImagePattern { protocol: "http" | "https"; hostname: string; port?: string; pathname: string }
export interface ImageHosts { patterns: ImagePattern[]; allowLocalIp: boolean; usedFallback: boolean }

const FALLBACK: ImagePattern = { protocol: "https", hostname: "*.supabase.co", pathname: PUBLIC_FILE_PATH };

/** localhost, *.localhost, 127.x, ::1 and the private ranges: places Next's optimiser refuses by default. */
export function isLocalHost(hostname: string): boolean {
	const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
	if (h === "localhost" || h.endsWith(".localhost") || h === "::1") return true;
	const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(h);
	if (!m) return false;
	const a = Number(m[1]), b = Number(m[2]);
	return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

export function imageHostsFor(supabaseUrl: string | undefined, nodeEnv: string | undefined = process.env.NODE_ENV): ImageHosts {
	const fallback: ImageHosts = { patterns: [FALLBACK], allowLocalIp: false, usedFallback: true };
	if (!supabaseUrl) return fallback;
	let url: URL;
	try { url = new URL(supabaseUrl.trim()); } catch { return fallback; }
	if (url.protocol !== "https:" && url.protocol !== "http:") return fallback;

	const pattern: ImagePattern = {
		protocol: url.protocol === "https:" ? "https" : "http",
		hostname: url.hostname.replace(/^\[|\]$/g, ""),
		...(url.port ? { port: url.port } : {}),
		pathname: PUBLIC_FILE_PATH,
	};
	return { patterns: [pattern], allowLocalIp: isLocalHost(url.hostname) && nodeEnv !== "production", usedFallback: false };
}
