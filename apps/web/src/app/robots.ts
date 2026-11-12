import type { MetadataRoute } from "next";
import { COMPANY } from "@/config/company";
import { PROTECTED_ROOTS } from "@/lib/routes";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: [...PROTECTED_ROOTS.map((r) => `${r}/`), "/api/"],
		},
		sitemap: `${COMPANY.website}/sitemap.xml`,
	};
}