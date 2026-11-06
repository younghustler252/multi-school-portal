import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// @schoolos/contracts is shipped as TypeScript source (its package.json "main" is src/index.ts), so Next must compile it.
	transpilePackages: ["@schoolos/contracts"],
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "*.supabase.co",
			},	
		],
	},
};

export default nextConfig;/*  */