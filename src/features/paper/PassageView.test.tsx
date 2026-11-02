import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiLanguageProvider } from "../../shared/i18n/UiLanguageContext";
import type { PaperPassage } from "../../shared/api/paper";
import { PassageView } from "./PassageView";

afterEach(() => cleanup());

const notice: PaperPassage = {
  id: "p2",
  mondai: 2,
  kind: "notice",
  layout_ja: "9月1日\n自転車の移動について",
  sentences: [{ id: "s1", text: "自転車の移動について" }],
};

function view(showTranslation: boolean) {
  return render(
    <UiLanguageProvider>
      <PassageView
        passage={notice}
        evidenceIds={new Set()}
        translation={{ passage_id: "p2", full_translation_vi: "", sentences: [{ id: "s1", ja: "自転車の移動について", vi: "Về việc di dời xe đạp" }] }}
        showTranslation={showTranslation}
        busy={false}
        error={null}
        drillReady
        drilling={false}
        onToggleTranslation={vi.fn()}
        onOpenDrill={vi.fn()}
        plain
      />
    </UiLanguageProvider>,
  );
}

describe("PassageView", () => {
  it("shows the printed layout of a notice until the translation is asked for", () => {
    view(false);
    expect(screen.queryByText("Về việc di dời xe đạp")).toBeNull();
  });

  it("shows the translation of a notice that has a printed layout", () => {
    view(true);
    expect(screen.getByText("Về việc di dời xe đạp")).toBeTruthy();
  });
});
