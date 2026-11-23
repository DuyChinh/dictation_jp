export const SITE_ORIGIN = "https://kaitiq.vn";
const SITE_NAME = "Kaitiq";

export interface PageMeta {
  title: string;
  description: string;
  /** Pages for people who are signed in or working on something private are kept out of search results. */
  noindex?: boolean;
}

const HOME: PageMeta = {
  title: "Kaitiq: luyện thi JLPT bằng đề thật, từ điển và flashcard",
  description:
    "Luyện thi JLPT N5 đến N1 bằng đề thật: nghe hiểu, từ vựng, ngữ pháp, đọc hiểu. Giải thích cả 4 đáp án, có bản dịch tiếng Việt từng câu, kèm từ điển và flashcard.",
};

const PAGES: Record<string, PageMeta> = {
  "/": HOME,
  "/lessons": {
    title: "Thư viện đề thi JLPT có đáp án và giải thích | Kaitiq",
    description:
      "Đề thi JLPT các cấp N5, N4, N3, N2, N1 theo từng kỳ thi: phần nghe, từ vựng, ngữ pháp, đọc hiểu. Có đáp án, giải thích từng đáp án và bản dịch tiếng Việt.",
  },
  "/exams": {
    title: "Phòng thi thử JLPT: làm bài tính giờ, chấm điểm ngay | Kaitiq",
    description: "Thi thử JLPT như thi thật: bấm giờ theo từng phần, chấm điểm và xem lại câu sai ngay sau khi nộp bài.",
  },
  "/dictionary": {
    title: "Từ điển Nhật - Việt: tra từ, Kanji, cấp độ JLPT | Kaitiq",
    description:
      "Tra từ tiếng Nhật ra nghĩa tiếng Việt, kèm cách đọc, Kanji, cấp độ JLPT và ví dụ. Lưu từ vào flashcard chỉ với một lần bấm.",
  },
  "/flashcards": {
    title: "Flashcard học từ vựng tiếng Nhật: ôn tập, trò chơi | Kaitiq",
    description:
      "Tạo bộ flashcard từ vựng tiếng Nhật, ôn bằng thẻ lật, trắc nghiệm, bài kiểm tra và các trò chơi như đào vàng, ai là triệu phú.",
  },
  "/leaderboard": {
    title: "Bảng xếp hạng người học | Kaitiq",
    description: "Bảng xếp hạng những người học chăm chỉ nhất trên Kaitiq.",
  },
  "/pricing": {
    title: "Bảng giá và gói Pro | Kaitiq",
    description: "Các gói sử dụng Kaitiq và quyền lợi của từng gói.",
  },
  "/feedback": {
    title: "Góp ý cho Kaitiq",
    description: "Gửi góp ý, báo lỗi hoặc đề xuất tính năng để Kaitiq tốt hơn.",
  },
  "/donate": {
    title: "Ủng hộ Kaitiq",
    description: "Cách ủng hộ Kaitiq: xem video, bình luận, thả tim, đăng ký kênh hoặc đóng góp trực tiếp.",
  },
};

const PRIVATE_PREFIXES = ["/admin", "/auth", "/profile", "/history", "/exams/history", "/flashcards/"];

/** What a page should say about itself to a search engine or a link preview. */
export function metaFor(pathname: string): PageMeta {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const known = PAGES[path];
  if (known) return known;
  if (PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`))) {
    return { ...HOME, noindex: true };
  }
  if (path.startsWith("/lessons/")) {
    return {
      title: "Làm bài luyện thi JLPT | Kaitiq",
      description: "Luyện đề JLPT thật: nghe hiểu, từ vựng, ngữ pháp, đọc hiểu, có đáp án và giải thích.",
    };
  }
  return { ...HOME, noindex: true };
}

export function canonicalFor(pathname: string): string {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return `${SITE_ORIGIN}${path}`;
}

function setMeta(attr: "name" | "property", key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

/** Writes a page's title, description, canonical link and share-preview tags into the document head. */
export function applyMeta(pathname: string, meta: PageMeta = metaFor(pathname)) {
  const url = canonicalFor(pathname);
  document.title = meta.title;
  setMeta("name", "description", meta.description);
  setMeta("name", "robots", meta.noindex ? "noindex, nofollow" : "index, follow");
  setMeta("property", "og:title", meta.title);
  setMeta("property", "og:description", meta.description);
  setMeta("property", "og:url", url);
  setMeta("property", "og:site_name", SITE_NAME);
  setMeta("name", "twitter:title", meta.title);
  setMeta("name", "twitter:description", meta.description);
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = url;
}
