import type { MetadataRoute } from "next";
import { COMPANY } from "@/config/company";
import { ROUTES } from "@/lib/routes";

export default function sitemap(): MetadataRoute.Sitemap {
	const routes = ["", ROUTES.public.pricing];

	return routes.map((route) => ({
		url: `${COMPANY.website}${route}`,
		lastModified: new Date(),
		changeFrequency: "weekly",
		priority: route === "" ? 1 : 0.8,
	}));
}