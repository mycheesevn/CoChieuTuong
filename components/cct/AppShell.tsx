"use client";

import { useEffect, useRef, useState } from "react";
import PlayView, { type ViewActions } from "./PlayView";
import TwoPlayerView from "./TwoPlayerView";
import HowToView from "./HowToView";
import { isMuted, setMuted } from "@/lib/cct/sound";
import { STR, loadLang, saveLang, levelName, type Lang } from "@/lib/cct/i18n";

type Mode = "play" | "2p" | "howto";

const BANNER_KEY = "cct-big-check-banner";

function loadBanner(): boolean {
  try {
    return localStorage.getItem(BANNER_KEY) === "1";
  } catch {
    return false;
  }
}

export default function AppShell() {
  const [mode, setMode] = useState<Mode>("play");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("vi");
  const [level, setLevel] = useState(5);
  const [soundOn, setSoundOn] = useState(true);
  const [bannerOn, setBannerOn] = useState(false);
  const actionsRef = useRef<ViewActions | null>(null);
  const [actionsVersion, setActionsVersion] = useState(0);
  const notifyActions = () => setActionsVersion((x) => x + 1);

  useEffect(() => {
    setLang(loadLang());
    setSoundOn(!isMuted());
    setBannerOn(loadBanner());
  }, []);

  const s = STR[lang] as Record<string, string | string[]>;

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
            <button
              className="cct-btn cct-btn-icon"
              onClick={toggleSound}
              aria-label={String(s.sound)}
              title={String(s.sound)}
            >
              {soundOn ? "🔊" : "🔇"}
            </button>
            <div className="cct-lang">
              <button
                className={lang === "vi" ? "active" : ""}
                onClick={() => changeLang("vi")}
              >
                VI
              </button>
              <button
                className={lang === "en" ? "active" : ""}
                onClick={() => changeLang("en")}
              >
                EN
              </button>
            </div>
            <div className="cct-user">
              <button
                className="cct-gear-btn"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={String(s.settings)}
              >
                ⚙️
              </button>
              {menuOpen && (
                <>
                  <div
                    className="cct-menu-backdrop"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="cct-account-menu">
                    <div className="cct-account-menu-settings">
                      <div className="cct-lang">
                        <button
                          className={lang === "vi" ? "active" : ""}
                          onClick={() => changeLang("vi")}
                        >
                          VI
                        </button>
                        <button
                          className={lang === "en" ? "active" : ""}
                          onClick={() => changeLang("en")}
                        >
                          EN
                        </button>
                      </div>
                      <button className="cct-btn small" onClick={toggleSound}>
                        {soundOn ? String(s.soundOn) : String(s.soundOff)}
                      </button>
                      <label className="cct-check-toggle">
                        <input
                          type="checkbox"
                          checked={bannerOn}
                          onChange={toggleBanner}
                        />
                        {String(s.bigCheckBanner)}
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {(mode === "play" || mode === "2p") && (
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
                    data-active={mode === "2p"}
                    onClick={() => switchMode("2p")}
                  >
                    {String(s.twoPlayer)}
                  </button>
                  <button
                    data-active={mode === "howto"}
                    onClick={() => switchMode("howto")}
                  >
                    {String(s.howto)}
                  </button>
                </div>
              </section>
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
            </div>
          </nav>
        </div>
      )}

      {mode === "play" && (
        <PlayView
          lang={lang}
          level={level}
          bannerOn={bannerOn}
          actionsRef={actionsRef}
          notifyActions={notifyActions}
        />
      )}
      {mode === "2p" && (
        <TwoPlayerView
          lang={lang}
          bannerOn={bannerOn}
          actionsRef={actionsRef}
          notifyActions={notifyActions}
        />
      )}
      {mode === "howto" && <HowToView lang={lang} />}

      <footer className="cct-footer">{String(s.copyright)}</footer>
    </div>
  );
}
