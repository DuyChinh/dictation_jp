/** One EMVCo field: id, two-digit length, value. */
function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** CRC-16/CCITT-FALSE, as EMVCo QR codes require. */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * NAPAS VietQR payload for a transfer to a bank account. With an amount the code is a one-off
 * ("12") that bank apps open with the amount filled in; without one it is the reusable kind ("11").
 */
export function buildVietQr({ bin, account, amount }: { bin: string; account: string; amount?: number }): string {
  const beneficiary = field("00", bin) + field("01", account);
  const merchant = field("00", "A000000727") + field("01", beneficiary) + field("02", "QRIBFTTA");
  const body =
    field("00", "01") +
    field("01", amount ? "12" : "11") +
    field("38", merchant) +
    field("53", "704") +
    (amount ? field("54", String(Math.round(amount))) : "") +
    field("58", "VN") +
    "6304";
  return body + crc16(body);
}

