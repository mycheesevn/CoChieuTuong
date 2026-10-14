"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Board, { usePieceInstances } from "./Board";
import {
  applyMove,
  gameStatus,
  isGeneralThreatened,
  legalMoves,
  moveLabel,
  type CctState,
  type GameResult,
  type Move,
  type Side,
} from "@/lib/cct/engine";
import { replayMatch, mySideInMatch } from "@/lib/supabase/matchUtil";
import { fireEvent } from "@/lib/supabase/notify";
import {
  cancelMatch,
  fetchComments,
  fetchNames,
  fetchReactions,
  fetchRoom,
  finishRoomMatch,
  getMatchById,
  postComment,
  pushMove,
  react,
  REACTIONS,
  startRematch,
  subscribeMatch,
  subscribeReactions,
  type RoomComment,
  type RoomMatch,
  type XpEarned,
} from "@/lib/supabase/rooms";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth";
import { reasonText, MoveLog, CapturedRow } from "./PlayView";
import {
  playCapture,
  playCheck,
  playLose,
  playMove,
  playSelect,
  playWin,
} from "@/lib/cct/sound";
import { burstConfetti } from "@/lib/cct/confetti";
import { STR, type Lang } from "@/lib/cct/i18n";

interface Props {
  match: RoomMatch;
  roomId: string;
  lang: Lang;
  userId: string | null;
  /** true for logged-out viewers: read-only, no flip, login teasers */
  guest: boolean;
  names: { red: string; green: string };
  onExit: () => void;
  onMatchChange: (m: RoomMatch) => void;
  /** Guests: tapping the react teaser asks the host to open login. */
  onRequireLogin?: () => void;
}

const owns = (cell: number, side: Side): boolean =>
  side === "r" ? cell === 1 || cell === 2 : cell === 3 || cell === 4;

function resultFromMatch(m: RoomMatch): GameResult | null {
  if (m.status === "cancelled")
    return { outcome: "win", winner: "r", reason: "resign" };
  if (m.status !== "finished" || !m.result) return null;
  if (m.result === "draw")
    return { outcome: "draw", reason: m.reason === "no-screens" ? "no-screens" : "agreement" };
  const winner = m.result === "red" ? "r" : "g";
  const reason =
    m.reason === "stalemate" || m.reason === "resign" ? m.reason : "checkmate";
  return { outcome: "win", winner, reason };
}

