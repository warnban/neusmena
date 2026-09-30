import { describe, expect, it } from "vitest";
import { guessGenderFromName } from "@/lib/dorm";

describe("guessGenderFromName", () => {
  it("uses the patronymic first", () => {
    expect(guessGenderFromName("Иванов Иван Иванович")).toBe("M");
    expect(guessGenderFromName("Ким Анна Сергеевна")).toBe("F");
    expect(guessGenderFromName("Алиев Рашид Мамед оглы")).toBe("M");
  });

  it("falls back to the surname", () => {
    expect(guessGenderFromName("Соколова Елена")).toBe("F");
    expect(guessGenderFromName("Петров Пётр")).toBe("M");
    expect(guessGenderFromName("Вишневская Ольга")).toBe("F");
  });

  it("returns null when unsure", () => {
    expect(guessGenderFromName("Ким Ли")).toBeNull();
    expect(guessGenderFromName("John Smith")).toBeNull();
    expect(guessGenderFromName("Иван")).toBeNull();
  });
});
