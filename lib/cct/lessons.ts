/**
 * Cờ Chiếu Tướng — Bí Kíp (interactive lesson library).
 *
 * Every line is machine-verified with the engine before shipping
 * (scripts/verify-lessons.mjs): all moves legal in sequence, quiz moves
 * really are the lesson side's moves, and claimed terminal outcomes
 * (terminalClaim) really hold after the final step.
 *
 * Lesson ids are prefixed "cct-" — the shared `library_progress` table
 * also holds Chess ("chess-") and Xiangqi rows, so ids must be unique
 * across games.
 *
 * Move notation: canonical "c,r-c,r" with 1-based cols/rows 1-5,
 * e.g. "3,5-3,4".
 */

export interface LText {
  vi: string;
  en: string;
}

export interface LessonStep {
  /** Canonical "c,r-c,r" (1-based, cols/rows 1-5), e.g. "3,5-3,4". */
  move: string;
  /** "show" = auto-played with explanation; "quiz" = the user must find and play this exact move. */
  kind: "show" | "quiz";
  /** Explanation (for quiz steps: the "correct!" text shown after playing it). */
  text: LText;
  /** Shown when it's the user's turn on a quiz step. */
  quizPrompt?: LText;
}

export interface Lesson {
  id: string;
  title: LText;
  intro: LText;
  /** 25-char position string (see engine.ts stateToPos); side to move carried separately. */
  startPos: string;
  startTurn: "r" | "g";
  steps: LessonStep[];
  outro: LText;
  /**
   * Claimed terminal outcome after the final step (asserted by the verifier):
   * - "checkmate" / "stalemate": gameStatus() must be a win for the lesson
   *   side (startTurn) with that reason;
   * - "draw": gameStatus() must be the no-screens draw.
   * Absent = the lesson makes no terminal claim.
   */
  terminalClaim?: "checkmate" | "stalemate" | "draw";
}

export interface Chapter {
  id: string;
  icon: string;
  title: LText;
  subtitle: LText;
  lessons: Lesson[];
}

