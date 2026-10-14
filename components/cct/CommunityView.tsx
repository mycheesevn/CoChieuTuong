"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Board from "./Board";
import { STR, levelName, type Lang } from "@/lib/cct/i18n";
import { canonMove, parseCanonMove } from "@/lib/cct/canon";
import {
  applyMove,
  gameStatus,
  isGeneralThreatened,
  legalMoves,
  posToState,
  type CctState,
  type Move,
  type Side,
} from "@/lib/cct/engine";
import { playCapture, playCheck, playMove, playSelect, playWin } from "@/lib/cct/sound";
import {
  fetchPuzzleCards,
  publishPuzzle,
  recordPuzzleSolve,
  togglePuzzleLike,
  type CommunityPuzzleCard,
  type PuzzleSort,
} from "@/lib/supabase/communityPuzzles";
import { Pagination } from "./Pagination";

const PAGE_SIZE = 10;

interface Props {
  lang: Lang;
  level: number;
  onLevelChange: (n: number) => void;
  userId: string | null;
  onLogin: () => void;
  onPracticeVsAi: (pos: string, turn: Side) => void;
  /** Prefilled from the Setup editor ("publish as puzzle"). */
  pendingCreate?: { pos: string; turn: Side } | null;
  onConsumePendingCreate?: () => void;
}

type SubView =
  | { name: "list" }
  | { name: "create" }
  | { name: "play"; card: CommunityPuzzleCard };

const belongsTo = (cell: number, side: Side): boolean =>
  side === "r" ? cell === 1 || cell === 2 : cell === 3 || cell === 4;

