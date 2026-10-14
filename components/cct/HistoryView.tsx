"use client";

import { useEffect, useMemo, useState } from "react";
import { STR, levelShort, type Lang } from "@/lib/cct/i18n";
import { fetchCctGames, type CctGameRow } from "@/lib/supabase/history";
import {
  fetchMyRoomMatches,
  type MyRoomMatch,
} from "@/lib/supabase/rooms";
import { Pagination } from "./Pagination";
import { ReplayView } from "./ReplayView";
import { VideoExportModal, type CctVideoGame } from "./VideoExportModal";
import type { ReplayGame } from "@/lib/cct/replay";

const PAGE_SIZE = 10;

interface Props {
  lang: Lang;
  user: { id: string } | null;
  onLogin: () => void;
}

function reasonLabel(reason: string | null, s: Record<string, string | string[]>): string {
  switch (reason) {
    case "checkmate":
      return String(s.reasonCheckmate);
    case "stalemate":
      return String(s.reasonStalemate);
    case "resign":
      return String(s.reasonResign);
    case "no-screens":
      return String(s.reasonNoScreens);
    default:
      return reason ?? "";
  }
}

const resultIcon = (r: CctGameRow["result"]) =>
  r === "win" ? "🎉" : r === "loss" ? "😞" : "🤝";

/** Result from the viewer's perspective for a room match. */
function myRoomResult(
  m: MyRoomMatch["match"],
  mySide: MyRoomMatch["mySide"]
): "win" | "loss" | "draw" {
  if (m.result === "draw") return "draw";
  const winnerSide = m.result === "red" ? "r" : "g";
  return winnerSide === mySide ? "win" : "loss";
}

const roomResultIcon = (r: "win" | "loss" | "draw") =>
  r === "win" ? "✅" : r === "loss" ? "❌" : "➖";