export const LESSONS: Chapter[] = [
  {
    id: "cct-foundations",
    icon: "🧱",
    title: { vi: "Nền tảng", en: "Foundations" },
    subtitle: {
      vi: "Quân đi thế nào, ăn thế nào — luật chơi trong ba bài học.",
      en: "How the pieces move and capture — the rules in three lessons.",
    },
    lessons: [
      {
        id: "cct-the-triple",
        title: { vi: "Cú nhảy ba điểm", en: "The three-point jump" },
        intro: {
          vi: "Trong Cờ Chiếu Tướng, chỉ có Tướng mới ăn quân — bằng cú nhảy qua đúng một quân Lính của mình (quân đệm) đứng liền kề, để đáp xuống quân địch ở điểm ngay sau. Ba quân phải nằm trên ba điểm liên tiếp, không có điểm trống nào ở giữa. Bài này: hãy tự tay thực hiện một cú nhảy như thế.",
          en: "In Vietnamese General Check, only the General captures — by jumping over exactly one of its own Soldiers (the screen) standing on the adjacent point, landing on the enemy piece just beyond. The three pieces must stand on three consecutive points with no empty point anywhere in between. In this lesson you will play such a jump yourself.",
        },
        startPos: "4000000000002031010000300",
        startTurn: "r",
        steps: [
          {
            move: "1,4-1,3",
            kind: "show",
            text: {
              vi: "Lính Đỏ tiến một điểm. Nhớ kỹ: Lính không bao giờ ăn quân — chúng chỉ đi, chặn và làm đệm. Trong khi đó, nhìn cột 3: Tướng Đỏ ở (3,3) đã có sẵn một quân đệm là Lính ở (3,4).",
              en: "A Red Soldier steps forward. Remember: Soldiers never capture — they walk, block, and serve as screens. Meanwhile, look at file 3: the Red General on (3,3) already has a screen — the Soldier on (3,4).",
            },
          },
          {
            move: "5,3-5,4",
            kind: "show",
            text: {
              vi: "Xanh tiến Lính lên (5,4)… và vô tình bước vào đúng tầm nhảy: (3,3) – (3,4) – (3,5) là ba điểm liên tiếp trên một đường thẳng.",
              en: "Green steps the Soldier to (5,4)… and walks straight into the jump: (3,3)–(3,4)–(3,5) are three consecutive points on one line.",
            },
          },
          {
            move: "3,3-3,5",
            kind: "quiz",
            quizPrompt: {
              vi: "Tướng Đỏ ăn Lính Xanh ở (3,5)! Tìm nước nhảy ba điểm.",
              en: "The Red General takes the Green Soldier on (3,5)! Find the three-point jump.",
            },
            text: {
              vi: "Chính xác! Tướng – quân đệm – mục tiêu: ba điểm liên tiếp, không một kẽ hở. Tướng nhảy qua Lính của mình ở (3,4) và đáp xuống (3,5).",
              en: "Exactly! General – screen – target: three consecutive points with no gaps. The General jumps over its own Soldier on (3,4) and lands on (3,5).",
            },
          },
        ],
        outro: {
          vi: "Ghi nhớ ba điều kiện của mọi cú ăn quân: (1) điểm kề Tướng phải là Lính của chính mình; (2) điểm ngay sau đó phải là quân địch; (3) ba điểm phải liên tiếp nhau — chỉ cần một điểm trống xen giữa, hoặc hai quân đệm chồng nhau, là không ăn được. Từ giờ, mỗi lần nhìn bàn cờ, hãy tìm các 'bộ ba' như thế.",
          en: "Remember the three conditions of every capture: (1) the point next to the General must be one of its OWN Soldiers; (2) the point right beyond must be an enemy piece; (3) the three points must be consecutive — a single empty point in between, or two screens stacked, and the capture is illegal. From now on, every time you look at the board, hunt for such triples.",
        },
      },
      {
        id: "cct-soldiers-shield",
        title: { vi: "Lính không ăn quân", en: "Soldiers never capture" },
        intro: {
          vi: "Lính là quân duy nhất không thể ăn — nhưng đừng coi thường chúng. Lính là lá chắn che Tướng, là quân đệm cho những cú nhảy, và là những kẻ bịt đường. Ở đây, Xanh đã giăng sẵn bộ ba (3,1)–(3,2)–(3,3) nhắm vào Lính Đỏ ở (3,3). Lính Đỏ không thể ăn lại — nó phải làm gì?",
          en: "The Soldier is the only piece that cannot capture — but never underestimate it. Soldiers are the shields that guard the General, the screens behind every jump, and the blockers that clog lines. Here Green has already lined up the triple (3,1)–(3,2)–(3,3) against the Red Soldier on (3,3). The Red Soldier cannot capture back — so what must it do?",
        },
        startPos: "0043000300001000000002000",
        startTurn: "r",
        steps: [
          {
            move: "3,3-2,3",
            kind: "quiz",
            quizPrompt: {
              vi: "Lính Đỏ ở (3,3) sắp bị ăn mà không thể ăn lại. Chạy nó đến điểm an toàn (2,3)!",
              en: "The Red Soldier on (3,3) is about to be taken and cannot capture back. Run it to the safe point (2,3)!",
            },
            text: {
              vi: "Đúng! Khi không ăn lại được, Lính phải rời khỏi 'bộ ba' của địch. Một quân Lính còn sống để làm đệm vẫn hơn một quân Lính đã bị ăn.",
              en: "Right! When it cannot capture back, the Soldier must leave the enemy's triple. A living Soldier that can serve as a screen beats a captured one.",
            },
          },
          {
            move: "4,1-4,2",
            kind: "show",
            text: {
              vi: "Xanh đành phát triển quân khác — đòn đánh đã tan vì mục tiêu bỏ chạy. Bộ ba chỉ nguy hiểm khi cả ba điểm còn nguyên.",
              en: "Green must develop elsewhere — the attack evaporates because the target ran. A triple is only dangerous while all three points are intact.",
            },
          },
          {
            move: "2,3-3,3",
            kind: "show",
            text: {
              vi: "Và Lính Đỏ trở lại trung tâm. Lính đứng giữa bàn kiểm soát nhiều đường nhất — vừa sẵn sàng làm đệm, vừa bịt các hướng tiến của Tướng địch.",
              en: "And the Red Soldier comes back to the center. A central Soldier controls the most lines — ready to serve as a screen, and clogging the enemy General's paths.",
            },
          },
        ],
        outro: {
          vi: "Ba việc của Lính: (1) làm quân đệm cho Tướng mình — đứng kề Tướng, hướng về mục tiêu; (2) làm lá chắn — đứng trên những điểm Tướng địch muốn dùng; (3) đừng bao giờ đứng yên chịu ăn khi có thể chạy, vì Lính không có nước ăn lại.",
          en: "A Soldier's three jobs: (1) be your General's screen — stand next to the General, pointing at a target; (2) be a shield — stand on points the enemy General wants to use; (3) never stand still to be taken when it can run, because a Soldier has no capture to answer with.",
        },
      },
      {
        id: "cct-center-control",
        title: { vi: "Làm chủ trung tâm", en: "Owning the center" },
        intro: {
          vi: "Điểm (3,3) là điểm duy nhất của bàn cờ tiếp giáp 8 điểm xung quanh — nhiều nhất bàn. Một Tướng đứng giữa trung tâm nhìn ra mọi hướng, và chỉ cần một quân đệm là có ngay đòn đánh. Bài này: đưa Tướng ra trung tâm và xem điều gì xảy ra.",
          en: "Point (3,3) is the only point on the board touching 8 neighbours — more than any other. A General in the center looks in every direction, and needs just one screen to start threatening. In this lesson: bring the General to the center and watch what happens.",
        },
        startPos: "0003030000000140120000000",
        startTurn: "r",
        steps: [
          {
            move: "3,4-3,3",
            kind: "quiz",
            quizPrompt: {
              vi: "Đưa Tướng Đỏ ra điểm trung tâm (3,3)!",
              en: "Bring the Red General to the central point (3,3)!",
            },
            text: {
              vi: "Tướng đã ở trung tâm — và ngay lập tức tạo thành bộ ba (3,3)–(3,4)–(3,5) nhắm thẳng vào Tướng Xanh. Đó là CHIẾU TƯỚNG!",
              en: "The General is centralized — and instantly forms the triple (3,3)–(3,4)–(3,5) aimed straight at the Green General. That's CHECK!",
            },
          },
          {
            move: "5,3-5,2",
            kind: "show",
            text: {
              vi: "Bị chiếu, Xanh không còn lựa chọn nào khác: Tướng phải chạy. Mọi kế hoạch khác đều phải chờ — an toàn của Tướng là trên hết.",
              en: "In check, Green has no choice: the General must run. Every other plan waits — the General's safety comes first.",
            },
          },
          {
            move: "2,4-2,3",
            kind: "show",
            text: {
              vi: "Đỏ không cần đuổi theo. Lính tiến lên chiếm trung tâm — Tướng ở giữa bàn giờ nhìn ra tám hướng, đòn tiếp theo chỉ còn là vấn đề thời gian.",
              en: "Red doesn't chase. The Soldier steps up to claim the center — the centralized General now looks in all eight directions; the next blow is only a matter of time.",
            },
          },
        ],
        outro: {
          vi: "Trung tâm là nơi Tướng mạnh nhất: 8 điểm kề nghĩa là 8 hướng nhảy tiềm năng. Quy tắc vàng: đưa Tướng ra giữa sớm, giữ Lính quanh Tướng để luôn có sẵn quân đệm — và khi Tướng bạn đã ở trung tâm, mỗi nước đi của địch đều phải tính đến các bộ ba của bạn.",
          en: "The center is where the General is strongest: 8 neighbours mean 8 potential jump directions. The golden rule: centralize the General early, keep Soldiers around it so a screen is always ready — and once your General owns the center, every enemy move must reckon with your triples.",
        },
      },
    ],
  },
  {
    id: "cct-attack",
    icon: "⚔️",
    title: { vi: "Tấn công", en: "Attack" },
    subtitle: {
      vi: "Biến quân đệm thành đòn chiếu.",
      en: "Turning screens into checks.",
    },
    lessons: [
      {
        id: "cct-building-check",
        title: { vi: "Dựng thế chiếu", en: "Building a check" },
        intro: {
          vi: "Chiếu tướng nghĩa là: Tướng của bạn + một quân đệm của bạn xếp thẳng hàng hướng về Tướng địch — đe dọa nhảy ăn nó ngay nước sau. Địch buộc phải phá thế. Bài này dạy cách 'trồng' quân đệm: đưa một Lính đến đứng kề Tướng mình, đúng trên đường nhắm vào Tướng địch.",
          en: "Check means: your General + one of your screens lined up toward the enemy General — threatening to jump-capture it on the next move. The enemy must break it. This lesson teaches how to 'plant' a screen: move a Soldier next to your General, exactly on the line aiming at the enemy General.",
        },
        startPos: "0000031000002000000100004",
        startTurn: "r",
        steps: [
          {
            move: "5,4-4,4",
            kind: "quiz",
            quizPrompt: {
              vi: "Trồng quân đệm! Đưa Lính Đỏ từ (5,4) đến (4,4) — kề Tướng Đỏ và thẳng hàng với Tướng Xanh ở (5,5).",
              en: "Plant the screen! Move the Red Soldier from (5,4) to (4,4) — next to the Red General and lined up with the Green General on (5,5).",
            },
            text: {
              vi: "Hoàn hảo! Lính đã đứng kề Tướng Đỏ trên đường chéo nhắm thẳng Tướng Xanh ở (5,5) — bộ ba (3,3)–(4,4)–(5,5) hoàn thành. Đó là CHIẾU TƯỚNG!",
              en: "Perfect! The Soldier now stands next to the Red General on the diagonal aimed straight at the Green General on (5,5) — the triple (3,3)–(4,4)–(5,5) is complete. That's CHECK!",
            },
          },
          {
            move: "5,5-4,5",
            kind: "show",
            text: {
              vi: "Bị chiếu, Tướng Xanh phải rời khỏi đường chéo — (4,5) là điểm an toàn gần nhất. Chú ý: Xanh không thể 'chặn' nước chiếu như cờ vua, vì ba điểm của bộ ba liền nhau, không có kẽ hở để chen quân vào.",
              en: "In check, the Green General must leave the diagonal — (4,5) is the nearest safe point. Note: unlike chess, Green cannot 'block' the check, because the triple's three points are consecutive, with no gap to interpose into.",
            },
          },
          {
            move: "2,2-2,3",
            kind: "show",
            text: {
              vi: "Đỏ ung dung phát triển: Lính tiến về trung tâm, sẵn sàng làm quân đệm cho đòn tiếp theo. Thế chiếu đầu tiên có thể chưa ăn được quân, nhưng nó ép địch phải chạy và cho bạn thêm một nước miễn phí.",
              en: "Red develops calmly: the Soldier steps toward the center, ready to screen the next blow. The first check may not win material, but it forces the enemy to run and gives you a free move.",
            },
          },
        ],
        outro: {
          vi: "Công thức dựng chiếu: (1) xác định đường từ Tướng bạn đến Tướng địch (ngang, dọc hoặc chéo); (2) đưa một Lính của bạn đến điểm kề Tướng bạn trên đường đó — đó chính là 'trồng đệm'; (3) ra đòn. Và nhớ điểm khác biệt lớn với cờ vua: đã bị chiếu thì chỉ có chạy Tướng — không thể chặn, vì bộ ba không có kẽ hở.",
          en: "The check-building recipe: (1) find the line from your General to the enemy General (orthogonal or diagonal); (2) bring one of your Soldiers to the point next to your General on that line — that's 'planting the screen'; (3) strike. And remember the big difference from chess: in check, the General must run — there is no blocking, because a triple has no gaps.",
        },
      },
      {
        id: "cct-double-threat",
        title: { vi: "Đánh đôi", en: "The double attack" },
        intro: {
          vi: "Một Tướng có hai quân đệm ở hai hướng là một cỗ máy đánh đôi: nó đồng thời đe dọa hai quân địch, mà đối phương mỗi nước chỉ cứu được một. Ở đây Tướng Đỏ đang chĩa hai bộ ba vào hai Lính Xanh — hãy ăn một, và xem Xanh bất lực thế nào với quân còn lại.",
          en: "A General with two screens in two directions is a forking machine: it threatens two enemy pieces at once, and the defender can only save one per move. Here the Red General aims two triples at two Green Soldiers — take one, and watch Green helpless over the other.",
        },
        startPos: "0000000000002130010040300",
        startTurn: "r",
        steps: [
          {
            move: "3,3-3,5",
            kind: "quiz",
            quizPrompt: {
              vi: "Ăn một Lính Xanh! Tướng Đỏ có hai bộ ba: (3,3)–(3,4)–(3,5) và (3,3)–(4,3)–(5,3). Chọn một — Xanh không cứu nổi cả hai.",
              en: "Take a Green Soldier! The Red General has two triples: (3,3)–(3,4)–(3,5) and (3,3)–(4,3)–(5,3). Pick one — Green cannot save both.",
            },
            text: {
              vi: "Một quân đã nằm trong tay! Xanh giờ phải chọn: cứu Lính còn lại hay lo việc khác — nhưng cứu được một thì cũng đã mất một.",
              en: "One piece in the bag! Green must now choose: save the remaining Soldier or attend to something else — but saving one still means losing one.",
            },
          },
          {
            move: "5,3-5,4",
            kind: "show",
            text: {
              vi: "Xanh vội rút Lính (5,3) khỏi đường nguy hiểm. Đúng đắn — nhưng cái giá là một quân Lính. Đó chính là sức mạnh của đòn đánh đôi: bạn luôn được 'ăn chắc' một quân.",
              en: "Green hurriedly pulls the (5,3) Soldier off the dangerous line. Correct — but the price is one Soldier. That is the power of the double attack: you always bank one piece for sure.",
            },
          },
        ],
        outro: {
          vi: "Khi Tướng bạn có từ hai quân đệm trở lên hướng về các mục tiêu khác nhau, hãy đếm số mối đe dọa thay vì đếm quân: hai mối đe dọa, một nước đáp — địch luôn mất một quân. Mẹo thực chiến: đừng vội ăn ngay khi dựng được thế đánh đôi; đôi khi giữ nguyên thế đe dọa còn đáng sợ hơn, vì địch mỗi nước đều phải tìm cách đối phó.",
          en: "When your General has two or more screens pointing at different targets, count threats instead of pieces: two threats, one reply — the defender always loses a piece. A practical tip: don't always capture the moment the fork is set; sometimes keeping the threats hanging is scarier, because the defender must answer them every single move.",
        },
      },
    ],
  },
  {
    id: "cct-defense",
    icon: "🛡️",
    title: { vi: "Phòng thủ", en: "Defense" },
    subtitle: {
      vi: "Bị chiếu không có nghĩa là thua — nếu biết cách gỡ.",
      en: "Being in check doesn't mean losing — if you know how to get out.",
    },
    lessons: [
      {
        id: "cct-break-check",
        title: { vi: "Chạy Tướng", en: "The General must run" },
        intro: {
          vi: "Đây là luật sắt của Cờ Chiếu Tướng: khi bị chiếu, bạn BẮT BUỘC phải thoát chiếu — và vì bộ ba gồm ba điểm liên tiếp không kẽ hở, không có cách 'chặn' như cờ vua, cũng không thể ăn lại quân đệm đang kề sát Tướng bạn. Lựa chọn duy nhất: Tướng chạy đến điểm an toàn. Ở đây Tướng Đỏ đang bị chiếu bởi bộ ba (3,1)–(3,2)–(3,3); bảy điểm xung quanh đều đã bị bịt — chỉ còn một lối thoát.",
          en: "This is the iron rule of Vietnamese General Check: in check you MUST get out — and because a triple is three consecutive points with no gaps, there is no blocking as in chess, and the adjacent screen cannot be captured back. The only option: the General runs to a safe point. Here the Red General is in check from the triple (3,1)–(3,2)–(3,3); seven surrounding points are sealed — only one escape remains.",
        },
        startPos: "0040003330032301303100000",
        startTurn: "r",
        steps: [
          {
            move: "3,3-3,4",
            kind: "quiz",
            quizPrompt: {
              vi: "Bị chiếu! Tìm lối thoát duy nhất của Tướng Đỏ — mọi nước đi khác đều bất hợp lệ vì không phá được thế chiếu.",
              en: "Check! Find the Red General's only escape — every other move is illegal because it doesn't break the check.",
            },
            text: {
              vi: "Thoát! (3,4) nằm ngoài đường chiếu và không bị đe dọa. Chú ý: hai Lính Đỏ ở xa dù đi đâu cũng không cứu được Tướng — khi bị chiếu, chỉ nước đi của Tướng mới có thể hợp lệ.",
              en: "Escaped! (3,4) is off the checking line and safe. Note: the two far Red Soldiers cannot save the General wherever they go — in check, only the General's moves can be legal.",
            },
          },
          {
            move: "2,3-1,3",
            kind: "show",
            text: {
              vi: "Xanh siết vòng vây — nhưng Tướng Đỏ đã thoát ra ngoài. Một nước chiếu không bắt được Tướng thì chỉ còn là một nước đi bình thường.",
              en: "Green tightens the net — but the Red General is already out. A check that doesn't get the General is just an ordinary move.",
            },
          },
        ],
        outro: {
          vi: "Khắc cốt ghi tâm: (1) bị chiếu là phải lo Tướng trước mọi kế hoạch khác; (2) không bao giờ có chuyện 'chặn chiếu' — bộ ba liền nhau không có chỗ chen; (3) khi chạy, hãy chạy đến điểm mà Tướng địch không còn chĩa được bộ ba nào vào — chạy từ chảo lửa này sang chảo lửa khác thì bằng không.",
          en: "Burn this in: (1) in check, the General comes before every other plan; (2) there is no such thing as 'blocking a check' — a consecutive triple has no room to interpose; (3) when running, run to a point where the enemy General aims no triple — fleeing one fire into another is no escape.",
        },
      },
      {
        id: "cct-counter-screen",
        title: { vi: "Ăn lại quân đệm", en: "Capturing the screen" },
        intro: {
          vi: "Quân đệm của địch càng tiến sâu càng nguy hiểm — nhưng cũng càng dễ tổn thương, vì nó đứng xa sự che chở. Ở đây Xanh đã đẩy Lính lên (3,2) làm đệm, đe dọa Lính Đỏ ở (3,3). Nhưng hãy nhìn kỹ: bộ ba (3,4)–(3,3)–(3,2) — Tướng Đỏ, Lính Đỏ, Lính Xanh — cũng là một bộ ba hoàn chỉnh! Quân đệm của địch chính là con mồi.",
          en: "The deeper the enemy pushes its screen, the more dangerous — and the more vulnerable, far from protection. Here Green has pushed a Soldier to (3,2) as a screen, threatening the Red Soldier on (3,3). But look closely: the triple (3,4)–(3,3)–(3,2) — Red General, Red Soldier, Green Soldier — is itself a complete triple! The enemy's screen is the prey.",
        },
        startPos: "0040300303001000020000000",
        startTurn: "r",
        steps: [
          {
            move: "3,4-3,2",
            kind: "quiz",
            quizPrompt: {
              vi: "Ăn quân đệm của địch! Tướng Đỏ nhảy qua Lính mình ở (3,3) để ăn Lính Xanh ở (3,2).",
              en: "Capture the enemy's screen! The Red General jumps over its own Soldier on (3,3) to take the Green Soldier on (3,2).",
            },
            text: {
              vi: "Tuyệt vời! Đòn đánh của Xanh tan thành mây khói — mất quân đệm thì Tướng Xanh chẳng còn đe dọa được ai. Đây là cách phòng thủ sắc bén nhất: không chạy, mà phản đòn.",
              en: "Brilliant! Green's attack evaporates — with its screen captured, the Green General threatens no one. This is the sharpest defense: not running, but counterstriking.",
            },
          },
          {
            move: "3,1-4,1",
            kind: "show",
            text: {
              vi: "Tướng Xanh buộc phải lùi — đứng kề một Tướng địch vừa tiến sâu là tự sát. Thế trận đã đảo chiều.",
              en: "The Green General must retreat — standing next to an advanced enemy General is suicide. The tables have turned.",
            },
          },
          {
            move: "3,2-2,2",
            kind: "show",
            text: {
              vi: "Tướng Đỏ củng cố vị trí: lùi một bước về nơi an toàn, giữ Lính (3,3) làm đệm cho những đòn sau. Ăn được quân đã khó — giữ được thế còn khó hơn.",
              en: "The Red General consolidates: a step back to safety, keeping the (3,3) Soldier as a screen for later blows. Capturing is hard — keeping the initiative is harder.",
            },
          },
        ],
        outro: {
          vi: "Bài học phòng thủ: đừng chỉ nhìn xem địch đe dọa quân nào — hãy nhìn xem quân đệm của địch có được bảo vệ không. Một quân đệm tiến sâu mà không có ai che chắn chính là một quân cho không. Và nhớ: Tướng ăn quân đệm xong thường đứng sâu trong lãnh địa địch — hãy tính sẵn đường về.",
          en: "The defensive lesson: don't just watch which piece the enemy threatens — watch whether the enemy's screen is protected. A deep screen with no cover is a free piece. And remember: after the General captures a screen it usually stands deep in enemy territory — always plan the way back.",
        },
      },
    ],
  },
  {
    id: "cct-endgames",
    icon: "🏁",
    title: { vi: "Tàn cuộc", en: "Endgames" },
    subtitle: {
      vi: "Thắng không cần chiếu tướng.",
      en: "Winning without check.",
    },
    lessons: [
      {
        id: "cct-stalemate-squeeze",
        title: { vi: "Bí nước", en: "The squeeze" },
        intro: {
          vi: "Trong Cờ Chiếu Tướng, hết nước đi là thua — ngay cả khi Tướng không bị chiếu! Đó là 'bí nước', và nó là vũ khí tàn cuộc đáng sợ nhất: bạn không cần ăn Tướng địch, chỉ cần bịt mọi điểm nó có thể đi và mọi nước đi của Lính nó. Ở đây, Tướng Xanh ở (2,1) sắp bị lùa vào góc (1,1) — nơi Đỏ đã giăng sẵn vòng vây.",
          en: "In Vietnamese General Check, having no legal moves is a loss — even when the General is NOT in check! That's 'bí nước' (stalemate), and it's the most feared endgame weapon: you don't need to capture the enemy General, just seal every point it could go to and every Soldier move it has. Here the Green General on (2,1) is about to be herded into the (1,1) corner — where Red's net is already waiting.",
        },
        startPos: "0410011100000000000000002",
        startTurn: "r",
        steps: [
          {
            move: "3,2-3,3",
            kind: "show",
            text: {
              vi: "Đỏ siết thêm một vòng: Lính (3,2) tiến lên (3,3), bịt nốt đường chéo. Tướng Xanh ở (2,1) giờ chỉ còn đúng một điểm để đi: góc (1,1).",
              en: "Red tightens the net: the (3,2) Soldier steps to (3,3), sealing the last diagonal. The Green General on (2,1) has exactly one square left: the (1,1) corner.",
            },
          },
          {
            move: "2,1-1,1",
            kind: "show",
            text: {
              vi: "Xanh không còn lựa chọn nào — Tướng lùi vào góc, đúng như Đỏ sắp đặt. Nhưng hãy nhìn quanh (1,1): ba điểm kề đã có chủ.",
              en: "Green has no choice — the General backs into the corner, exactly as Red planned. But look around (1,1): all three neighbouring points are taken.",
            },
          },
          {
            move: "3,1-2,1",
            kind: "quiz",
            quizPrompt: {
              vi: "Bịt nốt điểm cuối! Đưa Lính Đỏ từ (3,1) đến (2,1) — Tướng Xanh sẽ không còn nước đi nào.",
              en: "Seal the final point! Bring the Red Soldier from (3,1) to (2,1) — the Green General will have no moves left.",
            },
            text: {
              vi: "BÍ NƯỚC! Tướng Xanh còn nguyên mà không đi được đâu — cả ba điểm quanh (1,1) đều bị Lính Đỏ chiếm. Hết nước là thua: Đỏ thắng!",
              en: "STALEMATE! The Green General is intact but cannot move anywhere — Red Soldiers hold all three points around (1,1). No moves is a loss: Red wins!",
            },
          },
        ],
        outro: {
          vi: "Đây là cách thắng tàn cuộc kinh điển: (1) dồn Tướng địch vào góc hoặc cạnh bàn; (2) dùng Lính bịt từng điểm xung quanh nó; (3) nước cuối cùng bịt điểm thở cuối. Không cần chiếu, không cần ăn — chỉ cần kiên nhẫn. Và khi bạn là người bị vây: hãy luôn chừa cho Tướng mình một 'cửa hậu', đừng để bị dồn vào góc khi Lính đã hết.",
          en: "This is the classic endgame win: (1) drive the enemy General into a corner or edge; (2) use Soldiers to seal each surrounding point; (3) the final move seals the last breathing point. No check, no capture — just patience. And when YOU are the one surrounded: always keep a 'back door' for your General; never let yourself be cornered once the Soldiers are gone.",
        },
        terminalClaim: "stalemate",
      },
      {
        id: "cct-no-screens-draw",
        title: { vi: "Khi nào hòa", en: "When it's a draw" },
        intro: {
          vi: "Luật hòa của Cờ Chiếu Tướng rất đặc biệt: khi CẢ HAI bên đều không còn Lính — không còn quân đệm, không ai có thể ăn ai nữa — ván cờ hòa ngay lập tức. Ở đây Xanh chỉ còn đúng một Lính ở (3,5). Đỏ đi trước: hãy lấy nốt quân Lính cuối cùng đó, và xem thế cờ biến thành gì.",
          en: "The draw rule of Vietnamese General Check is special: the moment BOTH sides have no Soldiers left — no screens, nobody can capture anyone anymore — the game is drawn at once. Here Green has exactly one Soldier left on (3,5). Red to move: take that last Soldier, and see what the position becomes.",
        },
        startPos: "4000000000002000010000300",
        startTurn: "r",
        steps: [
          {
            move: "3,3-3,5",
            kind: "quiz",
            quizPrompt: {
              vi: "Ăn quân Lính cuối cùng của Xanh! Bộ ba (3,3)–(3,4)–(3,5) đã sẵn sàng.",
              en: "Take Green's last Soldier! The triple (3,3)–(3,4)–(3,5) is ready.",
            },
            text: {
              vi: "Xong! Xanh không còn một quân Lính nào — nghĩa là Xanh không bao giờ còn ăn được quân nữa. Nhưng Đỏ vẫn còn Lính (3,4): mọi đòn đánh từ giờ đều thuộc về Đỏ.",
              en: "Done! Green has no Soldier left — meaning Green can never capture again. But Red still has the (3,4) Soldier: every threat from now on belongs to Red.",
            },
          },
          {
            move: "1,1-1,2",
            kind: "show",
            text: {
              vi: "Tướng Xanh đơn độc chỉ còn biết chạy. Không có Lính thì không có quân đệm — mà không có quân đệm thì Tướng dù đứng đâu cũng chỉ là một quân đi bộ.",
              en: "The lone Green General can only run. No Soldiers means no screens — and without screens a General, wherever it stands, is just a walking piece.",
            },
          },
          {
            move: "3,4-4,4",
            kind: "show",
            text: {
              vi: "Đỏ siết chặt: Lính tiến lên chiếm điểm trung tâm hàng 4, Tướng ở (3,5) sẵn sàng ập vào. Tướng Xanh đơn độc khó thoát khỏi vòng vây đang khép dần.",
              en: "Red tightens the net: the Soldier advances to a central outpost while the General on (3,5) looms. The lone Green General won't escape the closing net.",
            },
          },
        ],
        outro: {
          vi: "Và đây là điều cần phán đoán: ván cờ chỉ hòa khi CẢ HAI Tướng đều đơn độc — lúc đó hòa ngay, không cần đi tiếp. Còn khi bạn giữ được quân Lính cuối cùng mà địch thì không, bạn không hòa — bạn thắng, chỉ là vấn đề kỹ thuật săn Tướng đơn độc. Ngược lại, nếu bạn là bên sắp mất Lính cuối: hãy hiểu rằng từ giây phút đó, bạn chỉ còn phòng thủ.",
          en: "And here is the judgment call: the game is drawn only when BOTH Generals stand alone — then it's an instant draw, no more play needed. But when you keep the last Soldier and the enemy doesn't, you don't draw — you win; it's only a matter of lone-General hunting technique. Conversely, if you are about to lose your last Soldier: understand that from that moment on, you are only defending.",
        },
      },
    ],
  },
];
