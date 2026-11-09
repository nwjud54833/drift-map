import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://driftmap.in/", changeFrequency: "weekly", priority: 1 },
    { url: "https://driftmap.in/workbench", changeFrequency: "weekly", priority: 0.7 },
    { url: "https://driftmap.in/privacy", changeFrequency: "yearly", priority: 0.3 },
    { url: "https://driftmap.in/terms", changeFrequency: "yearly", priority: 0.3 },
  ];
}
