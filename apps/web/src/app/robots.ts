import type { MetadataRoute } from "next";
import { COMPANY } from "@/config/company";
import { robotsDisallow } from "@/lib/routes";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: robotsDisallow(),
		},
		sitemap: `${COMPANY.website}/sitemap.xml`,
	};
}