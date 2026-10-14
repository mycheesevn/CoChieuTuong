"use client";

import { useEffect, useState } from "react";
import { STR, type Lang } from "@/lib/cct/i18n";
import {
  fetchCctLeaderboard,
  type CctLeaderRow,
} from "@/lib/supabase/leaderboard";
import { usePagination, Pagination } from "./Pagination";
import { StatsView } from "./StatsView";

interface Props {
  lang: Lang;
  myUserId: string | null;
}

export function LeaderboardView({ lang, myUserId }: Props) {
  const s = STR[lang] as Record<string, string | string[]>;
  const [tab, setTab] = useState<"board" | "stats">("board");
  const [rows, setRows] = useState<CctLeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCctLeaderboard(100)
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { page, pageCount, pageItems, setPage } = usePagination(rows, 15);

  const myRow = myUserId ? rows.find((r) => r.user_id === myUserId) : null;

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
          <p className="cct-empty-note">…</p>
        ) : rows.length === 0 ? (
          <p className="cct-empty-note">
            {lang === "vi" ? "Chưa có dữ liệu." : "No data yet."}
          </p>
        ) : (
          <>
            <div className="cct-lb-head">
              <span>{String(s.rank)}</span>
              <span className="cct-lb-name">{String(s.player)}</span>
              <span className="cct-lb-xp">{String(s.xp)}</span>
              <span className="cct-lb-title">
                {String(s.wins)}/{String(s.games)}
              </span>
            </div>
            <ol className="cct-board-list">
              {pageItems.map((r) => (
                <li
                  key={r.user_id}
                  className={`cct-lb-row${
                    myUserId && r.user_id === myUserId ? " cct-lb-me" : ""
                  }`}
                >
                  <span className="cct-lb-rank">#{r.rank}</span>
                  <span className="cct-lb-name">{r.display_name}</span>
                  <span className="cct-lb-xp">⚡{r.xp}</span>
                  <span className="cct-lb-title">
                    {r.wins} {String(s.wins)} · {r.games_played}{" "}
                    {String(s.games)}
                  </span>
                </li>
              ))}
            </ol>
            <Pagination page={page} pageCount={pageCount} onPage={setPage} />
            {myRow && (
              <p className="cct-hint">
                {String(s.myRank)}: <strong>#{myRow.rank}</strong>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