export function CommunityView({
  lang,
  level,
  onLevelChange,
  userId,
  onLogin,
  onPracticeVsAi,
  pendingCreate,
  onConsumePendingCreate,
}: Props) {
  const s = STR[lang] as Record<string, string | string[]>;
  const [sub, setSub] = useState<SubView>({ name: "list" });
  const [sort, setSort] = useState<PuzzleSort>("new");
  const [page, setPage] = useState(0);
  const [cards, setCards] = useState<CommunityPuzzleCard[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  // Prefill captured before pendingCreate is consumed (props null on next render).
  const [prefill, setPrefill] = useState<{ pos: string; turn: Side } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchPuzzleCards(sort, PAGE_SIZE, page * PAGE_SIZE);
      setCards(rows);
      setHasMore(rows.length >= PAGE_SIZE);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Open the create view prefilled when arriving from the Setup editor.
  useEffect(() => {
    if (pendingCreate) {
      setPrefill(pendingCreate);
      setSub({ name: "create" });
      onConsumePendingCreate?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCreate]);

  const pageCount = hasMore ? page + 2 : Math.max(1, page + 1);

  if (sub.name === "play") {
    return (
      <PuzzlePlay
        lang={lang}
        level={level}
        onLevelChange={onLevelChange}
        card={sub.card}
        onBack={() => setSub({ name: "list" })}
        onPracticeVsAi={onPracticeVsAi}
        onLiked={(liked, likes) => {
          setCards((cs) =>
            cs.map((c) =>
              c.id === sub.card.id ? { ...c, liked_by_me: liked, likes } : c
            )
          );
        }}
      />
    );
  }

  if (sub.name === "create") {
    if (!userId) {
      return (
        <div className="cct-scroll-area">
          <div className="cct-view">
            <div className="cct-panel">
              <p className="cct-hint">{String(s.puzzleLoginTeaser)}</p>
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
    return (
      <PuzzleCreate
        lang={lang}
        initialPos={prefill?.pos ?? ""}
        initialTurn={prefill?.turn ?? "r"}
        onBack={() => setSub({ name: "list" })}
        onPublished={() => {
          setPage(0);
          setSort("new");
          setSub({ name: "list" });
          load();
        }}
      />
    );
  }

  return (
    <div className="cct-scroll-area">
      <div className="cct-view">
        <h2>{String(s.puzzleCommunity)}</h2>
        <div className="cct-tabs" role="tablist">
          <button
            data-active={sort === "new"}
            onClick={() => { setSort("new"); setPage(0); }}
          >
            {String(s.puzzleNewest)}
          </button>
          <button
            data-active={sort === "popular"}
            onClick={() => { setSort("popular"); setPage(0); }}
          >
            {String(s.puzzlePopular)}
          </button>
          {userId && (
            <button
              data-active={sort === "mine"}
              onClick={() => { setSort("mine"); setPage(0); }}
            >
              {String(s.puzzleMine)}
            </button>
          )}
        </div>
        {userId && (
          <button
            type="button"
            className="cct-btn cct-btn-primary"
            onClick={() => { setPrefill(null); setSub({ name: "create" }); }}
            style={{ marginBottom: 8 }}
          >
            {String(s.puzzleNew)}
          </button>
        )}
        {loading ? (
          <p className="cct-empty-note">{String(s.loading)}</p>
        ) : cards.length === 0 ? (
          <p className="cct-empty-note">{String(s.puzzleNoPuzzles)}</p>
        ) : (
          <>
            <ul className="cct-board-list">
              {cards.map((c) => (
                <li key={c.id} className="cct-lb-row">
                  <span className="cct-lb-name" style={{ flex: 1 }}>
                    <strong>{c.title}</strong>
                    <br />
                    <span className="cct-hint">
                      {c.creator_name} · ✅ {c.solves} {String(s.puzzleSolves)} · ❤️{" "}
                      {c.likes} {String(s.puzzleLikes)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="cct-btn small"
                    onClick={() => setSub({ name: "play", card: c })}
                  >
                    {String(s.puzzlePlay)}
                  </button>
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              pageCount={pageCount}
              onPage={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** Solve a community puzzle (guided line) or practice it vs the AI. */
function PuzzlePlay({
  lang,
  level,
  onLevelChange,
  card,
  onBack,
  onPracticeVsAi,
  onLiked,
}: {
  lang: Lang;
  level: number;
  onLevelChange: (n: number) => void;
  card: CommunityPuzzleCard;
  onBack: () => void;
  onPracticeVsAi: (pos: string, turn: Side) => void;
  onLiked: (liked: boolean, likes: number) => void;
}) {
  const s = STR[lang] as Record<string, string | string[]>;
  const [state, setState] = useState<CctState>(() => {
    const st = posToState(card.pos, card.turn);
    if (!st) throw new Error(`invalid puzzle pos ${card.id}`);
    return st;
  });
  const [sel, setSel] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState<"bad" | null>(null);
  const [pliesDone, setPliesDone] = useState(0);
  const [liked, setLiked] = useState(card.liked_by_me);
  const [likes, setLikes] = useState(card.likes);

  const solver = card.turn;
  const solMoves = useMemo(
    () => card.solution.map(parseCanonMove).filter((m) => m !== null),
    [card]
  );
  const moves = useMemo(() => (solved ? [] : legalMoves(state)), [state, solved]);
  const threatened: Side | null =
    !solved && isGeneralThreatened(state, state.turn) ? state.turn : null;
  const targets = useMemo(
    () => (sel === null ? [] : moves.filter((m) => m.from === sel)),
    [moves, sel]
  );
  const instances = useMemo(() => {
    const m = new Map<number, number>();
    for (let i = 0; i < 25; i++) if (state.cells[i] !== 0) m.set(i, i);
    return m;
  }, [state]);

  const doMove = (move: Move) => {
    const after = applyMove(state, move);
    if (move.capture) playCapture();
    else playMove();
    const gs = gameStatus(after);
    if (gs.outcome === "ongoing" && isGeneralThreatened(after, after.turn)) {
      playCheck();
    }
    const expected = solMoves[pliesDone];
    if (expected && move.from === expected.from && move.to === expected.to) {
      const nextPlies = pliesDone + 1;
      if (nextPlies >= solMoves.length) {
        if (gs.outcome === "win" && gs.winner === solver) {
          setState(after);
          setSolved(true);
          playWin();
          void recordPuzzleSolve(card.id);
        } else {
          setState(after);
        }
        return;
      }
      setState(after);
      setPliesDone(nextPlies);
      setSel(null);
      // Auto-play the scripted reply.
      const reply = solMoves[nextPlies];
      if (reply) {
        setTimeout(() => {
          const legal = legalMoves(after);
          const rm = legal.find((x) => x.from === reply.from && x.to === reply.to);
          if (rm) {
            const afterReply = applyMove(after, rm);
            setState(afterReply);
            setPliesDone(nextPlies + 1);
            if (rm.capture) playCapture();
            else playMove();
          }
        }, 600);
      }
    } else {
      setFeedback("bad");
      playSelect();
      setTimeout(() => setFeedback(null), 900);
    }
  };

  const onPoint = (i: number) => {
    if (solved) return;
    if (state.turn !== solver) return;
    if (sel !== null) {
      const m = moves.find((x) => x.from === sel && x.to === i);
      if (m) {
        doMove(m);
        return;
      }
    }
    if (belongsTo(state.cells[i], state.turn)) {
      setSel(sel === i ? null : i);
      playSelect();
      setFeedback(null);
    } else {
      setSel(null);
    }
  };

  const like = async () => {
    const res = await togglePuzzleLike(card.id);
    if (res === null) return;
    setLiked(res);
    const next = likes + (res ? 1 : -1);
    setLikes(next);
    onLiked(res, next);
  };

  return (
    <div className="cct-scroll-area">
      <div className="cct-view">
        <button type="button" className="cct-btn small" onClick={onBack}>
          ← {String(s.puzzleCommunity)}
        </button>
        <h2>{card.title}</h2>
        <p className="cct-hint">
          {card.creator_name} · ✅ {card.solves} {String(s.puzzleSolves)}
        </p>
        <label className="cct-field">
          {String(s.level)}
          <select
            className="cct-select"
            value={level}
            onChange={(e) => onLevelChange(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((l) => (
              <option key={l} value={l}>
                {levelName(lang, l)}
              </option>
            ))}
          </select>
        </label>
        <div className="cct-board-area">
          <div className="cct-board-fit">
            <Board
              state={state}
              interactive={!solved && state.turn === solver}
              sel={sel}
              targets={targets}
              lastMove={null}
              threatened={threatened}
              captureFlash={null}
              instances={instances}
              onPoint={onPoint}
            />
          </div>
        </div>
        <div className="cct-panel" style={{ marginTop: 8 }}>
          {!solved && (
            <>
              <p style={{ fontWeight: 600 }}>{String(s.puzzleYourMove)}</p>
              {feedback === "bad" && (
                <p className="cct-lib-feedback bad">✗ {String(s.puzzleWrong)}</p>
              )}
            </>
          )}
          {solved && <p style={{ fontWeight: 700 }}>{String(s.puzzleSolved)}</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button type="button" className="cct-btn small" onClick={like}>
              {liked ? "❤️" : "🤍"} {likes}
            </button>
            <button
              type="button"
              className="cct-btn small"
              onClick={() => onPracticeVsAi(card.pos, card.turn)}
            >
              🤖 {lang === "vi" ? "Đấu với máy" : "Play vs AI"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Create a puzzle: title + position, then record the mating line on the board. */
function PuzzleCreate({
  lang,
  initialPos,
  initialTurn,
  onBack,
  onPublished,
}: {
  lang: Lang;
  initialPos: string;
  initialTurn: Side;
  onBack: () => void;
  onPublished: () => void;
}) {
  const s = STR[lang] as Record<string, string | string[]>;
  const [title, setTitle] = useState("");
  const [pos, setPos] = useState(initialPos);
  const [turn, setTurn] = useState<Side>(initialTurn);
  const [moves, setMoves] = useState<Move[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);

  const start = useMemo(() => posToState(pos.trim(), turn), [pos, turn]);
  const state = useMemo(() => {
    if (!start) return null;
    let st = start;
    for (const m of moves) {
      const legal = legalMoves(st);
      const found = legal.find((x) => x.from === m.from && x.to === m.to);
      if (!found) return null;
      st = applyMove(st, found);
    }
    return st;
  }, [start, moves]);

  const legal = useMemo(() => (state ? legalMoves(state) : []), [state]);
  const targets = useMemo(
    () => (sel === null ? [] : legal.filter((m) => m.from === sel)),
    [legal, sel]
  );
  const instances = useMemo(() => {
    const m = new Map<number, number>();
    if (state) for (let i = 0; i < 25; i++) if (state.cells[i] !== 0) m.set(i, i);
    return m;
  }, [state]);

  const onPoint = (i: number) => {
    if (!state) return;
    if (sel !== null) {
      const m = legal.find((x) => x.from === sel && x.to === i);
      if (m) {
        setMoves((ms) => [...ms, { from: m.from, to: m.to } as Move]);
        setSel(null);
        if (m.capture) playCapture();
        else playMove();
        return;
      }
    }
    if (belongsTo(state.cells[i], state.turn)) {
      setSel(sel === i ? null : i);
      playSelect();
    } else {
      setSel(null);
    }
  };

  const undoMove = () => {
    setMoves((ms) => ms.slice(0, -1));
    setSel(null);
  };

  const publish = async () => {
    setError(null);
    const t = title.trim();
    if (!t) {
      setError(lang === "vi" ? "Nhập tiêu đề" : "Enter a title");
      return;
    }
    const st0 = posToState(pos.trim(), turn);
    if (!st0) {
      setError(String(s.puzzleInvalidPos));
      return;
    }
    if (moves.length === 0) {
      setError(lang === "vi" ? "Chưa ghi nước đi nào" : "No moves recorded");
      return;
    }
    // Replay + verify the line: every move legal, ends in solver checkmate.
    let st = st0;
    for (const m of moves) {
      const found = legalMoves(st).find((x) => x.from === m.from && x.to === m.to);
      if (!found) {
        setError(String(s.puzzleInvalidPos));
        return;
      }
      st = applyMove(st, found);
    }
    const gs = gameStatus(st);
    if (!(gs.outcome === "win" && gs.winner === turn)) {
      setError(
        lang === "vi"
          ? "Thế cờ phải kết thúc bằng chiếu hết cho bên đi — kiểm tra lại nước đi"
          : "The line must end in checkmate for the side to move"
      );
      return;
    }
    setPublishing(true);
    try {
      const id = await publishPuzzle({
        title: t,
        pos: pos.trim(),
        turn,
        solution: moves.map(canonMove),
      });
      if (!id) throw new Error("publish_failed");
      onPublished();
    } catch {
      setError(lang === "vi" ? "Đăng thất bại, thử lại" : "Publish failed, try again");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="cct-scroll-area">
      <div className="cct-view">
        <button type="button" className="cct-btn small" onClick={onBack}>
          ← {String(s.puzzleCommunity)}
        </button>
        <h2>{String(s.puzzleNew)}</h2>
        <label className="cct-form-field">
          {String(s.puzzleTitle)}
          <input
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={lang === "vi" ? "VD: Chiếu hết trong 2 nước" : "E.g. Mate in 2"}
          />
        </label>
        <label className="cct-form-field">
          {lang === "vi" ? "Thế cờ (25 ký tự)" : "Position (25 chars)"}
          <input
            value={pos}
            onChange={(e) => {
              setPos(e.target.value);
              setMoves([]);
              setSel(null);
            }}
            placeholder="3343333333000001111111211"
            inputMode="numeric"
          />
        </label>
        <label className="cct-form-field">
          {String(s.sideToMove)}
          <select value={turn} onChange={(e) => { setTurn(e.target.value as Side); setMoves([]); setSel(null); }}>
            <option value="r">{lang === "vi" ? "Đỏ đi" : "Red to move"}</option>
            <option value="g">{lang === "vi" ? "Xanh đi" : "Green to move"}</option>
          </select>
        </label>
        {!start && pos.trim() !== "" && (
          <p className="cct-error" role="alert">{String(s.puzzleInvalidPos)}</p>
        )}
        {state && (
          <>
            <p className="cct-hint">
              {lang === "vi"
                ? "Đi các nước chiếu hết trên bàn (cả hai bên) — nước cuối phải chiếu hết."
                : "Play the mating line on the board (both sides) — the last move must checkmate."}
            </p>
            <div className="cct-board-area">
              <div className="cct-board-fit">
                <Board
                  state={state}
                  interactive
                  sel={sel}
                  targets={targets}
                  lastMove={moves.length > 0 ? moves[moves.length - 1] : null}
                  threatened={null}
                  captureFlash={null}
                  instances={instances}
                  onPoint={onPoint}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="cct-btn small"
                disabled={moves.length === 0}
                onClick={undoMove}
              >
                {String(s.undo)}
              </button>
              <span className="cct-hint">
                {moves.length} {lang === "vi" ? "nước" : "moves"}
              </span>
            </div>
          </>
        )}
        {error && (
          <p className="cct-error" role="alert">
            {error}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            className="cct-btn cct-btn-primary"
            disabled={publishing}
            onClick={publish}
          >
            {String(s.puzzleCreate)}
          </button>
          <button type="button" className="cct-btn" onClick={onBack}>
            {String(s.puzzleCancel)}
          </button>
        </div>
      </div>
    </div>
  );
}
