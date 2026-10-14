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
  createCorrGame,
  fetchMyCorrGames,
  finishCorrGame,
  getCorrGame,
  pushCorrMoves,
  subscribeCorrGame,
  type CorrGame,
} from "@/lib/supabase/corr";
import { fetchNames } from "@/lib/supabase/rooms";
import { listFriends, type Friend } from "@/lib/supabase/friends";
import { reasonText, MoveLog, CapturedRow } from "./PlayView";
import {
  playCapture,
  playCheck,
  playLose,
  playMove,
  playSelect,
  playWin,
} from "@/lib/cct/sound";
import { STR, type Lang } from "@/lib/cct/i18n";

interface Props {
  lang: Lang;
  userId: string | null;
  onLogin: () => void;
  deepLinkGameId?: string | null;
}

const owns = (cell: number, side: Side): boolean =>
  side === "r" ? cell === 1 || cell === 2 : cell === 3 || cell === 4;

function fmtDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US");
}

export default function CorrView({
  lang,
  userId,
  onLogin,
  deepLinkGameId,
}: Props) {
  const s = STR[lang] as Record<string, string | string[]>;
  const [games, setGames] = useState<CorrGame[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(deepLinkGameId ?? null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const gs = await fetchMyCorrGames();
      setGames(gs);
      const ids = new Set<string>();
      for (const g of gs) {
        ids.add(g.red_id);
        ids.add(g.green_id);
      }
      const n = await fetchNames([...ids]).catch(() => ({}));
      setNames(n);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (deepLinkGameId) setOpenId(deepLinkGameId);
  }, [deepLinkGameId]);

  if (!userId) {
    return (
      <div className="cct-scroll-area">
        <div className="cct-view">
          <h2>{String(s.corrTitle)}</h2>
          <div className="cct-panel">
            <p className="cct-hint">{String(s.corrLoginTeaser)}</p>
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

  if (openId) {
    return (
      <CorrGameScreen
        gameId={openId}
        lang={lang}
        userId={userId}
        names={names}
        onBack={() => {
          setOpenId(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="cct-scroll-area">
      <div className="cct-view">
        <h2>{String(s.corrTitle)}</h2>
        <div className="cct-actions">
          <button
            type="button"
            className="cct-btn cct-btn-primary"
            onClick={() => setShowNew((v) => !v)}
          >
            {String(s.corrNew)}
          </button>
        </div>
        {showNew && (
          <NewCorrGame
            lang={lang}
            userId={userId}
            onCreated={(g) => {
              setShowNew(false);
              setOpenId(g.id);
              void load();
            }}
          />
        )}
        {loading ? (
          <p className="cct-empty-note">…</p>
        ) : games.length === 0 ? (
          <p className="cct-empty-note">{String(s.corrEmpty)}</p>
        ) : (
          <ul className="cct-board-list">
            {games.map((g) => (
              <CorrGameRow
                key={g.id}
                game={g}
                lang={lang}
                userId={userId}
                names={names}
                onOpen={() => setOpenId(g.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CorrGameRow({
  game,
  lang,
  userId,
  names,
  onOpen,
}: {
  game: CorrGame;
  lang: Lang;
  userId: string;
  names: Record<string, string>;
  onOpen: () => void;
}) {
  const s = STR[lang] as Record<string, string | string[]>;
  const mySide = mySideInMatch(userId, game.red_id, game.green_id);
  const oppId = mySide === "r" ? game.green_id : game.red_id;
  let turn: Side = "r";
  try {
    turn = replayMatch(game.start_pos, game.moves).cur.turn;
  } catch {
    /* ignore */
  }
  const myTurn =
    game.status === "active" && mySide !== null && mySide === turn;
  return (
    <li>
      <button type="button" className="cct-room-row-btn" onClick={onOpen}>
        <span className="cct-lb-name">
          {game.status === "active" && myTurn && (
            <span className="cct-live-badge">{String(s.corrYourMove)}</span>
          )}{" "}
          ⚔️ {names[oppId] ?? "…"}
        </span>
        <span className="cct-hint">
          {game.status === "active"
            ? String(s.corrActive)
            : String(s.corrFinished)}{" "}
          · {fmtDate(game.updated_at, lang)}
        </span>
      </button>
    </li>
  );
}

function NewCorrGame({
  lang,
  userId,
  onCreated,
}: {
  lang: Lang;
  userId: string;
  onCreated: (g: CorrGame) => void;
}) {
  const s = STR[lang] as Record<string, string | string[]>;
  const [friends, setFriends] = useState<Friend[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    listFriends(userId)
      .then(setFriends)
      .catch(() => {});
  }, [userId]);
  const start = async (f: Friend) => {
    setBusy(true);
    try {
      const g = await createCorrGame(f.user_id);
      onCreated(g);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cct-panel">
      <h3>{String(s.corrPickFriend)}</h3>
      {friends.length === 0 ? (
        <p className="cct-empty-note">{String(s.corrNoFriends)}</p>
      ) : (
        <ul className="cct-board-list">
          {friends.map((f) => (
            <li key={f.user_id} className="cct-lb-row">
              <span className="cct-lb-name">{f.name}</span>
              <button
                type="button"
                className="cct-btn small cct-btn-primary"
                disabled={busy}
                onClick={() => void start(f)}
              >
                ▶
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================ game screen ============================ */

function CorrGameScreen({
  gameId,
  lang,
  userId,
  names,
  onBack,
}: {
  gameId: string;
  lang: Lang;
  userId: string;
  names: Record<string, string>;
  onBack: () => void;
}) {
  const s = STR[lang] as Record<string, string | string[]>;
  const [game, setGame] = useState<CorrGame | null>(null);
  const [pendingLabels, setPendingLabels] = useState<string[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ sq: number; key: number } | null>(null);
  const [resignArmed, setResignArmed] = useState(false);
  const flashKey = useRef(0);
  const finishGuard = useRef(false);

  useEffect(() => {
    let dead = false;
    getCorrGame(gameId)
      .then((g) => {
        if (!dead) setGame(g);
      })
      .catch(() => {});
    const ch = subscribeCorrGame(gameId, (g) => {
      if (!dead) setGame(g);
    });
    const t = setInterval(async () => {
      try {
        const g = await getCorrGame(gameId);
        if (!dead && g) setGame(g);
      } catch {
        /* best-effort */
      }
    }, 4000);
    return () => {
      dead = true;
      clearInterval(t);
      try {
        ch.unsubscribe();
      } catch {
        /* ignore */
      }
    };
  }, [gameId]);

  useEffect(() => {
    if (!resignArmed) return;
    const t = setTimeout(() => setResignArmed(false), 3500);
    return () => clearTimeout(t);
  }, [resignArmed]);

  const labels = pendingLabels ?? game?.moves ?? [];
  useEffect(() => {
    if (pendingLabels && game && game.moves.length >= pendingLabels.length) {
      setPendingLabels(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.moves.length, gameId]);

  const replay = useMemo(() => {
    if (!game) return null;
    try {
      return replayMatch(game.start_pos, labels);
    } catch {
      return null;
    }
  }, [game, labels]);

  const cur: CctState | null = replay?.cur ?? null;
  const moves = replay?.moves ?? [];
  const states = replay?.states ?? [];
  const localStatus: GameResult = useMemo(
    () => (cur ? gameStatus(cur) : { outcome: "ongoing" }),
    [cur]
  );
  // Server result wins for display: a resign doesn't change the board,
  // so the board-derived status would show the wrong winner.
  type Terminal = Extract<GameResult, { outcome: "win" | "draw" }>;
  const serverResult: Terminal | null =
    game && game.status === "finished" && game.result
      ? ((game.result === "draw"
          ? { outcome: "draw", reason: game.reason ?? "agreement" }
          : {
              outcome: "win",
              winner: game.result === "red" ? "r" : "g",
              reason: game.reason ?? "resign",
            }) as Terminal)
      : null;
  const final: Terminal | null =
    serverResult ?? (localStatus.outcome === "ongoing" ? null : localStatus);
  const playing =
    !!game && game.status === "active" && localStatus.outcome === "ongoing" && !!cur;

  const mySide = game ? mySideInMatch(userId, game.red_id, game.green_id) : null;
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

  const doFinish = async (
    result: "red" | "green" | "draw",
    reason: string
  ) => {
    if (finishGuard.current) return;
    finishGuard.current = true;
    try {
      await finishCorrGame(gameId, result, reason);
      const g = await getCorrGame(gameId).catch(() => null);
      if (g) setGame(g);
    } catch {
      finishGuard.current = false;
    }
  };

  // Mover-side game-over detection (idempotent on the server).
  useEffect(() => {
    if (
      game &&
      game.status === "active" &&
      localStatus.outcome !== "ongoing" &&
      mySide &&
      !finishGuard.current
    ) {
      const r = localStatus;
      const result: "red" | "green" | "draw" =
        r.outcome === "draw" ? "draw" : r.winner === "r" ? "red" : "green";
      void doFinish(result, r.outcome === "draw" ? r.reason : r.reason);
      if (r.outcome === "win") {
        if (r.winner === mySide) playWin();
        else playLose();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStatus, game?.status, gameId]);

  const doMove = (move: Move) => {
    if (!cur || !mySide || mySide !== cur.turn) return;
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
    pushCorrMoves(gameId, newLabels).catch(() => setPendingLabels(null));
    // Phase 2C hook: notify the opponent it's their turn (no-op in 2B).
    if (game) {
      const oppId = mySide === "r" ? game.green_id : game.red_id;
      if (oppId) void fireEvent("corr", { to: oppId, game: gameId });
    }
  };

  const onPoint = (i: number) => {
    if (!playing || !cur || !mySide || mySide !== cur.turn) return;
    if (sel !== null) {
      const m = legal.find((x) => x.from === sel && x.to === i);
      if (m) {
        doMove(m);
        return;
      }
    }
    if (owns(cur.cells[i], mySide)) {
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
    void doFinish(mySide === "r" ? "green" : "red", "resign");
  };

  if (!game || !cur) {
    return (
      <div className="cct-scroll-area">
        <div className="cct-view">
          <button type="button" className="cct-btn small" onClick={onBack}>
            {String(s.corrBackToList)}
          </button>
          <p className="cct-empty-note">…</p>
        </div>
      </div>
    );
  }

  const redName = names[game.red_id] ?? String(s.red);
  const greenName = names[game.green_id] ?? String(s.green);
  const turnName = cur.turn === "r" ? redName : greenName;

  // Full-bleed layout (direct child of .cct-page, like PlayView) so the
  // board's aspect-locked sizing gets a definite height.
  return (
    <>
      <div className="cct-backbar">
        <button type="button" className="cct-btn small" onClick={onBack}>
          {String(s.corrBackToList)}
        </button>
      </div>
      <div className="cct-layout">
        <div className="cct-board-area">
          <div className="cct-board-fit">
            <Board
              state={cur}
              interactive={playing && mySide === cur.turn}
              flipped={mySide === "g"}
              sel={sel}
              targets={targets}
              lastMove={lastMove}
              threatened={threatened}
              captureFlash={flash}
              instances={instances}
              onPoint={onPoint}
            />
          </div>
        </div>
        <div className="cct-panel">
            <div className="cct-vs-header">
              <span className="cct-vs-side red">🔴 {redName}</span>
              <span className="cct-vs-mid">⚔️</span>
              <span className="cct-vs-side green">🟢 {greenName}</span>
            </div>

            {final ? (
              <div className="cct-gameover">
                <div className="cct-result">
                  {final.outcome === "draw"
                    ? String(s.draw)
                    : final.winner === "r"
                      ? String(s.redWins)
                      : String(s.greenWins)}
                </div>
                <div className="cct-reason">{reasonText(s, final)}</div>
                <button
                  className="cct-btn cct-btn-primary"
                  onClick={onBack}
                >
                  {String(s.corrBackToList)}
                </button>
              </div>
            ) : (
              <div className={`cct-status${threatened ? " check" : ""}`}>
                <span
                  className="cct-turn-dot"
                  style={{
                    background: cur.turn === "r" ? "#B3242F" : "#1C6B4C",
                  }}
                />
                <span>
                  {mySide === cur.turn
                    ? String(s.corrYourMove)
                    : String(s.roomTurnOf).replace("{name}", turnName)}
                  {threatened ? ` • ${String(s.check)}` : ""}
                </span>
              </div>
            )}

            <CapturedRow s={s} cur={cur} />
            <MoveLog s={s} hist={hist} />

            {playing && (
              <div className="cct-actions">
                <button
                  className={`cct-btn${resignArmed ? " cct-btn-danger" : ""}`}
                  onClick={onResign}
                >
                  {resignArmed
                    ? String(s.corrResignConfirm)
                    : String(s.corrResign)}
                </button>
              </div>
            )}
          </div>
      </div>
    </>
  );
}
