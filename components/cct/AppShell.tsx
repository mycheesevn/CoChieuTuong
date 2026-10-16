"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import PlayView, { type ViewActions } from "./PlayView";
import HowToView from "./HowToView";
import { HistoryView } from "./HistoryView";
import { LeaderboardView } from "./LeaderboardView";
import { CheckinView } from "./CheckinView";
import { SetupView } from "./SetupView";
import RoomView, { roomErrText } from "./RoomView";
import CorrView from "./CorrView";
import FriendsView from "./FriendsView";
import { LibraryView } from "./LibraryView";
import { PuzzleView } from "./PuzzleView";
import { CommunityView } from "./CommunityView";
import { NotificationsView } from "./NotificationsView";
import { PushNudge, PushSettings } from "./PushSettings";
import { AuthModal } from "./AuthModal";
import { ProfileModal } from "./ProfileModal";
import { AuthProvider, useAuth } from "@/lib/supabase/auth";
import { isMuted, setMuted } from "@/lib/cct/sound";
import { STR, loadLang, saveLang, levelName, type Lang } from "@/lib/cct/i18n";
import { levelProgress } from "@/lib/cct/levels";
import type { Side } from "@/lib/cct/engine";
import {
  fetchPendingChallenges,
  respondChallenge,
  sendChallenge,
  subscribeChallenges,
  type Challenge,
} from "@/lib/supabase/friends";
import { joinRoom, roomErrorKey } from "@/lib/supabase/rooms";
import { fireEvent } from "@/lib/supabase/notify";
import { fetchNotifications } from "@/lib/supabase/notifications";
import { createClient } from "@/lib/supabase/client";

type Mode =
  | "play"
  | "puzzle"
  | "bikip"
  | "setup"
  | "history"
  | "leaderboard"
  | "room"
  | "corr"
  | "checkin"
  | "community"
  | "notifications"
  | "howto"
  | "friends";

const BANNER_KEY = "cct-big-check-banner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

function loadBanner(): boolean {
  try {
    return localStorage.getItem(BANNER_KEY) === "1";
  } catch {
    return false;
  }
}

export interface CustomStart {
  pos: string;
  turn: Side;
  nonce: number;
}

