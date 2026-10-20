import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Only public marketing pages are indexable; member areas require login anyway.
    rules: [{ userAgent: "*", allow: ["/$", "/safety", "/register", "/login"], disallow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