export function HistoryView({ lang, user, onLogin }: Props) {
  const s = STR[lang] as Record<string, string | string[]>;
  const [rows, setRows] = useState<CctGameRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [roomMatches, setRoomMatches] = useState<MyRoomMatch[]>([]);
  const [replay, setReplay] = useState<ReplayGame | null>(null);
  const [videoGame, setVideoGame] = useState<CctVideoGame | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchCctGames(user.id, page, PAGE_SIZE)
      .then(({ rows, total }) => {
        setRows(rows);
        setTotal(total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetchMyRoomMatches(50)
      .then(setRoomMatches)
      .catch(() => {});
  }, [user, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const stats = useMemo(() => {
    let wins = 0,
      losses = 0,
      draws = 0;
    for (const g of rows) {
      if (g.result === "win") wins++;
      else if (g.result === "loss") losses++;
      else draws++;
    }
    return { wins, losses, draws };
  }, [rows]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US");

  if (!user) {
    return (
      <div className="cct-scroll-area">
        <div className="cct-view">
          <h2>📜 {String(s.history)}</h2>
          <div className="cct-panel">
            <p className="cct-hint">{String(s.loginToViewHistory)}</p>
            <button
              type="button"
              className="cct-btn cct-btn-primary"
              onClick={onLogin}
            >
              {String(s.login)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (replay) {
    return (
      <>
        <ReplayView
          lang={lang}
          game={replay}
          onBack={() => setReplay(null)}
          onExportVideo={(g) =>
            setVideoGame({
              labels: g.labels,
              startPos: g.startPos,
              startTurn: g.startTurn,
              title: g.title,
              subtitle: g.subtitle,
            })
          }
        />
        <VideoExportModal
          lang={lang}
          game={videoGame}
          onClose={() => setVideoGame(null)}
        />
      </>
    );
  }

  const toReplay = (g: CctGameRow): ReplayGame => ({
    labels: g.moves,
    startPos: g.start_pos && g.start_pos.length === 25 ? g.start_pos : undefined,
    startTurn: "r",
    title: `${levelShort(lang, g.level)} · ${g.plies} ${lang === "vi" ? "nước" : "plies"}`,
    subtitle: `${fmtDate(g.created_at)}${g.reason ? ` · ${reasonLabel(g.reason, s)}` : ""}`,
  });

  return (
    <div className="cct-scroll-area">
      <div className="cct-view">
        <h2>📜 {String(s.history)}</h2>
        {loading ? (
          <p className="cct-empty-note">…</p>
        ) : rows.length === 0 ? (
          <p className="cct-empty-note">{String(s.historyEmpty)}</p>
        ) : (
          <>
            <p className="cct-hint">
              🎉 {stats.wins} {String(s.wins)} · 😞 {stats.losses}{" "}
              {String(s.losses)} · 🤝 {stats.draws} {String(s.draws)}
            </p>
            <ul className="cct-board-list">
              {rows.map((g) => {
                const reason = reasonLabel(g.reason, s);
                return (
                  <li key={g.id} className="cct-lb-row">
                    <span>{resultIcon(g.result)}</span>
                    <span className="cct-lb-name">
                      {levelShort(lang, g.level)} · {g.plies}{" "}
                      {lang === "vi" ? "nước" : "plies"}
                      {reason ? ` · ${reason}` : ""}
                    </span>
                    <span className="cct-lb-title">{fmtDate(g.created_at)}</span>
                    {g.moves.length > 0 && (
                      <button
                        type="button"
                        className="cct-btn small"
                        onClick={() => setReplay(toReplay(g))}
                        title={String(s.replay)}
                      >
                        🎞️
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <Pagination page={page} pageCount={pageCount} onPage={setPage} />
          </>
        )}
        <RoomMatchesSection
          lang={lang}
          matches={roomMatches}
          loading={loading}
          s={s}
          fmtDate={fmtDate}
          onReplay={setReplay}
        />
      </div>
    </div>
  );
}

function RoomMatchesSection({
  lang,
  matches,
  loading,
  s,
  fmtDate,
  onReplay,
}: {
  lang: Lang;
  matches: MyRoomMatch[];
  loading: boolean;
  s: Record<string, string | string[]>;
  fmtDate: (iso: string) => string;
  onReplay: (g: ReplayGame) => void;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const items = useMemo(
    () => matches.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [matches, safePage]
  );
  if (loading || matches.length === 0) return null;
  return (
    <>
      <h2>👥 {String(s.roomRoomMatches)}</h2>
      <ul className="cct-board-list">
        {items.map(({ match: m, roomName, opponentName, mySide }) => {
          const r = myRoomResult(m, mySide);
          const reason =
            m.reason === "checkmate"
              ? String(s.reasonCheckmate)
              : m.reason === "stalemate"
                ? String(s.reasonStalemate)
                : m.reason === "resign"
                  ? String(s.reasonResign)
                  : m.reason === "no-screens"
                    ? String(s.reasonNoScreens)
                    : (m.reason ?? "");
          return (
            <li key={m.id} className="cct-lb-row">
              <span>{roomResultIcon(r)}</span>
              <span className="cct-lb-name">
                ⚔️ {opponentName} · {roomName} · {m.moves.length}{" "}
                {lang === "vi" ? "nước" : "plies"}
                {reason ? ` · ${reason}` : ""}
              </span>
              <span className="cct-lb-title">
                {fmtDate(m.finished_at ?? m.created_at ?? "")}
              </span>
              {m.moves.length > 0 && (
                <button
                  type="button"
                  className="cct-btn small"
                  onClick={() =>
                    onReplay({
                      labels: m.moves,
                      startTurn: "r",
                      title: `⚔️ ${opponentName} · ${roomName}`,
                      subtitle: `${m.moves.length} ${lang === "vi" ? "nước" : "plies"}${reason ? ` · ${reason}` : ""}`,
                    })
                  }
                  title={String(s.replay)}
                >
                  🎞️
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <Pagination page={safePage} pageCount={pageCount} onPage={setPage} />
    </>
  );
}
