import { apiFetch } from "./client";

export type Voucher = {
  source: "support_video";
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  expiresAt: string | null;
  used: boolean;
  createdAt: string;
};

const auth = (): Record<string, string> => {
  try {
    return { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` };
  } catch {
    return { Authorization: "Bearer " };
  }
};

/** The signed-in user's vouchers, newest first. */
export async function fetchMyVouchers(signal?: AbortSignal): Promise<Voucher[]> {
  const r = await apiFetch<{ vouchers: Voucher[] }>("/api/vouchers/me", { headers: auth(), signal, cache: "no-store" });
  return r.vouchers;
}

/** Saves the "supported the video" voucher on the account; claiming again returns the one already held. */
export async function claimSupportVoucher(): Promise<Voucher> {
  const r = await apiFetch<{ voucher: Voucher }>("/api/vouchers/claim", {
    method: "POST",
    headers: auth(),
    body: JSON.stringify({ source: "support_video" }),
  });
  return r.voucher;
}

/** The voucher a user holds for supporting the video, if any. */
export const supportVoucher = (list: Voucher[]): Voucher | undefined => list.find((v) => v.source === "support_video");
