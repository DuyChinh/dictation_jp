import { describe, expect, it } from "vitest";
import { buildVietQr } from "./vietQr";

describe("buildVietQr", () => {
  it("matches the code the bank app issued for the account", () => {
    expect(buildVietQr({ bin: "970436", account: "9964046722" })).toBe(
      "00020101021138540010A00000072701240006970436011099640467220208QRIBFTTA53037045802VN63047CCF",
    );
  });

  it("adds the amount and marks the code one-off", () => {
    const qr = buildVietQr({ bin: "970436", account: "9964046722", amount: 50000 });
    expect(qr).toContain("010212");
    expect(qr).toContain("540550000");
    expect(qr).toMatch(/6304[0-9A-F]{4}$/);
  });
});
