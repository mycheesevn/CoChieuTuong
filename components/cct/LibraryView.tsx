"use client";

import { useEffect, useMemo, useState } from "react";
import Board from "./Board";
import { STR, type Lang } from "@/lib/cct/i18n";
import {
  LESSONS,
  type Chapter,
  type Lesson,
} from "@/lib/cct/lessons";
import {
  completeLesson,
  loadLocalDone,
  syncLibraryProgress,
} from "@/lib/supabase/libraryProgress";
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

type View =
  | { name: "home" }
  | { name: "chapter"; chapterId: string }
  | { name: "lesson"; lessonId: string };

/** "c,r-c,r" (1-based) → engine Move. */
function parseStepMove(s: string): { from: number; to: number } | null {
  const m = /^([1-5]),([1-5])-([1-5]),([1-5])$/.exec(s.trim());
  if (!m) return null;
  const c1 = Number(m[1]) - 1;
  const r1 = Number(m[2]) - 1;
  const c2 = Number(m[3]) - 1;
  const r2 = Number(m[4]) - 1;
  return { from: r1 * 5 + c1, to: r2 * 5 + c2 };
}

const belongsTo = (cell: number, side: Side): boolean =>
  side === "r" ? cell === 1 || cell === 2 : cell === 3 || cell === 4;

function findChapter(id: string): Chapter | undefined {
  return LESSONS.find((c) => c.id === id);
}
function findLesson(id: string): { ch: Chapter; lesson: Lesson } | undefined {
  for (const ch of LESSONS) {
    const lesson = ch.lessons.find((l) => l.id === id);
    if (lesson) return { ch, lesson };
  }
  return undefined;
}

