import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/register", "/login", "/stories", "/events", "/faq", "/support", "/safety"].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "/events" || path === "/stories" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
}
