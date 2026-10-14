import type { Metadata, Viewport } from "next";
import { ICON_VERSION } from "@/lib/cct/iconSvg";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cờ Chiếu Tướng — trò chơi dân gian trí tuệ",
  description:
    "Chơi Cờ Chiếu Tướng với máy — trò chơi dân gian trí tuệ: dùng Tướng nhảy qua quân đệm để ăn quân, chiếu bí đối phương. Miễn phí, tiếng Việt.",
  icons: {
    icon: [
      { url: `/icon.svg?v=${ICON_VERSION}`, type: "image/svg+xml" },
      { url: `/pwa/icon-192.png?v=${ICON_VERSION}`, sizes: "192x192", type: "image/png" },
      { url: `/pwa/icon-512.png?v=${ICON_VERSION}`, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: `/pwa/apple-touch-icon.png?v=${ICON_VERSION}`, sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#14100c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
