import { describe, expect, it } from "vitest";
import {
  attachmentKind,
  dropAttachmentMarker,
  sanitizeInstructionAttachments,
  splitInstructionAnswer,
} from "@/lib/instructions";

describe("splitInstructionAnswer", () => {
  it("вставляет вложения по меткам и пропускает несуществующие номера", () => {
    const { parts, inlined } = splitInstructionAnswer("Шаг 1\n[[1]]\nШаг 2 [[5]] [[2]]", 2);
    expect(parts).toEqual([
      { kind: "text", text: "Шаг 1\n" },
      { kind: "attachment", index: 0 },
      { kind: "text", text: "\nШаг 2 [[5]] " },
      { kind: "attachment", index: 1 },
    ]);
    expect(Array.from(inlined)).toEqual([0, 1]);
  });
});

describe("dropAttachmentMarker", () => {
  it("убирает метку удалённого вложения и сдвигает следующие", () => {
    expect(dropAttachmentMarker("a [[1]] b [[2]] c [[3]]", 1)).toBe("a [[1]] b  c [[2]]");
  });
});

describe("sanitizeInstructionAttachments", () => {
  it("пропускает только файлы инструкций своей сети", () => {
    const list = sanitizeInstructionAttachments(
      [
        { name: "ok.png", path: "/uploads/instructions/seat-1/a-ok.png", size: 10 },
        { name: "foreign.png", path: "/uploads/instructions/seat-2/b.png", size: 10 },
        { name: "notes.png", path: "/uploads/notes/seat-1/c.png", size: 10 },
        { name: "up.png", path: "/uploads/instructions/seat-1/../seat-2/d.png", size: 10 },
      ],
      "seat-1"
    );
    expect(list.map((a) => a.name)).toEqual(["ok.png"]);
  });
});

describe("attachmentKind", () => {
  it("определяет тип по расширению", () => {
    expect(attachmentKind("Скрин.PNG")).toBe("image");
    expect(attachmentKind("video.mov")).toBe("video");
    expect(attachmentKind("regl.pdf")).toBe("file");
  });
});
