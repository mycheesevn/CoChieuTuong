// App icon: wood rounded square with two game discs — the red general
// disc (large, lower-center-left) in front of a green soldier disc
// (upper-right, partly behind), thin rings like the board pieces.
//
// Variants:
// - rounded:  favicon / general use (transparent corners, framed)
// - bleed:    full-bleed square (apple touch icon — iOS applies its mask)
// - maskable: full-bleed with the artwork inside the maskable safe zone

export type IconVariant = "rounded" | "bleed" | "maskable";

/** Bump this whenever the icon artwork changes. Home-screen icons are
 * snapshots (an installed shortcut never re-reads the icon), and the
 * /pwa PNG routes are served with a 1-year immutable cache — the ONLY
 * way existing devices ever fetch a new icon is a new URL, so every
 * icon URL carries `?v=${ICON_VERSION}` (manifest + layout metadata). */
export const ICON_VERSION = 1;

function disc(
  cx: number,
  cy: number,
  r: number,
  gradId: string,
  ringOpacity: number
): string {
  const ring = r - (r > 100 ? 13 : 11);
  return `<g>
    <circle cx="${cx}" cy="${cy + r * 0.09}" r="${r}" fill="rgba(0,0,0,0.25)}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${gradId})"/>
    <circle cx="${cx}" cy="${cy}" r="${ring}" fill="none" stroke="rgba(255,255,255,${ringOpacity})" stroke-width="${r > 100 ? 4 : 3.5}"/>
  </g>`;
}

export function cctIconSvg(variant: IconVariant = "rounded"): string {
  const bleed = variant !== "rounded";
  const frame = bleed
    ? { x: 0, y: 0, w: 512, rx: 0 }
    : { x: 6, y: 6, w: 500, rx: 112 };
  const contentScale = variant === "maskable" ? 0.82 : 1;
  const content = `
    ${disc(318, 168, 104, "greenDisc", 0.35)}
    ${disc(196, 322, 138, "redDisc", 0.3)}`;
  const scaled =
    contentScale === 1
      ? content
      : `<g transform="translate(256 256) scale(${contentScale}) translate(-256 -256)">${content}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <clipPath id="iconClip"><rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.w}" rx="${frame.rx}"/></clipPath>
    <linearGradient id="woodBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#C79A63"/><stop offset="1" stop-color="#A67C44"/>
    </linearGradient>
    <radialGradient id="greenDisc" cx="0.38" cy="0.34" r="0.95">
      <stop offset="0" stop-color="#1C6B4C"/><stop offset="1" stop-color="#0C4230"/>
    </radialGradient>
    <radialGradient id="redDisc" cx="0.38" cy="0.34" r="0.95">
      <stop offset="0" stop-color="#B3242F"/><stop offset="1" stop-color="#7E1019"/>
    </radialGradient>
  </defs>
  <rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.w}" rx="${frame.rx}" fill="url(#woodBg)"/>
  <g clip-path="url(#iconClip)">${scaled}</g>
  ${bleed ? "" : '<rect x="6" y="6" width="500" height="500" rx="112" fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="4"/>'}
</svg>`;
}
