/** VI/EN strings. VI is the default. Persisted in localStorage `cct-lang`. */

export type Lang = "vi" | "en";

const vi = {
  appName: "Cờ Chiếu Tướng",
  tagline: "Trò chơi dân gian trí tuệ",
  menu: "Danh mục",
  mode: "Chế độ chơi",
  play: "🎮 Chơi với máy",
  twoPlayer: "👥 Hai người chơi",
  howto: "📖 Cách chơi",
  playSettings: "Cài đặt ván chơi",
  level: "Cấp độ",
  levelDesc: [
    "",
    "Tập đi — hay quên quân",
    "Mới chơi — thỉnh thoảng sai",
    "Biết luật — còn non",
    "Chơi được — ít bẫy",
    "Khá — bắt đầu tính toán",
    "Giỏi — thấy được 2-3 nước",
    "Cao thủ — tính sâu",
    "Kiện tướng — rất ít sai",
    "Đại kiện tướng",
    "Siêu máy — tính rất sâu",
    "Huyền thoại — gần như không sai",
    "Tối thượng",
  ],
  newGame: "＋ Ván mới",
  undo: "↩ Đi lại",
  resign: "🏳️ Đầu hàng",
  resignConfirm: "Chắc chắn đầu hàng?",
  yourTurnRed: "Lượt bạn (Đỏ)",
  yourTurnGreen: "Lượt Xanh",
  aiThinking: "Máy đang nghĩ…",
  check: "Chiếu!",
  checkBanner: "CHIẾU TƯỚNG!",
  redWins: "🎉 Đỏ thắng!",
  greenWins: "Xanh thắng!",
  reasonCheckmate: "chiếu bí",
  reasonStalemate: "đối phương bí nước",
  reasonResign: "đối phương đầu hàng",
  reasonNoScreens: "hòa — hai bên đều hết quân đệm",
  draw: "Hòa!",
  playAgain: "Chơi ván mới",
  moveList: "Các nước đi",
  capturedByRed: "Đỏ ăn",
  capturedByGreen: "Xanh ăn",
  noMoves: "Chưa có nước đi nào",
  flipBoard: "Xoay bàn khi đổi lượt",
  sideToMove: "Lượt đi",
  settings: "Cài đặt",
  sound: "Âm thanh",
  soundOn: "🔊 Bật",
  soundOff: "🔇 Tắt",
  bigCheckBanner: 'Hiện chữ "CHIẾU TƯỚNG!" to giữa màn hình',
  language: "Ngôn ngữ",
  copyright: "Bản quyền thuộc về SynerWork Inc. Mọi quyền được bảo lưu.",
  metaDescription:
    "Chơi Cờ Chiếu Tướng với máy — trò chơi dân gian trí tuệ: dùng Tướng nhảy qua quân đệm để ăn quân, chiếu bí đối phương. Miễn phí, tiếng Việt.",
  close: "Đóng",
  general: "Tướng",
  soldier: "Lính",
  red: "Đỏ",
  green: "Xanh",
};

export type StrKey = keyof typeof vi;

const en: Record<StrKey, string | string[]> = {
  appName: "Chieu Tuong Chess",
  tagline: "A folk strategy board game",
  menu: "Menu",
  mode: "Game mode",
  play: "🎮 Vs computer",
  twoPlayer: "👥 Two players",
  howto: "📖 How to play",
  playSettings: "Game settings",
  level: "Level",
  levelDesc: [
    "",
    "Learning — often blunders",
    "Beginner — occasional mistakes",
    "Knows the rules — still raw",
    "Decent — few traps",
    "Good — starts calculating",
    "Strong — sees 2-3 moves ahead",
    "Expert — deep calculation",
    "Master — rarely errs",
    "Grandmaster",
    "Super engine — very deep",
    "Legend — near perfect",
    "Ultimate",
  ],
  newGame: "＋ New game",
  undo: "↩ Undo",
  resign: "🏳️ Resign",
  resignConfirm: "Really resign?",
  yourTurnRed: "Your turn (Red)",
  yourTurnGreen: "Green's turn",
  aiThinking: "Thinking…",
  check: "Check!",
  checkBanner: "CHECK!",
  redWins: "🎉 Red wins!",
  greenWins: "Green wins!",
  reasonCheckmate: "checkmate",
  reasonStalemate: "opponent has no moves",
  reasonResign: "opponent resigned",
  reasonNoScreens: "draw — both sides out of screens",
  draw: "Draw!",
  playAgain: "Play again",
  moveList: "Moves",
  capturedByRed: "Captured by Red",
  capturedByGreen: "Captured by Green",
  noMoves: "No moves yet",
  flipBoard: "Flip board each turn",
  sideToMove: "To move",
  settings: "Settings",
  sound: "Sound",
  soundOn: "🔊 On",
  soundOff: "🔇 Off",
  bigCheckBanner: 'Show a big "CHECK!" banner mid-screen',
  language: "Language",
  copyright: "Copyright by SynerWork Inc. All rights reserved.",
  metaDescription:
    "Play Co Chieu Tuong vs the computer — a folk strategy board game: jump your General over your own screen to capture, and checkmate the enemy General. Free, in English and Vietnamese.",
  close: "Close",
  general: "General",
  soldier: "Soldier",
  red: "Red",
  green: "Green",
};

export const STR: Record<Lang, Record<StrKey, string | string[]>> = { vi, en };

const KEY = "cct-lang";

export function loadLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    return v === "en" ? "en" : "vi";
  } catch {
    return "vi";
  }
}

export function saveLang(l: Lang): void {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* ignore */
  }
}

/** "Cấp 5" / "Level 5" with the level's description. */
export function levelName(lang: Lang, level: number): string {
  const descs = STR[lang].levelDesc as string[];
  const d = descs[level] ?? "";
  return lang === "vi" ? `Cấp ${level} — ${d}` : `Level ${level} — ${d}`;
}

export function levelShort(lang: Lang, level: number): string {
  return lang === "vi" ? `Cấp ${level}` : `Level ${level}`;
}
