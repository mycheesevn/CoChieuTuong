"use client";

import { useEffect, useState } from "react";
import { STR, type Lang } from "@/lib/cct/i18n";
import { LEVEL_THRESHOLDS, levelForXp, levelProgress } from "@/lib/cct/levels";
import { ratingTitle } from "@/lib/cct/rating";
import {
  fetchCctLeaderboard,
  type CctLeaderRow,
} from "@/lib/supabase/leaderboard";
import { useAuth } from "@/lib/supabase/auth";
import { renderShareCard, sharePng } from "@/lib/cct/shareCard";
import { usePagination, Pagination } from "./Pagination";
import { StatsView } from "./StatsView";
import { FriendButton } from "./FriendsView";

const RANK_MEDAL = ["🥇", "🥈", "🥉"];

interface Props {
  lang: Lang;
  myUserId: string | null;
}

export function LeaderboardView({ lang, myUserId }: Props) {
  const s = STR[lang] as Record<string, string | string[]>;
  const { profile, cctStats } = useAuth();
  const [tab, setTab] = useState<"board" | "stats">("board");
  const [rows, setRows] = useState<CctLeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  useEffect(() => {
    fetchCctLeaderboard(100)
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { page, pageCount, pageItems, setPage } = usePagination(rows, 15);

  const myRow = myUserId ? rows.find((r) => r.user_id === myUserId) : null;

  // My-rank card data (PacClone anatomy): prefer my leaderboard row;
  // fall back to my own stats when I'm ranked below the fetched window.
  const myXp = myRow?.xp ?? cctStats?.xp ?? null;
  const myRating = myRow?.rating ?? cctStats?.rating ?? 800;
  const myPeak = myRow?.peak_rating ?? cctStats?.peak_rating ?? 800;
  const myWins = myRow?.wins ?? cctStats?.wins ?? 0;
  const myGames = myRow?.games_played ?? cctStats?.games_played ?? 0;
  const myName =
    myRow?.display_name ??
    profile?.full_name?.trim() ??
    profile?.username ??
    "";
  const prog = myXp !== null ? levelProgress(myXp) : null;
  const nextThreshold = prog ? LEVEL_THRESHOLDS[prog.level] : undefined;
  const winRate = myGames > 0 ? Math.round((myWins / myGames) * 100) : 0;

  const shareRank = async () => {
    if (sharing || !myRow || myXp === null) return;
    setSharing(true);
    try {
      const title = String(s.achRankTitle).replace(
        "{rank}",
        String(myRow.rank)
      );
      const blob = await renderShareCard({
        state: null,
        headline: title,
        subline: `${myName} · ⭐${myRating} ${ratingTitle(myRating, lang)} · Lv ${levelForXp(myXp)}`,
        appName:
          lang === "vi" ? "Cờ Chiếu Tướng" : "Vietnamese General Check",
        appUrl: "cochieutuong-my-cheese-vn.vercel.app",
      });
      const outcome = await sharePng(blob, title, myName);
      setShareToast(
        outcome === "shared"
          ? String(s.shareDone)
          : String(s.shareDownloaded)
      );
      window.setTimeout(() => setShareToast(null), 4000);
    } catch {
      /* best-effort */
    } finally {
      setSharing(false);
    }
  };

  /** Avatar + name identity for a row (mirrors the Friends rows). */
  const identity = (r: CctLeaderRow) => (
    <span className="cct-friend-id">
      {r.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.avatar_url} alt="" className="cct-friend-avatar" />
      ) : (
        <span className="cct-friend-avatar cct-friend-avatar-fallback">
          {(r.display_name.trim()[0] ?? "👤").toUpperCase()}
        </span>
      )}
      <span>
        {r.display_name}
        {myUserId && r.user_id === myUserId ? ` (${String(s.you)})` : ""}
      </span>
    </span>
  );

  return (
    <div className="cct-scroll-area">
      <div className="cct-view">
        <div className="cct-lb-tabs">
          <button
            type="button"
            className={tab === "board" ? "active" : ""}
            onClick={() => setTab("board")}
          >
            🏆 {String(s.leaderboard)}
          </button>
          <button
            type="button"
            className={tab === "stats" ? "active" : ""}
            onClick={() => setTab("stats")}
          >
            📊 {String(s.statsTab)}
          </button>
        </div>

        {tab === "stats" ? (
          <StatsView lang={lang} />
        ) : loading ? (
          <p className="cct-empty-note">{String(s.loading)}</p>
        ) : (
          <>
            {!myUserId && (
              <p className="cct-empty-note">{String(s.leaderboardLogin)}</p>
            )}

            {myUserId && (myRow || cctStats) && prog && myXp !== null && (
              <section className="cct-lb-me-card">
                {shareToast && (
                  <div className="cct-xp-toast">{shareToast}</div>
                )}
                <div className="cct-lb-me-row">
                  <span className="cct-lb-me-label">
                    #{myRow?.rank ?? "–"} · {ratingTitle(myRating, lang)}
                  </span>
                  <span className="cct-lb-xp">⭐ {myRating}</span>
                  {myRow && (
                    <button
                      type="button"
                      className="cct-btn small"
                      onClick={() => void shareRank()}
                      disabled={sharing}
                      title={String(s.achShare)}
                      aria-label={String(s.achShare)}
                    >
                      📤
                    </button>
                  )}
                </div>
                <div className="cct-lb-me-row">
                  <span className="cct-lb-name">{myName}</span>
                  <span className="cct-hint">
                    Lv {prog.level}
                    {nextThreshold !== undefined
                      ? ` · ${String(s.xpToNext)
                          .replace("{xp}", String(nextThreshold - myXp))
                          .replace("{level}", String(prog.level + 1))}`
                      : ""}
                  </span>
                </div>
                <div
                  className="cct-progress"
                  role="progressbar"
                  aria-valuenow={Math.round(prog.prog * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="cct-progress-fill"
                    style={{ width: `${prog.prog * 100}%` }}
                  />
                </div>
                <div className="cct-lb-stats-row">
                  <span>
                    📈 {myPeak} {String(s.peakRating)}
                  </span>
                  <span>
                    🎯 {winRate}% {String(s.winRate)}
                  </span>
                  <span>
                    🏆 {myWins} {String(s.wins)}
                  </span>
                  <span>
                    🎮 {myGames} {String(s.games)}
                  </span>
                </div>
              </section>
            )}

            <h3 className="cct-lb-section">{String(s.topPlayers)}</h3>
            {rows.length === 0 ? (
              <p className="cct-empty-note">
                {String(s.leaderboardEmpty)}
              </p>
            ) : (
              <>
                <ol className="cct-board-list">
                  {pageItems.map((r) => {
                    const isMe = !!myUserId && r.user_id === myUserId;
                    return (
                      <li
                        key={r.user_id}
                        className={`cct-lb-row${isMe ? " cct-lb-me" : ""}`}
                      >
                        <span className="cct-lb-rank">
                          {RANK_MEDAL[r.rank - 1] ?? `#${r.rank}`}
                        </span>
                        <span className="cct-lb-main">
                          {identity(r)}
                          <span className="cct-lb-sub">
                            {ratingTitle(r.rating, lang)} · Lv{" "}
                            {levelForXp(r.xp)} · {r.wins} {String(s.wins)} ·{" "}
                            {r.games_played} {String(s.games)}
                          </span>
                        </span>
                        <span className="cct-lb-xp">⭐{r.rating}</span>
                        {myUserId && !isMe && (
                          <FriendButton
                            lang={lang}
                            userId={myUserId}
                            otherId={r.user_id}
                          />
                        )}
                      </li>
                    );
                  })}
                </ol>
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  onPage={setPage}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