function Shell() {
  const [mode, setMode] = useState<Mode>("play");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"in" | "up">("in");
  const [installEvt, setInstallEvt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("vi");
  const [level, setLevel] = useState(5);
  const [soundOn, setSoundOn] = useState(true);
  const [bannerOn, setBannerOn] = useState(false);
  const [customStart, setCustomStart] = useState<CustomStart | null>(null);
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(null);
  const [corrDeepLinkId, setCorrDeepLinkId] = useState<string | null>(null);
  const [pendingCorrId, setPendingCorrId] = useState<string | null>(null);
  /** Hub deep link: ?challenge=<handle> — an OUTGOING challenge to that
   *  player (the UUID form is an INCOMING challenge id, handled above). */
  const [hubChallengeHandle, setHubChallengeHandle] = useState<string | null>(
    null
  );
  const [hubChallengeTarget, setHubChallengeTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [hubChallengeBusy, setHubChallengeBusy] = useState(false);
  const [hubChallengeMsg, setHubChallengeMsg] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [declinedToast, setDeclinedToast] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingPuzzle, setPendingPuzzle] = useState<{
    pos: string;
    turn: Side;
  } | null>(null);
  const actionsRef = useRef<ViewActions | null>(null);
  const [actionsVersion, setActionsVersion] = useState(0);
  const notifyActions = () => setActionsVersion((x) => x + 1);

  const { user, displayName, signOut, cctStats } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    setLang(loadLang());
    setSoundOn(!isMuted());
    setBannerOn(loadBanner());
  }, []);

  // PWA install prompt (drawer section, shown when available).
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  const onInstallClick = () => {
    if (installEvt) {
      void installEvt.prompt();
      setInstallEvt(null);
    }
  };

  // XP level for the header chip + avatar ring (family-wide XP curve).
  const lp = levelProgress(cctStats?.xp ?? 0);
  const hasStats = !!cctStats;

  // Deep links: ?room=CODE, ?corr=<uuid>, ?challenge=<uuid>, parsed on
  // mount AND on window focus (push taps reuse the open tab).
  useEffect(() => {
    const parse = () => {
      try {
        const url = new URL(window.location.href);
        const room = url.searchParams.get("room");
        const corr = url.searchParams.get("corr");
        const challenge = url.searchParams.get("challenge");
        let consumed = false;
        if (room && /^[A-Za-z0-9]{6}$/.test(room)) {
          setPendingRoomCode(room.toUpperCase());
          url.searchParams.delete("room");
          consumed = true;
        }
        if (
          corr &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            corr
          )
        ) {
          setPendingCorrId(corr);
          url.searchParams.delete("corr");
          consumed = true;
        }
        if (
          challenge &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            challenge
          )
        ) {
          // The challenge popup (login-poll) shows the challenge itself;
          // land on the Friends view so the incoming challenge is visible.
          setMode("friends");
          url.searchParams.delete("challenge");
          consumed = true;
        }
        if (
          challenge &&
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            challenge
          )
        ) {
          // From the SynerWorlds hub (profile page / Tìm đối thủ board):
          // ?challenge=<handle> is an OUTGOING challenge to that player.
          setHubChallengeHandle(challenge.toLowerCase());
          url.searchParams.delete("challenge");
          consumed = true;
        }
        if (consumed) {
          window.history.replaceState(
            null,
            "",
            url.pathname + url.search + url.hash
          );
        }
      } catch {
        /* ignore */
      }
    };
    parse();
    window.addEventListener("focus", parse);
    return () => window.removeEventListener("focus", parse);
  }, []);

  // Resolve a pending ?room=CODE once auth state is known.
  useEffect(() => {
    if (!pendingRoomCode) return;
    const code = pendingRoomCode;
    setPendingRoomCode(null);
    if (!user) {
      setInviteCode(code);
      setMode("room");
      return;
    }
    (async () => {
      try {
        const room = await joinRoom(code);
        setOpenRoomId(room.id);
        setMode("room");
      } catch {
        // Join failed (bad/closed room) — still open the lobby; the
        // RoomView join form can surface the error.
        setMode("room");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingRoomCode]);

  // Resolve a pending ?corr=<uuid> for logged-in users.
  useEffect(() => {
    if (!pendingCorrId) return;
    const id = pendingCorrId;
    setPendingCorrId(null);
    if (!user) return;
    setCorrDeepLinkId(id);
    setMode("corr");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingCorrId]);

  // Unread notification count for the avatar badge (best-effort).
  const refreshUnread = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    try {
      const { unread } = await fetchNotifications();
      setUnreadCount(unread);
    } catch {
      /* badge is best-effort */
    }
  }, [userId]);
  useEffect(() => {
    refreshUnread();
    const t = window.setInterval(refreshUnread, 60 * 1000);
    return () => window.clearInterval(t);
  }, [refreshUnread]);

  // Challenges: popup on login + live subscription.
  useEffect(() => {
    if (!userId) {
      setChallenge(null);
      return;
    }
    let dead = false;
    const refresh = async () => {
      try {
        const { incoming } = await fetchPendingChallenges();
        if (!dead && incoming.length > 0) setChallenge(incoming[0]);
      } catch {
        /* best-effort */
      }
    };
    void refresh();
    const ch = subscribeChallenges(
      userId,
      (c) => {
        if (!dead) setChallenge((prev) => prev ?? c);
      },
      (challengedName) => {
        if (dead) return;
        setDeclinedToast(
          String(s.challengeDeclinedToast).replace("{name}", challengedName)
        );
        setTimeout(() => {
          if (!dead) setDeclinedToast(null);
        }, 4000);
      },
      (c, challengedName) => {
        // My challenge was accepted: the accepter is already entering
        // the room — bring me in too, no manual room hunt (user request).
        if (dead) return;
        setDeclinedToast(
          String(s.challengeAcceptedToast).replace("{name}", challengedName)
        );
        setTimeout(() => {
          if (!dead) setDeclinedToast(null);
        }, 4000);
        if (c.room_id) {
          setOpenRoomId(c.room_id);
          setMode("room");
        }
      }
    );
    return () => {
      dead = true;
      try {
        createClient().removeChannel(ch);
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const acceptChallenge = async (c: Challenge) => {
    setChallenge(null);
    try {
      // Join FIRST: if the room is full/closed/gone the challenge must
      // stay pending (retryable) instead of being silently consumed.
      const room = await joinRoom(c.room_code);
      await respondChallenge(c.id, true).catch(() => {
        /* membership already secured; the status flag is cosmetic */
      });
      // Notify the challenger (push + inbox) — fired from the accepter's
      // client because the trigger route verifies the caller IS the
      // challenged player; the challenger may not even be online.
      void fireEvent("challenge_accepted", { challenge: c.id });
      setOpenRoomId(room.id);
      setMode("room");
    } catch (e) {
      // Never fail silently: explain and keep the challenge actionable.
      setDeclinedToast(roomErrText(roomErrorKey(e), s));
      setTimeout(() => setDeclinedToast(null), 5000);
      setChallenge(c);
      return;
    }
    // Surface the next pending challenge, if any.
    try {
      const { incoming } = await fetchPendingChallenges();
      if (incoming.length > 0) setChallenge(incoming[0]);
    } catch {
      /* ignore */
    }
  };

  const declineChallenge = async (c: Challenge) => {
    setChallenge(null);
    try {
      await respondChallenge(c.id, false);
      void fireEvent("challenge_declined", { challenge: c.id });
      const { incoming } = await fetchPendingChallenges();
      if (incoming.length > 0) setChallenge(incoming[0]);
    } catch {
      /* ignore */
    }
  };

  /** FriendsView accept → join FIRST, then mark accepted, then open
   *  the room. Throws on join failure so FriendsView can show the
   *  reason and keep the challenge row (it stays pending). */
  const onAcceptChallengeFromFriends = async (c: Challenge): Promise<void> => {
    const room = await joinRoom(c.room_code);
    await respondChallenge(c.id, true).catch(() => {
      /* membership already secured; the status flag is cosmetic */
    });
    setOpenRoomId(room.id);
    setMode("room");
  };

  const s = STR[lang] as Record<string, string | string[]>;

  // Hub challenge deep link: prompt login if needed, resolve the handle to
  // a player, then ask for confirmation before sending.
  useEffect(() => {
    if (!hubChallengeHandle) return;
    if (!user) {
      setAuthOpen(true);
      return;
    }
    let dead = false;
    (async () => {
      try {
        const sb = createClient();
        const { data } = await sb
          .from("profiles")
          .select("id, full_name, username")
          .eq("handle", hubChallengeHandle)
          .maybeSingle();
        if (dead) return;
        setHubChallengeHandle(null);
        if (!data) {
          setHubChallengeMsg(String(s.hubChallengeNotFound));
          setTimeout(() => setHubChallengeMsg(""), 4500);
          return;
        }
        const row = data as {
          id: string;
          full_name: string | null;
          username: string | null;
        };
        if (row.id === user.id) return; // own profile link — nothing to challenge
        const name =
          row.full_name?.trim() || row.username?.trim() || "Player";
        setHubChallengeTarget({ id: row.id, name });
      } catch {
        if (!dead) {
          setHubChallengeHandle(null);
          setHubChallengeMsg(String(s.hubChallengeNotFound));
          setTimeout(() => setHubChallengeMsg(""), 4500);
        }
      }
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, hubChallengeHandle]);

  const doHubChallenge = async () => {
    if (!hubChallengeTarget || hubChallengeBusy) return;
    setHubChallengeBusy(true);
    setHubChallengeMsg("");
    try {
      const ch = await sendChallenge(hubChallengeTarget.id, displayName);
      setHubChallengeTarget(null);
      // Enter the created room immediately: the challenger is already a
      // member via createRoom — mirrors the accepted-challenge auto-route.
      if (ch.room_id) {
        setOpenRoomId(ch.room_id);
        setMode("room");
      }
    } catch {
      // Keep the modal open and explain — never swallow a failed send.
      setHubChallengeMsg(String(s.hubChallengeError));
    } finally {
      setHubChallengeBusy(false);
    }
  };

  const changeLang = (l: Lang) => {
    setLang(l);
    saveLang(l);
  };
  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setMuted(!next);
  };
  const toggleBanner = () => {
    const next = !bannerOn;
    setBannerOn(next);
    try {
      localStorage.setItem(BANNER_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setDrawerOpen(false);
  };

  const onPlayCustom = (pos: string, turn: Side) => {
    setCustomStart({ pos, turn, nonce: Date.now() });
    setMode("play");
    setDrawerOpen(false);
  };

  /** Setup editor → publish the arranged position as a community puzzle. */
  const onPublishPuzzle = (pos: string, turn: Side) => {
    setPendingPuzzle({ pos, turn });
    setMode("community");
    setDrawerOpen(false);
  };

  const actions = actionsRef.current;
  void actionsVersion; // re-read actionsRef after views publish their actions

  return (
    <div className="cct-page">
      <header className="cct-header">
        <div className="cct-topbar">
          <button
            className="cct-menu-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Menu"
          >
            ☰
          </button>
          <div className="cct-brand">
            <h1 className="cct-title">{String(s.appName)}</h1>
          </div>
          <div className="cct-account">
            <div className="cct-user" role="group" aria-label="Account">
              {user && hasStats && (
                <button
                  type="button"
                  className="cct-rating-chip"
                  onClick={() => {
                    setMenuOpen(false);
                    setMode("leaderboard");
                  }}
                  title={String(s.leaderboard)}
                >
                  ⭐ Lv {lp.level}
                </button>
              )}
              <button
                type="button"
                className="cct-avatar-btn"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title={user ? displayName : String(s.settings)}
                style={{ position: "relative" }}
              >
                {unreadCount > 0 && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#fa5252",
                      border: "2px solid var(--bg, #14100c)",
                      zIndex: 1,
                    }}
                  />
                )}
                {user ? (
                  <>
                    <span
                      className="cct-level-ring"
                      style={{ "--p": lp.prog } as CSSProperties}
                      title={`Lv ${lp.level} · ${lp.into}/${lp.needed} XP`}
                    >
                      <span className="cct-account-avatar">👤</span>
                    </span>
                    <span className="cct-account-name">{displayName}</span>
                    <span aria-hidden="true" className="cct-caret">
                      ▾
                    </span>
                  </>
                ) : (
                  <span className="cct-account-avatar">⚙️</span>
                )}
              </button>
              {menuOpen && (
                <>
                  <div
                    className="cct-menu-backdrop"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="cct-account-menu" role="menu">
                    {user && (
                      <div className="cct-account-menu-head">
                        <span className="cct-account-avatar large">👤</span>
                        <div className="cct-account-menu-id">
                          <strong>{displayName}</strong>
                          <span className="cct-muted">{user.email}</span>
                        </div>
                      </div>
                    )}
                    {user && (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          className="cct-account-menu-item"
                          onClick={() => {
                            setProfileOpen(true);
                            setMenuOpen(false);
                          }}
                        >
                          {String(s.profile)}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="cct-account-menu-item"
                          onClick={() => {
                            setMode("notifications");
                            setMenuOpen(false);
                          }}
                        >
                          {String(s.notifications)}
                          {unreadCount > 0 && (
                            <span
                              aria-hidden="true"
                              style={{
                                marginLeft: 6,
                                minWidth: 18,
                                height: 18,
                                borderRadius: 9,
                                background: "#fa5252",
                                color: "#fff",
                                fontSize: 12,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "0 5px",
                              }}
                            >
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="cct-account-menu-item"
                          onClick={() => {
                            setMode("friends");
                            setMenuOpen(false);
                          }}
                        >
                          {String(s.friends)}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      className="cct-account-menu-item"
                      aria-expanded={settingsExpanded}
                      onClick={() => setSettingsExpanded((v) => !v)}
                    >
                      ⚙️ {String(s.settings)}
                      <span aria-hidden="true" className="cct-caret">
                        {settingsExpanded ? "▾" : "▸"}
                      </span>
                    </button>
                    {settingsExpanded && (
                      <div className="cct-account-menu-settings">
                        <div
                          className="cct-lang"
                          role="group"
                          aria-label="Language / Ngôn ngữ"
                        >
                          <button
                            type="button"
                            className={lang === "en" ? "active" : ""}
                            onClick={() => changeLang("en")}
                          >
                            EN
                          </button>
                          <button
                            type="button"
                            className={lang === "vi" ? "active" : ""}
                            onClick={() => changeLang("vi")}
                          >
                            VI
                          </button>
                        </div>
                        <button
                          type="button"
                          className="cct-btn small"
                          onClick={toggleSound}
                          aria-label={
                            soundOn ? String(s.soundOff) : String(s.soundOn)
                          }
                        >
                          {soundOn ? String(s.soundOn) : String(s.soundOff)}
                        </button>
                        <label className="cct-check-toggle">
                          <input
                            type="checkbox"
                            checked={bannerOn}
                            onChange={toggleBanner}
                          />
                          <span>{String(s.bigCheckBanner)}</span>
                        </label>
                        {user && <PushSettings lang={lang} />}
                      </div>
                    )}
                    {user ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="cct-account-menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          void signOut();
                        }}
                      >
                        🚪 {String(s.logout)}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          className="cct-account-menu-item"
                          onClick={() => {
                            setAuthMode("in");
                            setAuthOpen(true);
                            setMenuOpen(false);
                          }}
                        >
                          {String(s.authLogin)}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="cct-account-menu-item"
                          onClick={() => {
                            setAuthMode("up");
                            setAuthOpen(true);
                            setMenuOpen(false);
                          }}
                        >
                          {String(s.authSignup)}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {mode === "play" && (
          <div className="cct-quick">
            <button
              className="cct-btn"
              disabled={!actions?.canUndo}
              onClick={() => actions?.undo()}
            >
              {String(s.undo)}
            </button>
            <span className="cct-quick-spacer" />
            <button
              className="cct-btn cct-btn-primary"
              onClick={() => actions?.newGame()}
            >
              {String(s.newGame)}
            </button>
          </div>
        )}
      </header>

      {drawerOpen && (
        <div className="cct-drawer-root">
          <div className="cct-backdrop" onClick={() => setDrawerOpen(false)} />
          <nav className="cct-drawer">
            <div className="cct-drawer-head">
              <strong>{String(s.menu)}</strong>
              <button
                className="cct-btn cct-btn-icon"
                onClick={() => setDrawerOpen(false)}
                aria-label={String(s.close)}
              >
                ✕
              </button>
            </div>
            <div className="cct-drawer-body">
              <section>
                <h2>{String(s.mode)}</h2>
                <div className="cct-drawer-modes">
                  <button
                    data-active={mode === "play"}
                    onClick={() => switchMode("play")}
                  >
                    {String(s.play)}
                  </button>
                  <button
                    data-active={mode === "puzzle"}
                    onClick={() => switchMode("puzzle")}
                  >
                    {String(s.puzzle)}
                  </button>
                  <button
                    data-active={mode === "bikip"}
                    onClick={() => switchMode("bikip")}
                  >
                    {String(s.bikip)}
                  </button>
                  <button
                    data-active={mode === "setup"}
                    onClick={() => switchMode("setup")}
                  >
                    {String(s.setup)}
                  </button>
                  <button
                    data-active={mode === "history"}
                    onClick={() => switchMode("history")}
                  >
                    {String(s.history)}
                  </button>
                  <button
                    data-active={mode === "leaderboard"}
                    onClick={() => switchMode("leaderboard")}
                  >
                    {String(s.leaderboard)}
                  </button>
                  <button
                    data-active={mode === "room"}
                    onClick={() => switchMode("room")}
                  >
                    {String(s.room)}
                  </button>
                  <button
                    data-active={mode === "corr"}
                    onClick={() => switchMode("corr")}
                  >
                    {String(s.corr)}
                  </button>
                  <button
                    data-active={mode === "checkin"}
                    onClick={() => switchMode("checkin")}
                  >
                    {String(s.checkin)}
                  </button>
                  <button
                    data-active={mode === "community"}
                    onClick={() => switchMode("community")}
                  >
                    {String(s.community)}
                  </button>
                  <button
                    data-active={mode === "howto"}
                    onClick={() => switchMode("howto")}
                  >
                    {String(s.howto)}
                  </button>
                </div>
              </section>
              {installEvt && (
                <section>
                  <div className="cct-drawer-modes">
                    <button
                      type="button"
                      className="cct-btn cct-btn-primary"
                      onClick={onInstallClick}
                    >
                      {String(s.installApp)}
                    </button>
                  </div>
                </section>
              )}
              {mode === "play" && (
                <section>
                  <h2>{String(s.playSettings)}</h2>
                  <label className="cct-field">
                    {String(s.level)}
                    <select
                      className="cct-select"
                      value={level}
                      onChange={(e) => setLevel(Number(e.target.value))}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((l) => (
                        <option key={l} value={l}>
                          {levelName(lang, l)}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>
              )}
              <div className="cct-drawer-legal">
                <a href="/terms" target="_blank" rel="noreferrer">
                  {String(s.termsOfService)}
                </a>
                <span>·</span>
                <a href="/privacy" target="_blank" rel="noreferrer">
                  {String(s.privacyPolicy)}
                </a>
                <span>·</span>
                <a href="/data-deletion" target="_blank" rel="noreferrer">
                  {String(s.dataDeletion)}
                </a>
              </div>
            </div>
          </nav>
        </div>
      )}

      {user && <PushNudge lang={lang} />}

      {mode === "play" && (
        <PlayView
          lang={lang}
          level={level}
          bannerOn={bannerOn}
          actionsRef={actionsRef}
          notifyActions={notifyActions}
          customStart={customStart}
          onClearCustom={() => setCustomStart(null)}
          onLoginRequest={() => setAuthOpen(true)}
        />
      )}
      {mode === "setup" && (
        <SetupView
          lang={lang}
          level={level}
          onLevelChange={setLevel}
          onPlayCustom={onPlayCustom}
          onPublishPuzzle={onPublishPuzzle}
        />
      )}
      {mode === "history" && (
        <HistoryView
          lang={lang}
          user={user ? { id: user.id } : null}
          onLogin={() => setAuthOpen(true)}
        />
      )}
      {mode === "leaderboard" && (
        <LeaderboardView lang={lang} myUserId={user ? user.id : null} />
      )}
      {mode === "room" && (
        <RoomView
          lang={lang}
          user={user ? { id: user.id } : null}
          inviteCode={inviteCode}
          onConsumeInvite={() => setInviteCode(null)}
          onLogin={() => setAuthOpen(true)}
          openRoomId={openRoomId}
        />
      )}
      {mode === "corr" && (
        <CorrView
          lang={lang}
          userId={user ? user.id : null}
          onLogin={() => setAuthOpen(true)}
          deepLinkGameId={corrDeepLinkId}
        />
      )}
      {mode === "friends" && user && (
        <FriendsView
          lang={lang}
          userId={user.id}
          myName={displayName}
          onAcceptChallenge={onAcceptChallengeFromFriends}
        />
      )}
      {mode === "checkin" && (
        <CheckinView
          lang={lang}
          user={user ? { id: user.id } : null}
          onLogin={() => setAuthOpen(true)}
        />
      )}
      {mode === "puzzle" && <PuzzleView lang={lang} />}
      {mode === "bikip" && <LibraryView lang={lang} />}
      {mode === "community" && (
        <CommunityView
          lang={lang}
          level={level}
          onLevelChange={setLevel}
          userId={user ? user.id : null}
          onLogin={() => setAuthOpen(true)}
          onPracticeVsAi={onPlayCustom}
          pendingCreate={pendingPuzzle}
          onConsumePendingCreate={() => setPendingPuzzle(null)}
        />
      )}
      {mode === "notifications" && user && (
        <NotificationsView lang={lang} onChanged={refreshUnread} />
      )}
      {mode === "howto" && <HowToView lang={lang} />}

      {challenge && (
        <div className="cct-modal-root">
          <div className="cct-backdrop" />
          <div className="cct-modal">
            <h2>{String(s.challengeIncoming)}</h2>
            <p>
              {String(s.challengeFrom).replace(
                "{name}",
                challenge.challenger_name ?? "?"
              )}
            </p>
            <p className="cct-hint">
              {String(s.challengeRoomCode).replace(
                "{code}",
                challenge.room_code
              )}
            </p>
            <div className="cct-actions">
              <button
                className="cct-btn cct-btn-primary"
                onClick={() => void acceptChallenge(challenge)}
              >
                {String(s.challengeAccept)}
              </button>
              <button
                className="cct-btn"
                onClick={() => void declineChallenge(challenge)}
              >
                {String(s.challengeDecline)}
              </button>
            </div>
          </div>
        </div>
      )}
      {declinedToast && (
        <div className="cct-toast" role="status">
          {declinedToast}
        </div>
      )}

      <AuthModal
        lang={lang}
        open={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
      />
      {hubChallengeTarget && (
        <div
          className="cct-modal-root"
          onClick={() => {
            if (!hubChallengeBusy) {
              setHubChallengeTarget(null);
              setHubChallengeMsg("");
            }
          }}
        >
          <div className="cct-modal" onClick={(e) => e.stopPropagation()}>
            <h2>
              {String(s.hubChallengeTitle).replace(
                "{name}",
                hubChallengeTarget.name
              )}
            </h2>
            {hubChallengeMsg && (
              <p
                style={{
                  color: "var(--danger)",
                  margin: "0 0 8px",
                  textAlign: "center",
                }}
                role="alert"
              >
                {hubChallengeMsg}
              </p>
            )}
            <div className="cct-modal-actions">
              <button
                type="button"
                className="cct-btn cct-btn-primary"
                disabled={hubChallengeBusy}
                onClick={doHubChallenge}
              >
                {String(s.hubChallengeSend)}
              </button>
              <button
                type="button"
                className="cct-btn"
                disabled={hubChallengeBusy}
                onClick={() => {
                  setHubChallengeTarget(null);
                  setHubChallengeMsg("");
                }}
              >
                {String(s.hubChallengeLater)}
              </button>
            </div>
          </div>
        </div>
      )}
      {hubChallengeMsg && !hubChallengeTarget && (
        <div className="cct-toast" role="status">
          {hubChallengeMsg}
        </div>
      )}
      <ProfileModal
        lang={lang}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      <footer className="cct-footer">{String(s.copyright)}</footer>
    </div>
  );
}

export default function AppShell() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
