"use client";

import { displayName, useAuth } from "@/lib/supabase/auth";
import { STR, type Lang } from "@/lib/cct/i18n";

interface Props {
  lang: Lang;
  open: boolean;
  onClose: () => void;
}

export function ProfileModal({ lang, open, onClose }: Props) {
  const dict = STR[lang] as Record<string, string | string[]>;
  const t = (k: string, fb: string): string => {
    const v = dict[k];
    return typeof v === "string" ? v : fb;
  };
  const { user, profile, cctStats, loading } = useAuth();

  if (!open) return null;
  // Parent guarantees open only when logged in, but render nothing for guests.
  if (!user) return null;

  const name = displayName(profile, user.email);
  const initial = (name.trim()[0] ?? "👤").toUpperCase();
  const s = cctStats;

  const stat = (value: number, key: string, fb: string) => (
    <div className="cct-profile-stat" key={key}>
      <b>{value}</b>
      <span>{t(key, fb)}</span>
    </div>
  );

  return (
    <div className="cct-modal-root" onClick={onClose}>
      <div
        className="cct-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="👤"
      >
        <div className="cct-profile-head">
          <h2>👤 {t("appName", "Cờ Chiếu Tướng")}</h2>
          <button
            type="button"
            className="cct-btn cct-btn-icon"
            onClick={onClose}
            aria-label={t("close", lang === "vi" ? "Đóng" : "Close")}
          >
            ✕
          </button>
        </div>
        {loading ? (
          <p className="cct-muted" style={{ textAlign: "center" }}>
            …
          </p>
        ) : (
          <>
            <div className="cct-profile-avatar">{initial}</div>
            <div className="cct-profile-name">{name}</div>
            {user.email && <div className="cct-profile-email">{user.email}</div>}
            <div className="cct-profile-stats">
              {stat(s?.xp ?? 0, "profileXp", "XP")}
              {stat(s?.wins ?? 0, "profileWins", lang === "vi" ? "Thắng" : "Wins")}
              {stat(s?.losses ?? 0, "profileLosses", lang === "vi" ? "Thua" : "Losses")}
              {stat(s?.draws ?? 0, "profileDraws", lang === "vi" ? "Hòa" : "Draws")}
              {stat(
                s?.games_played ?? 0,
                "profileGames",
                lang === "vi" ? "Ván" : "Games"
              )}
            </div>
            <div className="cct-buttons">
              <button type="button" className="cct-btn" onClick={onClose}>
                {t("close", lang === "vi" ? "Đóng" : "Close")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
