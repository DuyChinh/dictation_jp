import { describe, expect, it } from "vitest";
import { applyReaction } from "./feedbackMeta";

describe("applyReaction", () => {
  it("adds, switches and takes back the viewer's reaction", () => {
    const added = applyReaction([{ emoji: "❤️", count: 2 }], null, "🎉");
    expect(added).toEqual({ reactions: [{ emoji: "❤️", count: 2 }, { emoji: "🎉", count: 1 }], myReaction: "🎉" });

    const switched = applyReaction(added.reactions, "🎉", "❤️");
    expect(switched).toEqual({ reactions: [{ emoji: "❤️", count: 3 }], myReaction: "❤️" });

    const removed = applyReaction(switched.reactions, "❤️", "❤️");
    expect(removed).toEqual({ reactions: [{ emoji: "❤️", count: 2 }], myReaction: null });
  });
});
