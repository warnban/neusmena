import { describe, expect, it } from "vitest";
import { nextFreeBedStart, suggestBedNumbers } from "@/lib/bed-numbers";

describe("bed number suggestions", () => {
  it("starts after the largest numeric label", () => {
    expect(nextFreeBedStart(["1", "2", "12", "01", "A5"])).toBe(13);
    expect(nextFreeBedStart([])).toBe(1);
  });

  it("skips taken numbers", () => {
    expect(suggestBedNumbers(4, 1, ["2", "4"])).toEqual(["1", "3", "5", "6"]);
  });

  it("returns an empty list for zero beds", () => {
    expect(suggestBedNumbers(0, 5, [])).toEqual([]);
  });
});
