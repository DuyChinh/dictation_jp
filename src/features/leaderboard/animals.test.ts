import { describe, expect, it } from "vitest";
import { ANIMALS, animalFor } from "./animals";

describe("animalFor", () => {
  it("gives the same animal for the same name, ignoring case and spaces around it", () => {
    expect(animalFor("Hồ Phương An")).toBe(animalFor("  hồ phương an "));
  });

  it("spreads people across all the animals", () => {
    const names = Array.from({ length: 200 }, (_, i) => `learner ${i}`);
    const used = new Set(names.map(animalFor));
    expect(used.size).toBe(ANIMALS.length);
  });
});
