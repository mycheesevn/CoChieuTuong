// Bilingual Terms of Service / Privacy Policy content (English / Vietnamese).
// Ported from the sibling games; adapted for Cờ Chiếu Tướng
// (Vietnamese General Check).

import type { Lang } from "./i18n";

export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalDoc {
  title: string;
  updated: string;
  intro: string[];
  sections: LegalSection[];
  back: string;
}

const CONTACT_EN =
  "If you have questions about these terms, you can reach the developer through the project's GitHub repository (mycheesevn/CoChieuTuong).";
const CONTACT_VI =
  "Nếu bạn có thắc mắc về các điều khoản này, bạn có thể liên hệ với nhà phát triển qua kho GitHub của dự án (mycheesevn/CoChieuTuong).";

const GAME_EN = "Cờ Chiếu Tướng (Vietnamese General Check)";
const GAME_VI = "Cờ Chiếu Tướng";

export const TERMS: Record<Lang, LegalDoc> = {
  en: {
    title: "Terms of Service",
    updated: "Last updated: October 14, 2026",
    back: "← Back to game",
    intro: [
      `Welcome to our ${GAME_EN} game. By accessing or using this website, you agree to these Terms of Service. If you do not agree, please do not use the service.`,
    ],
    sections: [
      {
        heading: "1. The Service",
        body: [
          "We provide a free folk strategy board game you can play against the computer (12 difficulty levels), with a friend locally, in real-time rooms, by correspondence, plus daily puzzles, community puzzles, an interactive playbook (Bí Kíp), a custom position setup editor, and cloud-saved game history for registered users. The service is provided for personal, non-commercial entertainment.",
        ],
      },
      {
        heading: "2. Accounts",
        body: [
          "You may play without an account. To save games to the cloud and sync progress across devices, you can create an account with an email address and password, or sign in with Google or Facebook.",
          "You are responsible for keeping your login credentials confidential and for all activity under your account. You must provide accurate information when registering and be at least 13 years old (or the minimum age required in your country).",
        ],
      },
      {
        heading: "3. Acceptable Use",
        body: [
          "You agree not to: disrupt or abuse the service; attempt to gain unauthorized access to other users' data; use bots or scrapers that degrade the service; or use the service for any unlawful purpose.",
          "In multiplayer rooms and community features, keep chat and published puzzles respectful and do not post spam or harmful content. Room leaders may remove disruptive members.",
        ],
      },
      {
        heading: "4. Your Game Data",
        body: [
          "Saved games, move histories, results, lesson and puzzle progress associated with your account are stored so you can access them across devices. You can delete individual saved games at any time from the History tab.",
          "We may remove accounts or data that violate these terms or that have been inactive for an extended period.",
        ],
      },
      {
        heading: "5. Intellectual Property",
        body: [
          "The game's design, code, graphics, and sounds are owned by the developer and protected by applicable laws. You may not copy, redistribute, or create derivative works of the service without permission.",
          "Your own game records (the moves you played) and puzzles you publish remain yours; by using cloud saves you grant us the limited right to store and display them back to you.",
        ],
      },
      {
        heading: "6. Third-Party Services",
        body: [
          "The service relies on third parties such as Supabase (database and authentication), Google and Facebook (social sign-in), and Vercel (hosting). Your use of social sign-in is also subject to those providers' terms.",
        ],
      },
      {
        heading: "7. Disclaimer",
        body: [
          "The service is provided 'as is' without warranties of any kind. Computer opponent difficulty levels are approximate and engine evaluations are heuristic — they may occasionally be wrong. We do not guarantee uninterrupted or error-free operation.",
        ],
      },
      {
        heading: "8. Limitation of Liability",
        body: [
          "To the maximum extent permitted by law, the developer is not liable for any indirect, incidental, or consequential damages arising from your use of the service.",
        ],
      },
      {
        heading: "9. Changes",
        body: [
          "We may update these terms from time to time. Continued use of the service after changes take effect constitutes acceptance of the new terms.",
        ],
      },
      {
        heading: "10. Contact",
        body: [CONTACT_EN],
      },
    ],
  },
  vi: {
    title: "Điều khoản sử dụng",
    updated: "Cập nhật lần cuối: 14 tháng 10, 2026",
    back: "← Về trang game",
    intro: [
      `Chào mừng bạn đến với trò chơi ${GAME_VI}. Khi truy cập hoặc sử dụng website này, bạn đồng ý với các Điều khoản sử dụng dưới đây. Nếu không đồng ý, vui lòng không sử dụng dịch vụ.`,
    ],
    sections: [
      {
        heading: "1. Dịch vụ",
        body: [
          "Chúng tôi cung cấp trò chơi cờ dân gian miễn phí để bạn chơi với máy tính (12 cấp độ), chơi 2 người tại chỗ, đấu trong phòng theo thời gian thực, đánh cờ thư, cùng với thế cờ hằng ngày, câu đố cộng đồng, Bí Kíp tương tác, trình xếp quân tùy ý và lưu lịch sử ván đấu trên đám mây cho người dùng đã đăng ký. Dịch vụ được cung cấp cho mục đích giải trí cá nhân, phi thương mại.",
        ],
      },
      {
        heading: "2. Tài khoản",
        body: [
          "Bạn có thể chơi mà không cần tài khoản. Để lưu ván cờ trên đám mây và đồng bộ tiến trình giữa các thiết bị, bạn có thể tạo tài khoản bằng email và mật khẩu, hoặc đăng nhập bằng Google hay Facebook.",
          "Bạn có trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động dưới tài khoản của mình. Bạn phải cung cấp thông tin chính xác khi đăng ký và từ đủ 13 tuổi trở lên (hoặc độ tuổi tối thiểu theo quy định tại quốc gia của bạn).",
        ],
      },
      {
        heading: "3. Sử dụng hợp lệ",
        body: [
          "Bạn đồng ý không: phá hoại hoặc lạm dụng dịch vụ; cố truy cập trái phép dữ liệu của người dùng khác; dùng bot hoặc công cụ quét dữ liệu làm ảnh hưởng dịch vụ; hoặc dùng dịch vụ cho mục đích bất hợp pháp.",
          "Trong phòng chơi và các tính năng cộng đồng, hãy giữ bình luận và câu đố đã đăng văn minh, không đăng nội dung rác hoặc gây hại. Chủ phòng có thể đuổi thành viên gây rối.",
        ],
      },
      {
        heading: "4. Dữ liệu ván cờ của bạn",
        body: [
          "Các ván cờ đã lưu, lịch sử nước đi, kết quả, tiến trình bài học và câu đố gắn với tài khoản của bạn được lưu trữ để bạn truy cập trên nhiều thiết bị. Bạn có thể xóa từng ván cờ đã lưu bất cứ lúc nào trong tab Lịch sử.",
          "Chúng tôi có thể xóa các tài khoản hoặc dữ liệu vi phạm điều khoản này hoặc không hoạt động trong thời gian dài.",
        ],
      },
      {
        heading: "5. Sở hữu trí tuệ",
        body: [
          "Thiết kế, mã nguồn, đồ họa và âm thanh của trò chơi thuộc sở hữu của nhà phát triển và được pháp luật bảo vệ. Bạn không được sao chép, phân phối lại hoặc tạo sản phẩm phái sinh từ dịch vụ nếu không được cho phép.",
          "Hồ sơ ván cờ (các nước đi bạn đã đánh) và câu đố bạn đăng vẫn thuộc về bạn; khi dùng lưu trữ đám mây, bạn cấp cho chúng tôi quyền hạn chế để lưu trữ và hiển thị lại chúng cho bạn.",
        ],
      },
      {
        heading: "6. Dịch vụ bên thứ ba",
        body: [
          "Dịch vụ sử dụng các bên thứ ba như Supabase (cơ sở dữ liệu và xác thực), Google và Facebook (đăng nhập mạng xã hội), Vercel (lưu trữ web). Việc bạn dùng đăng nhập mạng xã hội cũng tuân theo điều khoản của các nhà cung cấp đó.",
        ],
      },
      {
        heading: "7. Tuyên bố miễn trừ",
        body: [
          "Dịch vụ được cung cấp 'nguyên trạng' mà không có bất kỳ bảo đảm nào. Các cấp độ khó của máy chỉ mang tính tương đối và đánh giá của engine chỉ là heuristic — đôi khi có thể không chính xác. Chúng tôi không đảm bảo dịch vụ hoạt động liên tục và không lỗi.",
        ],
      },
      {
        heading: "8. Giới hạn trách nhiệm",
        body: [
          "Trong phạm vi tối đa pháp luật cho phép, nhà phát triển không chịu trách nhiệm với bất kỳ thiệt hại gián tiếp, ngẫu nhiên hoặc hệ quả nào phát sinh từ việc bạn sử dụng dịch vụ.",
        ],
      },
      {
        heading: "9. Thay đổi điều khoản",
        body: [
          "Chúng tôi có thể cập nhật các điều khoản này theo thời gian. Việc tiếp tục sử dụng dịch vụ sau khi thay đổi có hiệu lực được coi là bạn chấp nhận điều khoản mới.",
        ],
      },
      {
        heading: "10. Liên hệ",
        body: [CONTACT_VI],
      },
    ],
  },
};