export default function RoomMatchView({
  match,
  roomId,
  lang,
  userId,
  guest,
  names,
  onExit,
  onMatchChange,
  onRequireLogin,
}: Props) {
  const s = STR[lang] as Record<string, string | string[]>;
  const { refreshStats } = useAuth();
  const mySide = mySideInMatch(userId, match.red_id, match.green_id);
  const isPlayer = !guest && mySide !== null;
  const [pendingLabels, setPendingLabels] = useState<string[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ sq: number; key: number } | null>(null);
  const [xpToast, setXpToast] = useState<number | null>(null);
  const [watchers, setWatchers] = useState(0);
  const [comments, setComments] = useState<RoomComment[]>([]);
  const [commentNames, setCommentNames] = useState<Record<string, string>>({});
  const [commentBody, setCommentBody] = useState("");
  const [shared, setShared] = useState(false);
  const [resignArmed, setResignArmed] = useState(false);
  const [cancelArmed, setCancelArmed] = useState(false);
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const flashKey = useRef(0);
  const finishGuard = useRef(false);
  const isLeader = !guest && userId !== null && userId === leaderId;

  // Effective labels: optimistic pending ones, else the server's.
  const labels = pendingLabels ?? match.moves;
  // When the server state advances past our pending labels, drop them.
  useEffect(() => {
    if (pendingLabels && match.moves.length >= pendingLabels.length) {
      setPendingLabels(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.moves.length, match.id]);

  // Leader lookup for the cancel-match button.
  useEffect(() => {
    let dead = false;
    fetchRoom(roomId)
      .then((r) => {
        if (!dead) setLeaderId(r?.leader_id ?? null);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [roomId]);

  const replay = useMemo(() => {
    try {
      return replayMatch(match.start_pos || "", labels);
    } catch {
      return null;
    }
  }, [match.start_pos, labels]);
  const states = replay?.states ?? [];
  const moves = replay?.moves ?? [];
  const cur: CctState | null = replay?.cur ?? null;

  const localStatus: GameResult = useMemo(
    () => (cur ? gameStatus(cur) : { outcome: "ongoing" }),
    [cur]
  );
  const serverResult = resultFromMatch(match);
  type Terminal = Extract<GameResult, { outcome: "win" | "draw" }>;
  const final: Terminal | null =
    (serverResult ?? (localStatus.outcome === "ongoing" ? null : localStatus)) as Terminal | null;
  const playing =
    match.status === "active" && localStatus.outcome === "ongoing" && !!cur;

  const legal = useMemo(
    () => (playing && cur ? legalMoves(cur) : []),
    [playing, cur]
  );
  const threatened: Side | null =
    playing && cur && isGeneralThreatened(cur, cur.turn) ? cur.turn : null;
  const targets = useMemo(
    () => (sel === null ? [] : legal.filter((m) => m.from === sel)),
    [legal, sel]
  );
  const lastMove = moves.length > 0 ? moves[moves.length - 1] : null;
  const instances = usePieceInstances(moves);
  const hist = useMemo(
    () =>
      states.map((state, i) => ({
        state,
        move: i === 0 ? null : moves[i - 1],
      })),
    [states, moves]
  );

  /* ---------------- realtime + polling ---------------- */
  useEffect(() => {
    finishGuard.current = false;
    seenReactionIds.current = new Set();
    reactionsPrimed.current = false;
    let dead = false;
    const ch = subscribeMatch(
      match.id,
      (m) => {
        if (!dead) onMatchChange(m);
      },
      {
        userId,
        onPresence: (n) => {
          if (!dead) setWatchers(n);
        },
      }
    );
    const refresh = async () => {
      try {
        const m = await getMatchById(match.id);
        if (!dead && m) onMatchChange(m);
        if (!guest) {
          const cmts = await fetchComments(roomId).catch(
            () => [] as RoomComment[]
          );
          if (dead) return;
          setComments(cmts.filter((c) => c.match_id === match.id));
          const names = await fetchNames(
            cmts.map((c) => c.user_id)
          ).catch(() => ({}));
          if (!dead) setCommentNames(names);
        }
        // Reaction floaters, polling fallback (realtime is primary in
        // production; this also covers environments without a realtime
        // socket). The first fetch only primes the seen-set so joining a
        // match doesn't burst old reactions over the board.
        const reacts = await fetchReactions(match.id).catch(() => []);
        if (dead) return;
        for (const r of reacts) {
          if (seenReactionIds.current.has(r.id)) continue;
          seenReactionIds.current.add(r.id);
          if (reactionsPrimed.current) spawnFloater(r.emoji);
        }
        reactionsPrimed.current = true;
      } catch {
        /* polling is best-effort */
      }
    };
    const t = setInterval(refresh, 4000);
    void refresh();
    return () => {
      dead = true;
      clearInterval(t);
      try {
        createClient().removeChannel(ch);
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  /* ---------------- reaction floaters (PacClone pattern) ----------------
   * Floaters render INSIDE the board container and rise over the board;
   * the bar lives in the actions row under the board — never in the side
   * panel. Sends are throttled; the sender sees their own floater via the
   * realtime echo. */
  const [floaters, setFloaters] = useState<
    Array<{ id: number; emoji: string; x: number }>
  >([]);
  const floaterId = useRef(0);
  const lastReactRef = useRef(0);
  const seenReactionIds = useRef<Set<string>>(new Set());
  const reactionsPrimed = useRef(false);
  const spawnFloater = (emoji: string) => {
    const id = ++floaterId.current;
    const x = 8 + Math.random() * 76; // % across the board
    setFloaters((f) => [...f.slice(-11), { id, emoji, x }]);
    window.setTimeout(
      () => setFloaters((f) => f.filter((fl) => fl.id !== id)),
      2200
    );
  };
  useEffect(() => {
    const ch = subscribeReactions(match.id, (emoji, rowId) => {
      // Dedup against the polling path below (both may deliver a row).
      if (rowId) {
        if (seenReactionIds.current.has(rowId)) return;
        seenReactionIds.current.add(rowId);
      }
      spawnFloater(emoji);
    });
    return () => {
      try {
        createClient().removeChannel(ch);
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  const doReact = (emoji: string) => {
    if (!userId || guest) return;
    const now = Date.now();
    if (now - lastReactRef.current < 1500) return; // throttle
    lastReactRef.current = now;
    react(match.id, emoji).catch(() => {});
  };

  // resign arm timeout
  useEffect(() => {
    if (!resignArmed && !cancelArmed) return;
    const t = setTimeout(() => {
      setResignArmed(false);
      setCancelArmed(false);
    }, 3500);
    return () => clearTimeout(t);
  }, [resignArmed, cancelArmed]);

  /* ---------------- finishing ---------------- */
  const doFinish = async (
    result: "red" | "green" | "draw",
    reason: string
  ) => {
    if (finishGuard.current) return;
    finishGuard.current = true;
    try {
      const xp: XpEarned | null = await finishRoomMatch(
        match.id,
        result,
        reason
      );
      if (xp) {
        const total = xp.play_xp + xp.host_xp + xp.daily_xp;
        if (total > 0) setXpToast(total);
        await refreshStats().catch(() => {});
      }
      const m = await getMatchById(match.id).catch(() => null);
      if (m) onMatchChange(m);
    } catch {
      finishGuard.current = false;
    }
  };

  // Mover-side game-over detection (idempotent on the server).
  useEffect(() => {
    if (
      match.status === "active" &&
      localStatus.outcome !== "ongoing" &&
      isPlayer &&
      !finishGuard.current
    ) {
      const r = localStatus;
      const result: "red" | "green" | "draw" =
        r.outcome === "draw" ? "draw" : r.winner === "r" ? "red" : "green";
      const reason = r.outcome === "draw" ? r.reason : r.reason;
      void doFinish(result, reason);
      if (r.outcome === "win") {
        if (r.winner === mySide) playWin();
        else playLose();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStatus, match.status, match.id]);

  // Checkmate celebration: a confetti burst for the winner, once per
  // match (Chess/PacClone pattern). Runs off the confirmed server
  // result, so it fires whether the finish was detected locally or
  // arrived via polling; losers and spectators don't get confetti.
  const celebratedMateRef = useRef<string | null>(null);
  const mateWinner: Side | null =
    final && final.outcome === "win" && final.reason === "checkmate"
      ? final.winner
      : null;
  useEffect(() => {
    if (match.status !== "finished" || mateWinner === null) return;
    if (mateWinner !== mySide) return;
    if (celebratedMateRef.current === match.id) return;
    celebratedMateRef.current = match.id;
    const t = window.setTimeout(() => burstConfetti(), 450);
    return () => window.clearTimeout(t);
  }, [match.status, match.id, mateWinner, mySide]);

  /* ---------------- moves ---------------- */
  const doMove = (move: Move) => {
    if (!cur || !isPlayer || mySide !== cur.turn) return;
    const label = moveLabel(cur, move);
    const after = applyMove(cur, move);
    const newLabels = [...labels, label];
    setPendingLabels(newLabels);
    setSel(null);
    if (move.capture) {
      flashKey.current += 1;
      setFlash({ sq: move.to, key: flashKey.current });
      playCapture();
    } else {
      playMove();
    }
    const st = gameStatus(after);
    if (st.outcome === "ongoing" && isGeneralThreatened(after, after.turn)) {
      playCheck();
    }
    pushMove(match.id, newLabels).catch(() => {
      // Revert the optimistic update on DB failure.
      setPendingLabels(null);
    });
    // Phase 2C hook: notify the opponent it's their turn (no-op in 2B).
    const oppId = mySide === "r" ? match.green_id : match.red_id;
    if (oppId) void fireEvent("turn", { to: oppId, match: match.id });
  };

  const onPoint = (i: number) => {
    if (!playing || !cur || !isPlayer || mySide !== cur.turn) return;
    if (sel !== null) {
      const m = legal.find((x) => x.from === sel && x.to === i);
      if (m) {
        doMove(m);
        return;
      }
    }
    if (mySide && owns(cur.cells[i], mySide)) {
      if (sel === i) setSel(null);
      else {
        setSel(i);
        playSelect();
      }
    } else {
      setSel(null);
    }
  };

  const onResign = () => {
    if (!resignArmed) {
      setResignArmed(true);
      return;
    }
    setResignArmed(false);
    if (!mySide) return;
    const result = mySide === "r" ? "green" : "red";
    void doFinish(result, "resign");
  };

  const onCancel = () => {
    if (!cancelArmed) {
      setCancelArmed(true);
      return;
    }
    setCancelArmed(false);
    cancelMatch(match.id)
      .then(() => getMatchById(match.id))
      .then((m) => {
        if (m) onMatchChange(m);
      })
      .catch(() => {});
  };

  const onRematch = async () => {
    try {
      const m = await startRematch(roomId);
      onMatchChange(m);
    } catch {
      /* surface stays on the finished match */
    }
  };

  const shareResult = () => {
    if (!final) return;
    const outcome =
      final.outcome === "draw"
        ? String(s.roomDraw)
        : final.winner === "r"
          ? String(s.roomRedWins)
          : String(s.roomGreenWins);
    const text =
      `${String(s.appName)} — ${names.red} vs ${names.green}: ${outcome} ` +
      `(${reasonText(s, final)}, ${labels.length} ${lang === "vi" ? "nước" : "plies"})`;
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      })
      .catch(() => {});
  };

  const sendComment = () => {
    const body = commentBody.trim();
    if (!body) return;
    setCommentBody("");
    postComment(roomId, match.id, body, labels.length)
      .then(() => fetchComments(roomId))
      .then((cmts) => {
        setComments(cmts.filter((c) => c.match_id === match.id));
        return fetchNames(cmts.map((c) => c.user_id)).catch(() => ({}));
      })
      .then(setCommentNames)
      .catch(() => {});
  };

  if (!cur) {
    return (
      <div className="cct-panel">
        <p className="cct-hint">{String(s.roomErrGeneric)}</p>
      </div>
    );
  }

  const turnName = cur.turn === "r" ? names.red : names.green;
  const watcherCount =
    isPlayer && mySide ? Math.max(0, watchers - 2) : watchers;

  return (
    <div className="cct-layout">
      <div className="cct-board-col">
      <div className="cct-board-area">
        <div className="cct-board-fit">
          <Board
            state={cur}
            interactive={playing && isPlayer && mySide === cur.turn}
            flipped={mySide === "g"}
            sel={sel}
            targets={targets}
            lastMove={lastMove}
            threatened={threatened}
            captureFlash={flash}
            instances={instances}
            onPoint={onPoint}
          />
          {floaters.map((f) => (
            <span
              key={f.id}
              className="cct-reaction-float"
              style={{ left: `${f.x}%` }}
              aria-hidden="true"
            >
              {f.emoji}
            </span>
          ))}
        </div>
      </div>
      {match.status === "active" && !final && (
        <div className="cct-room-match-actions">
          {!guest && userId ? (
            <div
              className="cct-reaction-bar"
              role="group"
              aria-label={lang === "vi" ? "Thả biểu tượng" : "React"}
            >
              {REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="cct-reaction-btn"
                  onClick={() => doReact(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          ) : guest && onRequireLogin ? (
            <button type="button" className="cct-btn small" onClick={onRequireLogin}>
              👏🔥 {String(s.guestReactTeaser)}
            </button>
          ) : null}
          {playing && isPlayer && (
            <button
              className={`cct-btn small${resignArmed ? " cct-btn-danger" : ""}`}
              onClick={onResign}
            >
              {resignArmed ? String(s.roomResignConfirm) : String(s.roomResign)}
            </button>
          )}
          {isLeader && (
            <button
              className={`cct-btn small${cancelArmed ? " cct-btn-danger" : ""}`}
              onClick={onCancel}
            >
              {cancelArmed
                ? String(s.roomCancelConfirm)
                : String(s.roomCancelMatch)}
            </button>
          )}
          <button className="cct-btn small" onClick={onExit}>
            {String(s.roomBackToRoom)}
          </button>
        </div>
      )}
      </div>
      <div className="cct-panel">
        <div className="cct-vs-header">
          <span className="cct-vs-side red">
            🔴 {names.red}
            {mySide === "r" && !guest && ` (${String(s.you)})`}
          </span>
          <span className="cct-vs-mid">⚔️</span>
          <span className="cct-vs-side green">
            🟢 {names.green}
            {mySide === "g" && !guest && ` (${String(s.you)})`}
          </span>
        </div>

        {final ? (
          <div className="cct-gameover">
            <div className="cct-result">
              {match.status === "cancelled"
                ? String(s.roomReasonCancelled)
                : final.outcome === "draw"
                  ? String(s.roomDraw)
                  : final.winner === "r"
                    ? String(s.roomRedWins)
                    : String(s.roomGreenWins)}
            </div>
            <div className="cct-reason">
              {match.status === "cancelled" ? "" : reasonText(s, final)}
            </div>
            {final.outcome === "win" && match.status !== "cancelled" && (
              <div className="cct-hint">
                {final.winner === "r" ? names.red : names.green}
              </div>
            )}
            {xpToast !== null && xpToast > 0 && (
              <div className="cct-xp-toast">
                {String(s.roomXpEarned).replace("{n}", String(xpToast))}
              </div>
            )}
            <div className="cct-actions">
              <button className="cct-btn" onClick={shareResult}>
                {shared ? String(s.roomShared) : String(s.roomShare)}
              </button>
              {isPlayer && match.status !== "active" && (
                <button
                  className="cct-btn cct-btn-primary"
                  onClick={onRematch}
                >
                  {String(s.roomRematch)}
                </button>
              )}
              <button className="cct-btn" onClick={onExit}>
                {String(s.roomBackToRoom)}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={`cct-status${threatened ? " check" : ""}`}>
              <span
                className="cct-turn-dot"
                style={{
                  background: cur.turn === "r" ? "#B3242F" : "#1C6B4C",
                }}
              />
              <span>
                {guest
                  ? String(s.roomSpectating)
                  : isPlayer && mySide === cur.turn
                    ? String(s.roomYourTurn)
                    : String(s.roomTurnOf).replace("{name}", turnName)}
                {threatened ? ` • ${String(s.check)}` : ""}
              </span>
              <span className="cct-hint">
                {String(s.roomWatchers).replace(
                  "{n}",
                  String(watcherCount)
                )}
              </span>
            </div>
            {guest && (
              <div className="cct-guest-banner">
                {String(s.guestSpectateBanner)}
              </div>
            )}
          </>
        )}

        <CapturedRow s={s} cur={cur} />
        <MoveLog s={s} hist={hist} />

        <div className="cct-panel">
          <h3>{String(s.roomComments)}</h3>
          {guest ? (
            <p className="cct-hint">{String(s.guestCommentTeaser)}</p>
          ) : (
            <div className="cct-comment-form">
              <input
                className="cct-input"
                value={commentBody}
                maxLength={500}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder={String(s.roomWriteComment)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendComment();
                }}
              />
              <button className="cct-btn small" onClick={sendComment}>
                {String(s.roomSend)}
              </button>
            </div>
          )}
          <ul className="cct-comment-list">
            {comments.map((c) => (
              <li key={c.id} className="cct-comment">
                <div className="cct-comment-head">
                  <strong>{commentNames[c.user_id] ?? "…"}</strong>
                  <span className="cct-hint">
                    {lang === "vi" ? "nước" : "move"} {c.move_number}
                  </span>
                </div>
                <div>{c.body}</div>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}
