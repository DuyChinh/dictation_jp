import type { LocalizedText } from "../shared/content/getLocalizedText";
import type { AdminRole, PaymentGateway, PaymentStatus } from "./api";

const vndFormat = new Intl.NumberFormat("vi-VN");

export function vnd(amount: number): string {
  return `${vndFormat.format(amount)} ₫`;
}

export function num(n: number): string {
  return vndFormat.format(n);
}

/** "27/09/2026" */
export function dateText(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "27/09 09:42" */
export function dateTimeText(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

/** "5 phút trước", "Hôm qua", "12 ngày trước" */
export function relativeText(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Vừa xong";
  if (min < 60) return `${min} phút trước`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hôm qua";
  if (days < 30) return `${days} ngày trước`;
  return dateText(iso);
}

/** yyyy-mm-dd for <input type="date">, in local time. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** yyyy-mm-ddThh:mm for <input type="datetime-local">, in local time. */
export function toDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${toDateInput(iso)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A date or datetime-local input value as ISO, or null when empty. */
export function fromInput(value: string, endOfDay = false): string | null {
  if (!value) return null;
  const d = value.length === 10 ? new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function lessonTitle(title: LocalizedText | null | undefined, fallback: string): string {
  if (!title) return fallback;
  return title.vi || title.ja || title.en || fallback;
}

export function durationText(ms: number | null): string {
  if (!ms) return "—";
  return `${Math.round(ms / 60000)} phút`;
}

export const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: "Super admin",
  content: "Nội dung",
  support: "Hỗ trợ",
  accountant: "Kế toán",
};

export const GATEWAY_LABEL: Record<PaymentGateway, string> = {
  vnpay: "VNPay",
  momo: "MoMo",
  bank_transfer: "Chuyển khoản",
  manual: "Thủ công",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Chờ xác nhận",
  succeeded: "Thành công",
  failed: "Thất bại",
  refunded: "Hoàn tiền",
};

export const PROVIDER_LABEL = { local: "Email", google: "Google" } as const;

/** Human names for audit actions; unknown ones show as written. */
export const AUDIT_LABEL: Record<string, string> = {
  login: "Đăng nhập",
  login_failed: "Đăng nhập thất bại",
  password_change: "Đổi mật khẩu",
  user_update: "Sửa người dùng",
  user_delete: "Xoá người dùng",
  user_bulk_delete: "Xoá nhiều người dùng",
  payment_create: "Thêm giao dịch",
  payment_update: "Sửa giao dịch",
  payment_delete: "Xoá giao dịch",
  payment_bulk_delete: "Xoá nhiều giao dịch",
  plan_create: "Thêm gói",
  plan_update: "Sửa gói",
  plan_delete: "Xoá gói",
  plan_bulk_delete: "Xoá nhiều gói",
  coupon_create: "Thêm mã giảm giá",
  coupon_update: "Sửa mã giảm giá",
  coupon_delete: "Xoá mã giảm giá",
  coupon_bulk_delete: "Xoá nhiều mã giảm giá",
  content_reload: "Nạp lại nội dung",
  lesson_hide: "Ẩn đề",
  lesson_show: "Hiện đề",
  admin_create: "Thêm quản trị viên",
  admin_update: "Sửa quản trị viên",
  admin_delete: "Xoá quản trị viên",
  admin_bulk_delete: "Xoá nhiều quản trị viên",
};