export const PRIVACY: Record<Lang, LegalDoc> = {
  en: {
    title: "Privacy Policy",
    updated: "Last updated: October 14, 2026",
    back: "← Back to game",
    intro: [
      `This Privacy Policy explains what data we collect when you use our ${GAME_EN} game and how we use it.`,
    ],
    sections: [
      {
        heading: "1. Data We Collect",
        body: [
          "Account data: if you register, we store your email address and an encrypted password, or the basic profile information (name, email) provided by Google or Facebook when you use social sign-in.",
          "Game data: saved games (moves, results, settings such as difficulty level), lesson and daily puzzle progress, rooms, challenges, and correspondence games linked to your account.",
          "Device preferences: language choice, sound on/off, stored locally in your browser (localStorage) and never sent to our servers.",
          "We do not collect your precise location, contacts, or any data unrelated to the game.",
        ],
      },
      {
        heading: "2. How We Use Your Data",
        body: [
          "We use your data only to operate the service: authenticating you, saving and syncing your games and progress across devices, and remembering your preferences.",
          "We do not sell your data, show third-party ads, or use your data for advertising.",
        ],
      },
      {
        heading: "3. Third Parties",
        body: [
          "Supabase hosts our database and authentication — your account and game data are stored on Supabase infrastructure.",
          "Google and Facebook are used solely as sign-in providers; we receive only the basic profile data needed to create your account.",
          "Vercel hosts this website and may process standard technical logs (such as IP addresses) to deliver the pages.",
        ],
      },
      {
        heading: "4. Data Retention and Deletion",
        body: [
          "You can delete individual saved games at any time in the History tab. If you want your account and all associated data deleted, contact the developer (see below) and we will remove it.",
          "We retain data only for as long as needed to provide the service.",
        ],
      },
      {
        heading: "5. Security",
        body: [
          "Passwords are stored encrypted, connections use HTTPS, and database access is restricted so users can only read and modify their own data. No system is perfectly secure, but we take reasonable measures to protect your information.",
        ],
      },
      {
        heading: "6. Children",
        body: [
          "The service is not directed at children under 13. If you believe a child has provided us personal data, contact us and we will delete it.",
        ],
      },
      {
        heading: "7. Changes",
        body: [
          "We may update this policy from time to time. Continued use of the service after changes take effect constitutes acceptance of the new policy.",
        ],
      },
      {
        heading: "8. Contact",
        body: [CONTACT_EN],
      },
    ],
  },
  vi: {
    title: "Chính sách bảo mật",
    updated: "Cập nhật lần cuối: 14 tháng 10, 2026",
    back: "← Về trang game",
    intro: [
      `Chính sách bảo mật này giải thích dữ liệu nào chúng tôi thu thập khi bạn chơi ${GAME_VI} và cách chúng tôi sử dụng chúng.`,
    ],
    sections: [
      {
        heading: "1. Dữ liệu chúng tôi thu thập",
        body: [
          "Dữ liệu tài khoản: nếu bạn đăng ký, chúng tôi lưu địa chỉ email và mật khẩu đã mã hóa, hoặc thông tin hồ sơ cơ bản (tên, email) do Google hoặc Facebook cung cấp khi bạn đăng nhập mạng xã hội.",
          "Dữ liệu ván cờ: các ván cờ đã lưu (nước đi, kết quả, cài đặt như cấp độ khó), tiến trình bài học và thế cờ hằng ngày, phòng chơi, thách đấu và ván cờ thư gắn với tài khoản của bạn.",
          "Tùy chọn trên thiết bị: ngôn ngữ, bật/tắt âm thanh, được lưu trong trình duyệt của bạn (localStorage) và không bao giờ gửi về máy chủ của chúng tôi.",
          "Chúng tôi không thu thập vị trí chính xác, danh bạ hay bất kỳ dữ liệu nào không liên quan đến trò chơi.",
        ],
      },
      {
        heading: "2. Cách chúng tôi dùng dữ liệu",
        body: [
          "Chúng tôi chỉ dùng dữ liệu của bạn để vận hành dịch vụ: xác thực, lưu và đồng bộ ván cờ cùng tiến trình giữa các thiết bị, và ghi nhớ tùy chọn của bạn.",
          "Chúng tôi không bán dữ liệu của bạn, không hiển thị quảng cáo của bên thứ ba và không dùng dữ liệu của bạn cho quảng cáo.",
        ],
      },
      {
        heading: "3. Bên thứ ba",
        body: [
          "Supabase lưu trữ cơ sở dữ liệu và hệ thống xác thực — tài khoản và dữ liệu ván cờ của bạn được lưu trên hạ tầng của Supabase.",
          "Google và Facebook chỉ được dùng làm nhà cung cấp đăng nhập; chúng tôi chỉ nhận thông tin hồ sơ cơ bản cần thiết để tạo tài khoản cho bạn.",
          "Vercel lưu trữ website này và có thể xử lý các nhật ký kỹ thuật tiêu chuẩn (như địa chỉ IP) để phân phối trang web.",
        ],
      },
      {
        heading: "4. Lưu trữ và xóa dữ liệu",
        body: [
          "Bạn có thể xóa từng ván cờ đã lưu bất cứ lúc nào trong tab Lịch sử. Nếu muốn xóa tài khoản và toàn bộ dữ liệu liên quan, hãy liên hệ với nhà phát triển (xem bên dưới) và chúng tôi sẽ xóa chúng.",
          "Chúng tôi chỉ lưu giữ dữ liệu trong thời gian cần thiết để cung cấp dịch vụ.",
        ],
      },
      {
        heading: "5. Bảo mật",
        body: [
          "Mật khẩu được lưu trữ đã mã hóa, kết nối dùng HTTPS, và quyền truy cập cơ sở dữ liệu bị giới hạn để người dùng chỉ đọc và sửa dữ liệu của chính mình. Không hệ thống nào an toàn tuyệt đối, nhưng chúng tôi áp dụng các biện pháp hợp lý để bảo vệ thông tin của bạn.",
        ],
      },
      {
        heading: "6. Trẻ em",
        body: [
          "Dịch vụ không hướng đến trẻ em dưới 13 tuổi. Nếu bạn cho rằng một trẻ em đã cung cấp dữ liệu cá nhân cho chúng tôi, hãy liên hệ và chúng tôi sẽ xóa dữ liệu đó.",
        ],
      },
      {
        heading: "7. Thay đổi chính sách",
        body: [
          "Chúng tôi có thể cập nhật chính sách này theo thời gian. Việc tiếp tục sử dụng dịch vụ sau khi thay đổi có hiệu lực được coi là bạn chấp nhận chính sách mới.",
        ],
      },
      {
        heading: "8. Liên hệ",
        body: [CONTACT_VI],
      },
    ],
  },
};
