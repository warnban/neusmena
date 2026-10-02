import { describe, expect, it } from "vitest";
import { catalogItemCategory } from "@/lib/transaction-categories";

describe("catalogItemCategory", () => {
  it("uses the item name instead of the miscellaneous bucket", () => {
    expect(catalogItemCategory("Закупка белья")).toBe("Закупка белья");
    expect(catalogItemCategory("  Детская кроватка  ")).toBe("Детская кроватка");
  });
});
