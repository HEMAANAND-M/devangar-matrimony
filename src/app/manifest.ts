import type { MetadataRoute } from "next";

/** Lets members install the site on their phone home screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Devangar Matrimony",
    short_name: "Devangar",
    description: "Verified, privacy-first matrimony for the Devangar community.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#faf7f1",
    theme_color: "#5e1229",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