export function LibraryView({ lang }: { lang: Lang }) {
  const s = STR[lang] as Record<string, string | string[]>;
  const [view, setView] = useState<View>({ name: "home" });
  const [done, setDone] = useState<Set<string>>(() => new Set(loadLocalDone()));

  useEffect(() => {
    let live = true;
    syncLibraryProgress().then((merged) => {
      if (live) setDone(new Set(merged));
    });
    return () => {
      live = true;
    };
  }, []);

  const markDone = async (lessonId: string) => {
    const merged = await completeLesson(lessonId);
    setDone(new Set(merged));
  };

  if (view.name === "lesson") {
    const found = findLesson(view.lessonId);
    if (!found) return null;
    return (
      <LessonPlayer
        key={found.lesson.id}
        lesson={found.lesson}
        lang={lang}
        alreadyDone={done.has(found.lesson.id)}
        onDone={markDone}
        onExit={() => setView({ name: "chapter", chapterId: found.ch.id })}
      />
    );
  }

  if (view.name === "chapter") {
    const ch = findChapter(view.chapterId);
    if (!ch) return null;
    const doneCount = ch.lessons.filter((l) => done.has(l.id)).length;
    return (
      <div className="cct-scroll-area">
        <div className="cct-view">
          <button
            type="button"
            className="cct-btn small"
            onClick={() => setView({ name: "home" })}
          >
            {String(s.bikipBack)}
          </button>
          <h2>
            {ch.icon} {ch.title[lang]}
          </h2>
          <p className="cct-hint">{ch.subtitle[lang]}</p>
          <p className="cct-lib-progress">
            {doneCount}/{ch.lessons.length}
          </p>
          <div className="cct-lib-chapter">
            {ch.lessons.map((l) => {
              const finished = done.has(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  className="cct-lib-card"
                  onClick={() => setView({ name: "lesson", lessonId: l.id })}
                >
                  <div className="cct-lib-row">
                    <span style={{ flex: 1, fontWeight: 600 }}>
                      {finished ? "✓ " : ""}
                      {l.title[lang]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const total = LESSONS.reduce((n, c) => n + c.lessons.length, 0);
  const doneTotal = LESSONS.reduce(
    (n, c) => n + c.lessons.filter((l) => done.has(l.id)).length,
    0
  );
  return (
    <div className="cct-scroll-area">
      <div className="cct-view">
        <h2>{String(s.bikip)}</h2>
        <p className="cct-hint">{String(s.bikipSubtitle)}</p>
        <p className="cct-lib-progress">
          {doneTotal}/{total} {String(s.bikipDone).replace("✓ ", "")}
        </p>
        <div className="cct-lib-home">
          {LESSONS.map((ch) => {
            const doneCount = ch.lessons.filter((l) => done.has(l.id)).length;
            return (
              <button
                key={ch.id}
                type="button"
                className="cct-lib-card"
                onClick={() => setView({ name: "chapter", chapterId: ch.id })}
              >
                <div className="cct-lib-row">
                  <span className="cct-lib-cicon">{ch.icon}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700 }}>{ch.title[lang]}</span>
                    <br />
                    <span className="cct-hint">{ch.subtitle[lang]}</span>
                  </span>
                  <span className="cct-lib-progress">
                    {doneCount}/{ch.lessons.length}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LessonPlayer({
  lesson,
  lang,
  alreadyDone,
  onDone,
  onExit,
}: {
  lesson: Lesson;
  lang: Lang;
  alreadyDone: boolean;
  onDone: (id: string) => void;
  onExit: () => void;
}) {
  const s = STR[lang] as Record<string, string | string[]>;
  const [stepIdx, setStepIdx] = useState(0); // next step to perform
  const [state, setState] = useState<CctState>(() => {
    const st = posToState(lesson.startPos, lesson.startTurn);
    if (!st) throw new Error(`invalid lesson startPos ${lesson.id}`);
    return st;
  });
  const [sel, setSel] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"good" | "bad" | null>(null);
  const [finished, setFinished] = useState(false);

  const step = stepIdx < lesson.steps.length ? lesson.steps[stepIdx] : null;
  const moves = useMemo(
    () => (finished ? [] : legalMoves(state)),
    [state, finished]
  );
  const threatened: Side | null =
    !finished && isGeneralThreatened(state, state.turn) ? state.turn : null;
  const targets = useMemo(
    () => (sel === null ? [] : moves.filter((m) => m.from === sel)),
    [moves, sel]
  );
  // Static piece identities (no cross-position animation in lessons).
  const instances = useMemo(() => {
    const m = new Map<number, number>();
    for (let i = 0; i < 25; i++) if (state.cells[i] !== 0) m.set(i, i);
    return m;
  }, [state]);

  const expected = step ? parseStepMove(step.move) : null;

  const advance = (move: Move) => {
    const after = applyMove(state, move);
    setState(after);
    setSel(null);
    setFeedback(null);
    if (move.capture) playCapture();
    else playMove();
    const st = gameStatus(after);
    if (st.outcome === "ongoing" && isGeneralThreatened(after, after.turn)) {
      playCheck();
    }
    const next = stepIdx + 1;
    if (next >= lesson.steps.length) {
      setFinished(true);
      playWin();
      if (!alreadyDone) void onDone(lesson.id);
    } else {
      setStepIdx(next);
    }
  };

  /** "show" steps: play the guided move on continue. */
  const doShow = () => {
    if (!step || step.kind !== "show" || !expected) return;
    const m = moves.find((x) => x.from === expected.from && x.to === expected.to);
    if (m) advance(m);
  };

  const onPoint = (i: number) => {
    if (finished || !step || step.kind !== "quiz" || !expected) return;
    if (sel !== null) {
      const m = moves.find((x) => x.from === sel && x.to === i);
      if (m) {
        if (m.from === expected.from && m.to === expected.to) {
          setFeedback("good");
          setTimeout(() => advance(m), 450);
        } else {
          setFeedback("bad");
          playSelect();
        }
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

  return (
    <div className="cct-scroll-area">
      <div className="cct-view">
        <div className="cct-board-area">
          <div className="cct-board-fit">
            <Board
              state={state}
              interactive={!finished && step?.kind === "quiz"}
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
          {!finished && step && step.kind === "show" && (
            <>
              <p>{step.text[lang]}</p>
              <button
                type="button"
                className="cct-btn cct-btn-primary"
                onClick={doShow}
              >
                {String(s.bikipContinue)}
              </button>
            </>
          )}
          {!finished && step && step.kind === "quiz" && (
            <>
              <div className="cct-lib-quiz-prompt">
                {(step.quizPrompt ?? step.text)[lang]}
              </div>
              <div className="cct-lib-feedback">
                {feedback === "bad" && (
                  <span className="bad">✗ {String(s.bikipQuizWrong)}</span>
                )}
                {feedback === "good" && (
                  <span className="good">✓ {String(s.bikipQuizCorrect)}</span>
                )}
              </div>
              <p className="cct-hint">{String(s.puzzleYourMove)}</p>
            </>
          )}
          {finished && (
            <>
              <p style={{ fontWeight: 700 }}>{String(s.bikipComplete)}</p>
              <p>{lesson.outro[lang]}</p>
              <button
                type="button"
                className="cct-btn cct-btn-primary"
                onClick={onExit}
              >
                {String(s.bikipBack)}
              </button>
            </>
          )}
        </div>
        <div style={{ marginTop: 8 }}>
          <h3>{lesson.title[lang]}</h3>
          <p className="cct-hint">{lesson.intro[lang]}</p>
          <p className="cct-lib-progress">
            {lang === "vi" ? "Bước" : "Step"} {Math.min(stepIdx + 1, lesson.steps.length)}/
            {lesson.steps.length}
          </p>
        </div>
      </div>
    </div>
  );
}
