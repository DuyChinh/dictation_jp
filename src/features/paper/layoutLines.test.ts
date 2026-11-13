import { describe, expect, it } from "vitest";
import { splitLayout } from "./layoutLines";

describe("splitLayout", () => {
  it("turns each line into a paragraph, keeping blank lines and small indents", () => {
    const runs = splitLayout("森田様\n\n　引っ越しの件です。");
    expect(runs).toEqual([
      { kind: "lines", framed: false, lines: [{ text: "森田様", indent: 0, end: false }, { text: "", indent: 0, end: false }, { text: "引っ越しの件です。", indent: 1, end: false }] },
    ]);
  });

  it("puts a date or a signature far from the left edge at the right instead of padding it with spaces", () => {
    const [run] = splitLayout(`${"　".repeat(30)}9月1日\n本文`);
    expect(run).toMatchObject({ kind: "lines", framed: false, lines: [{ text: "9月1日", end: true }, { text: "本文", end: false }] });
  });

  it("keeps drawn tables and frames as they are, so they still line up", () => {
    const runs = splitLayout("運賃\n+------+----+\n| 大人 | 3 |\n+------+----+\n・注意");
    expect(runs.map((r) => r.kind)).toEqual(["lines", "grid", "lines"]);
    expect(runs[1]).toEqual({ kind: "grid", text: "+------+----+\n| 大人 | 3 |\n+------+----+" });
  });

  const mail = [
    "らくらくルーム社　青寺店",
    "森田様",
    "",
    "花西マンション302号室に入居予定の木村です。",
    "引っ越し当日の3月20日の金曜日、午前中に貴店で新居の鍵を受け取る約束でしたが、",
    "荷物が10時に到着することになりました。そのため、前日19日の午後に鍵を受け取りたい",
    "と思いホームページを確認したところ、貴店は木曜日が定休日でした。",
    "鍵の受け取り日が定休日の場合は、ほかの支店で受け取れると書いてありましたので、仕事",
    "の帰りに中央駅前店に寄りたいと思いますが、鍵を受け取ることは可能でしょうか。",
    "お返事をお待ちしております。",
    "",
    "木村ゆり",
  ].join("\n");
  const textsOf = (src: string) => splitLayout(src).flatMap((r) => (r.kind === "lines" ? r.lines.map((l) => l.text) : []));

  it("puts back sentences that the print width cut in two, and nothing else", () => {
    expect(textsOf(mail)).toEqual([
      "らくらくルーム社　青寺店",
      "森田様",
      "",
      "花西マンション302号室に入居予定の木村です。",
      "引っ越し当日の3月20日の金曜日、午前中に貴店で新居の鍵を受け取る約束でしたが、荷物が10時に到着することになりました。そのため、前日19日の午後に鍵を受け取りたいと思いホームページを確認したところ、貴店は木曜日が定休日でした。",
      "鍵の受け取り日が定休日の場合は、ほかの支店で受け取れると書いてありましたので、仕事の帰りに中央駅前店に寄りたいと思いますが、鍵を受け取ることは可能でしょうか。",
      "お返事をお待ちしております。",
      "",
      "木村ゆり",
    ]);
  });

  it("does not join a list item or a short block onto the line before", () => {
    const list = "・特等と1等はいすの席です。2等はいすの席はなく、じゅんたんの大部屋です。各部屋の写真は、\n・大人運賃は、12歳以上の方の運賃です。";
    expect(textsOf(list)).toHaveLength(2);
    expect(textsOf("9月1日\n自転車の移動について")).toEqual(["9月1日", "自転車の移動について"]);
  });

  it("joins a hanging-indent continuation onto its line", () => {
    const src = "・特等と1等はいすの席です。2等はいすの席はなく、じゅんたんの大部屋です。各部屋の写真は、\n　「船内のご案内」のページでごらんになれます。";
    expect(textsOf(src)).toEqual(["・特等と1等はいすの席です。2等はいすの席はなく、じゅんたんの大部屋です。各部屋の写真は、「船内のご案内」のページでごらんになれます。"]);
  });

  it("keeps rows whose columns are lined up with spaces as a table", () => {
    const runs = splitLayout("【料金表】\n席種　　　S席　　　A席\n①定期公演　　49,000円　　38,500円\n・①の会場は東風ホールです。");
    expect(runs.map((r) => r.kind)).toEqual(["lines", "grid", "lines"]);
  });

  it("turns a framed box into a box of wrapping lines, without the frame characters", () => {
    const runs = splitLayout("本文\n┌────────┐\n｜＊振替\n｜　空席がない場合は、振替になります。\n└────────┘\n【申込】");
    expect(runs.map((r) => r.kind)).toEqual(["lines", "lines", "lines"]);
    expect(runs[1]).toMatchObject({ framed: true, lines: [{ text: "＊振替" }, { text: "空席がない場合は、振替になります。", indent: 1 }] });
  });

  it("does not join an address, a date or a mail header onto the next line", () => {
    const src = "東月オーケストラ　チケットオフィス　〒155-8547　東月市星山3-16-5\n電話・FAX　081-566-2257\nこの度は、ブックネットA書店にて、以下の商品をご注文いただき誠にありがとうございました。";
    expect(textsOf(src)).toHaveLength(3);
  });
});
