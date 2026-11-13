import type { NextConfig } from "next";
import { imageHostsFor } from "./src/config/image-hosts";

// Same value the API uses for Supabase Storage (see apps/web/.env.local.example). Decides which picture links next/image accepts.
const imageHosts = imageHostsFor(process.env.SUPABASE_URL);
if (imageHosts.usedFallback) {
	console.warn("[next.config] SUPABASE_URL is not set (or not a valid link): allowing only https://*.supabase.co public files for next/image. Set SUPABASE_URL to the API's value.");
}

const nextConfig: NextConfig = {
	// @schoolos/contracts is shipped as TypeScript source (its package.json "main" is src/index.ts), so Next must compile it.
	transpilePackages: ["@schoolos/contracts"],
	images: {
		remotePatterns: imageHosts.patterns,
		// Local Supabase only, development only: Next's image optimiser blocks private addresses by default.
		...(imageHosts.allowLocalIp ? { dangerouslyAllowLocalIP: true } : {}),
	},
};

export default nextConfig;
