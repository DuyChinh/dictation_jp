import { ApiError } from "../shared/api/client";
import type { LocalizedText } from "../shared/content/getLocalizedText";
import { apiUrl } from "../shared/env";

/** Admin sessions live apart from the learner's `token`, so signing in to one never touches the other. */
const TOKEN_KEY = "jd.admin_token.v1";
export const UNAUTHORIZED_EVENT = "jd-admin-unauthorized";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked: the session lasts until reload
  }
}

type Query = Record<string, string | number | undefined | null>;

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function adminFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; query?: Query } = {},
): Promise<T> {
  const token = getAdminToken();
  let res: Response;
  try {
    res = await fetch(apiUrl(withQuery(`/api/admin${path}`, init.query)), {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Network error");
  }

  if (!res.ok) {
    let code = "HTTP_ERROR";
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      /* not JSON */
    }
    if (res.status === 401 && path !== "/auth/login") {
      setAdminToken(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

const SERVER_MESSAGES: Record<string, string> = {
  "Another account already uses this email": "Email này đã thuộc về tài khoản khác.",
  "A plan with this code already exists": "Mã gói này đã tồn tại.",
  "A coupon with this code already exists": "Mã giảm giá này đã tồn tại.",
  "This username is taken": "Tên đăng nhập này đã được dùng.",
  "Current password is wrong": "Mật khẩu hiện tại không đúng.",
};

/** A Vietnamese message for an error thrown by adminFetch. */
export function errorText(err: unknown): string {
  if (!(err instanceof ApiError)) return "Đã có lỗi xảy ra. Thử lại sau.";
  if (SERVER_MESSAGES[err.message]) return SERVER_MESSAGES[err.message]!;
  // A bare 404 means the route itself is missing, e.g. a backend started before the admin API existed.
  if (err.status === 404 && err.code === "HTTP_ERROR") {
    return "Máy chủ chưa có API quản trị. Hãy khởi động lại backend bằng bản mới.";
  }
  switch (err.code) {
    case "NETWORK":
      return "Không kết nối được máy chủ.";
    case "INVALID_CREDENTIALS":
      return "Sai tên đăng nhập hoặc mật khẩu.";
    case "LOCKED":
      return "Sai quá nhiều lần. Tài khoản tạm khoá 15 phút.";
    case "ACCOUNT_DISABLED":
      return "Tài khoản quản trị này đã bị vô hiệu hoá.";
    case "UNAUTHORIZED":
      return "Phiên đăng nhập đã hết hạn. Đăng nhập lại.";
    case "FORBIDDEN":
      return "Vai trò của bạn không có quyền làm việc này.";
    case "NOT_FOUND":
      return "Không tìm thấy (có thể đã bị xoá).";
    case "PLAN_IN_USE":
      return `Còn người dùng đang ở gói này, hãy chuyển họ sang gói khác trước: ${err.message.split(": ")[1] ?? ""}`;
    case "LAST_SUPER_ADMIN":
      return "Phải còn ít nhất một Super admin đang hoạt động.";
    case "SELF_LOCKOUT":
      return "Không thể tự đổi vai trò hoặc tự vô hiệu hoá tài khoản của mình.";
    case "SELF_DELETE":
      return "Không thể tự xoá tài khoản của mình.";
    case "VALIDATION_ERROR":
      return `Dữ liệu chưa hợp lệ (${err.message}).`;
    default:
      return err.message || "Đã có lỗi xảy ra.";
  }
}

// ---- Types (mirror backend/src/modules/admin) ----

export type AdminArea = "users" | "payments" | "catalog" | "content" | "feedback" | "admins";
export type AccessLevel = "none" | "read" | "write";
export type AdminRole = "super_admin" | "content" | "support" | "accountant";

export type AdminAccount = {
  id: string;
  username: string;
  displayName: string;
  role: AdminRole;
  status: "active" | "disabled";
  lastLoginAt: string | null;
  createdAt: string;
  permissions: Record<AdminArea, AccessLevel>;
};

export type Paged<T> = { items: T[]; total: number; page: number; limit: number };

export type UserRow = {
  id: string;
  email: string;
  displayName: string;
  avatar: string | null;
  authProvider: "local" | "google";
  plan: string;
  premiumUntil: string | null;
  status: "active" | "locked";
  createdAt: string;
  lessonsPracticed: number;
  lastActiveAt: string | null;
};

export type UserDetail = {
  user: UserRow;
  stats: { sessions: number; attempted: number; correct: number; listeningTotal: number; listeningCorrect: number };
  lessons: Array<{
    lessonId: string;
    title: LocalizedText | null;
    correct: number;
    attempted: number;
    total: number;
    lastAt: string;
  }>;
  payments: Array<{ id: string; code: string; plan: string; amount: number; status: PaymentStatus; createdAt: string }>;
};

export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";
export type PaymentGateway = "vnpay" | "momo" | "bank_transfer" | "manual";

export type PaymentRow = {
  id: string;
  code: string;
  userId: string | null;
  userEmail: string;
  userName: string;
  plan: string;
  amount: number;
  gateway: PaymentGateway;
  status: PaymentStatus;
  note: string;
  paidAt: string | null;
  createdAt: string;
};

export type PlanRow = {
  id: string;
  code: string;
  name: string;
  price: number;
  durationDays: number;
  features: string[];
  active: boolean;
  sortOrder: number;
  users: number;
  createdAt: string;
};

export type CouponRow = {
  id: string;
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
};

export type ContentProblem = { dir: string; messages: string[] };

export type LessonRow = {
  id: string;
  title: LocalizedText;
  source: { type: string; level?: string; year?: number; month?: number };
  status: string;
  contentVersion: number;
  hidden: boolean;
  durationMs: number | null;
  counts: { sections: number; questions: number; dictation_segments: number };
};

export type FeedbackCategory = "idea" | "bug" | "content" | "other";
export type FeedbackStatus = "open" | "planned" | "done";

export type FeedbackRow = {
  id: string;
  userId: string | null;
  authorName: string;
  authorEmail: string;
  authorAvatar: string | null;
  /** Written by the team from the admin area. */
  fromTeam: boolean;
  category: FeedbackCategory;
  body: string;
  images: string[];
  status: FeedbackStatus;
  pinned: boolean;
  hidden: boolean;
  adminReply: string;
  repliedAt: string | null;
  likes: number;
  reactions: Array<{ emoji: string; count: number }>;
  replyCount: number;
  /** When the author last changed it themselves. */
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedbackReplyRow = {
  id: string;
  authorName: string;
  authorEmail: string;
  authorAvatar: string | null;
  body: string;
  images: string[];
  reactions: Array<{ emoji: string; count: number }>;
  editedAt: string | null;
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  adminUsername: string;
  action: string;
  target: string;
  detail: string;
  ip: string;
  createdAt: string;
};

export type Overview = {
  days: number;
  users: { total: number; new: number; active: number; paid: number };
  payments: null | {
    revenue: number;
    previousRevenue: number;
    succeeded: number;
    pending: number;
    series: Array<{ date: string; amount: number }>;
    recent: PaymentRow[];
  };
  content: { published: number; hidden: number; problems: ContentProblem[] };
  topLessons: Array<{ lessonId: string; title: LocalizedText | null; sessions: number }>;
};
