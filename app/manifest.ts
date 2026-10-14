import { ICON_VERSION } from "@/lib/cct/iconSvg";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cờ Chiếu Tướng",
    short_name: "Chiếu Tướng",
    description:
      "Chơi Cờ Chiếu Tướng với máy — trò chơi dân gian trí tuệ: dùng Tướng nhảy qua quân đệm để ăn quân, chiếu bí đối phương.",
    lang: "vi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#14100c",
    theme_color: "#14100c",
    icons: [
      {
        src: `/icon.svg?v=${ICON_VERSION}`,
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: `/pwa/icon-192.png?v=${ICON_VERSION}`,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: `/pwa/icon-512.png?v=${ICON_VERSION}`,
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: `/pwa/icon-maskable.png?v=${ICON_VERSION}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
