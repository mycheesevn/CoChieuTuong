"use client";

import Board, { usePieceInstances } from "./Board";
import { initialState } from "@/lib/cct/engine";
import type { Lang } from "@/lib/cct/i18n";

const VI = (
  <>
    <h2>Cách chơi Cờ Chiếu Tướng</h2>
    <h3>1. Chuẩn bị</h3>
    <p>
      Hai bên đối kháng: <b>Đỏ</b> (bạn, đi trước) và <b>Xanh</b> (máy).
      Mỗi bên có <b>1 quân Tướng</b> (to) và <b>9 quân Lính</b> (nhỏ).
      Bàn cờ là lưới 5×5 điểm giao nhau, đánh số cột 1–5 (trên) và hàng
      1–5 (trái). Quân đặt trên các điểm giao nhau.
    </p>
    <h3>2. Di chuyển</h3>
    <ul>
      <li>Mỗi lượt đi đúng <b>một nước</b>.</li>
      <li>
        Cả Tướng và Lính đều đi giống nhau: <b>một bước</b> tới điểm kề bên
        đang <b>trống</b>, theo đường đã kẻ — ngang, dọc, hoặc chéo (chỉ ở
        những điểm có đường chéo).
      </li>
    </ul>
    <h3>3. Ăn quân — điểm đặc biệt nhất</h3>
    <ul>
      <li>
        <b>Lính không bao giờ ăn được quân.</b> Nhiệm vụ của Lính là bao vây,
        che chắn, chặn đường — và làm <b>quân đệm</b>.
      </li>
      <li>
        <b>Chỉ Tướng mới ăn được</b>, kiểu nhảy qua quân đệm: ba quân phải
        đứng trên <b>ba điểm liên tiếp</b> của cùng một đường thẳng — điểm
        kề Tướng là <b>Lính của chính mình</b> (quân đệm), điểm ngay sau đệm
        là <b>quân địch</b>. Tướng nhảy qua quân đệm, đáp xuống điểm của
        quân địch và ăn nó — ăn được mọi quân địch, kể cả Tướng địch.
        Trong khoảng ăn <b>chỉ có đúng một quân đệm</b>: không có bất kỳ ô
        trống nào, và cách hơn một quân đệm cũng không ăn được.
      </li>
    </ul>
    <h3>4. Chiếu tướng</h3>
    <p>
      Khi Tướng của bạn + một quân đệm của bạn + Tướng đối phương đứng trên
      ba điểm liên tiếp thành thế nhảy-ăn được ở nước sau — đó là thế{" "}
      <b>Chiếu</b>. Bị chiếu thì <b>bắt buộc phải thoát chiếu</b> trong nước
      đi của mình (chạy Tướng, ăn quân đệm của đối phương, hoặc ăn Tướng
      đang chiếu…).
    </p>
    <h3>5. Thắng – Thua – Hòa</h3>
    <ul>
      <li>
        <b>Thua:</b> tới lượt mà <b>không còn nước đi hợp lệ nào</b> — bị
        chiếu mà không thoát được gọi là <b>chiếu bí</b>; không bị chiếu mà
        hết nước đi gọi là <b>bí nước</b> (cũng thua).
      </li>
      <li>
        <b>Hòa:</b> khi cả hai bên đều <b>hết Lính</b> (hết quân đệm) — chỉ
        còn hai Tướng đối nhau, không bên nào ăn được nữa.
      </li>
    </ul>
  </>
);

const EN = (
  <>
    <h2>How to play Vietnamese General Check</h2>
    <h3>1. Setup</h3>
    <p>
      Two sides: <b>Red</b> (you, moving first) vs <b>Green</b> (the
      computer). Each side has <b>1 General</b> (large) and <b>9 Soldiers</b>
      (small). The board is a 5×5 grid of intersection points, columns 1–5
      (top) and rows 1–5 (left). Pieces stand on the points.
    </p>
    <h3>2. Movement</h3>
    <ul>
      <li>Exactly <b>one move</b> per turn.</li>
      <li>
        Generals and Soldiers move the same way: <b>one step</b> to an
        adjacent <b>empty</b> point along a drawn line — orthogonal, or
        diagonal where a diagonal line exists.
      </li>
    </ul>
    <h3>3. Capturing — the twist</h3>
    <ul>
      <li>
        <b>Soldiers can never capture.</b> They surround, shield, block —
        and serve as <b>screens</b>.
      </li>
      <li>
        <b>Only the General captures</b>, by jumping over a screen: the
        three pieces must stand on <b>three consecutive points</b> of one
        straight line — the point next to the General is <b>one of its own
        Soldiers</b> (the screen), and the point right beyond the screen is
        the <b>enemy piece</b>. The General jumps over the screen and lands
        on the enemy piece, capturing it — any enemy piece, including the
        enemy General. The span holds <b>exactly one screen</b>: no empty
        point anywhere in it, and two screens in a row do not work either.
      </li>
    </ul>
    <h3>4. Check</h3>
    <p>
      Your General + your screen + the enemy General on three consecutive
      points so the capture threatens next move = <b>check</b>. When in
      check you <b>must</b> get out of it on your move (move the General,
      capture the enemy screen, or capture the checking General…).
    </p>
    <h3>5. Win – Loss – Draw</h3>
    <ul>
      <li>
        <b>Loss:</b> no legal moves on your turn — <b>checkmate</b> if your
        General is under threat, otherwise a <b>stalemate-loss</b> (stalemate
        loses here, it is not a draw).
      </li>
      <li>
        <b>Draw:</b> both sides have lost all their Soldiers (no screens
        left) — only the two Generals remain and nobody can capture anymore.
      </li>
    </ul>
  </>
);

export default function HowToView({ lang }: { lang: Lang }) {
  const instances = usePieceInstances([]);
  return (
    <div className="cct-scroll-area">
      <div className="cct-howto">
        {lang === "vi" ? VI : EN}
        <div className="cct-howto-board">
          <Board
            state={initialState()}
            interactive={false}
            sel={null}
            targets={[]}
            lastMove={null}
            threatened={null}
            captureFlash={null}
            instances={instances}
            onPoint={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
