# Cờ Chiếu Tướng — Luật chơi (bản chuẩn cài đặt)

> Tài liệu này là đặc tả duy nhất cho phần luật của app. Mọi chi tiết đã được
> người dùng xác nhận ngày 2026-10-13. Engine trong `lib/cct/engine.ts` cài đặt
> đúng từng điểm dưới đây.

## 1. Bàn cờ

- Lưới **5×5 điểm giao nhau**; quân đặt trên các điểm (như cờ tướng).
- Tọa độ (cột, hàng), mỗi chiều 1–5: cột đánh số từ trái qua phải (số ở mép
  trên), hàng đánh số từ trên xuống dưới (số ở mép trái).
- Đường kẻ: đầy đủ các đường **ngang, dọc**, và đường **chéo chỉ tại các điểm
  có (cột + hàng) chẵn** — 13 điểm, mỗi điểm nối chéo tới 4 điểm chéo kề
  (lưới kiểu Alquerque).

## 2. Quân ban đầu

- Bên **Xanh** ở trên (hàng 1–2), bên **Đỏ** ở dưới (hàng 4–5); hàng 3 trống.
- Mỗi bên: **1 Tướng** (quân to) + **9 Lính** (quân nhỏ).
  - Tướng Xanh ở (3,1); Tướng Đỏ ở (3,5).
  - Lính lấp đầy các điểm còn lại của hai hàng nhà mỗi bên.
- **Đỏ đi trước.** Người chơi cầm Đỏ; máy cầm Xanh.

## 3. Di chuyển

- Mỗi lượt đi đúng **một nước**.
- Cả Tướng và Lính đi giống nhau: **một bước** tới điểm kề bên đang **trống**,
  theo đường đã kẻ (ngang/dọc/chéo nếu có đường chéo).

## 4. Ăn quân

- **Lính không bao giờ ăn được quân.** Vai trò: bao vây, che chắn, chặn đường,
  làm quân đệm.
- **Chỉ Tướng mới ăn được**, kiểu nhảy qua quân đệm:
  - Ba quân phải đứng trên **ba điểm liên tiếp** của cùng một đường thẳng
    (ngang/dọc/chéo): điểm kề Tướng là **Lính của chính mình** (quân đệm),
    điểm ngay sau đệm là **quân địch** (Lính hoặc Tướng) — Tướng nhảy qua
    đệm và đáp xuống đúng điểm của quân địch đó.
  - Trong khoảng ăn **chỉ có đúng một quân đệm**: không có bất kỳ ô trống
    nào (dù trước hay sau đệm), và cách hơn một quân đệm (hai quân mình
    xếp liền nhau) cũng **không** ăn được.
  - Quân kề bên là quân địch (không có đệm) → không ăn được. Tướng
    **không** ăn được quân kề bên trực tiếp.

## 5. Chiếu tướng

- Tướng của bạn + một quân đệm của bạn + Tướng đối phương đứng trên ba điểm
  liên tiếp thành thế nhảy-ăn được ở nước sau → đó là thế **Chiếu**.
- Bị chiếu thì **bắt buộc phải thoát chiếu** trong nước đi của mình: chạy
  Tướng, ăn quân đệm của đối phương, ăn Tướng đang chiếu, v.v. Nước đi để
  Tướng của mình vẫn còn bị uy hiếp là nước **không hợp lệ**.
- Hệ quả: trong ván đấu hợp lệ, Tướng không bao giờ bị ăn thật — ván luôn
  kết thúc bằng chiếu bí trước khi nước ăn Tướng kịp diễn ra.

## 6. Thắng – Thua – Hòa

- **Thua** khi tới lượt mà không còn nước đi hợp lệ nào:
  - **Chiếu bí**: Tướng đang bị chiếu mà không còn nước nào thoát được.
  - **Bí nước**: không bị chiếu nhưng cũng không còn nước đi nào (bí nước
    là **thua**, không phải hòa).
- **Hòa** khi cả hai bên đều **hết Lính** (hết quân đệm) — chỉ còn hai Tướng
  đối nhau, không bên nào còn khả năng ăn quân nữa. Hòa được xử ngay khi
  nước đi cuối cùng ăn mất quân Lính cuối cùng của bên còn lại.

## 7. Ghi chú cài đặt

- `gameStatus`: hòa (hết đệm hai bên) được xét trước chiếu bí/bí nước.
- Trường hợp suy biến "Tướng bị ăn thật" chỉ xảy ra ở thế cờ dựng tay
  (không thể xảy ra trong ván hợp lệ); engine xử lý gọn: bên ăn Tướng địch
  thắng ngay (mã `checkmate`), không bao giờ crash.
- Ký hiệu nước đi: `T 3,5 × 3,2` (Tướng ăn), `L 1,4 → 1,3` (Lính đi thường),
  tọa độ 1-indexed (cột,hàng).
