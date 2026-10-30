import type { MetadataRoute } from "next";
import { COMPANY } from "@/config/company";

export default function sitemap(): MetadataRoute.Sitemap {
	const routes = ["", "/pricing"];

	return routes.map((route) => ({
		url: `${COMPANY.website}${route}`,
		lastModified: new Date(),
		changeFrequency: "weekly",
		priority: route === "" ? 1 : 0.8,
	}));
}