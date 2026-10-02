import type { DormGender, RoomStatus } from "@/lib/types";

export function guestGenderMatchesDorm(
  guestGender: "M" | "F" | null | undefined,
  dormGender: DormGender | null | undefined
): boolean {
  if (!dormGender || dormGender === "mixed") return true;
  if (!guestGender) return false;
  if (dormGender === "male") return guestGender === "M";
  if (dormGender === "female") return guestGender === "F";
  return true;
}

/** Пол по русскому ФИО «Фамилия Имя Отчество»: сначала по отчеству, затем по фамилии. */
export function guessGenderFromName(fullName: string): "M" | "F" | null {
  const parts = fullName.toLowerCase().replace(/ё/g, "е").split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  for (const p of parts.slice(2)) {
    if (/(ич|оглы|улы)$/.test(p)) return "M";
    if (/(вна|чна|шна|кызы|гызы)$/.test(p)) return "F";
  }
  const last = parts[0]!;
  if (/(ова|ева|ина|ына|ская|цкая)$/.test(last)) return "F";
  if (/(ов|ев|ин|ын|ский|цкий)$/.test(last)) return "M";
  return null;
}

export function formatBedDisplay(bedLabel: string): string {
  return bedLabel;
}

/** Метка койки в общей комнате: «комната/койко-место» (например 1/01). */
export function formatDormPlaceLabel(roomLabel: string, bedLabel: string): string {
  const room = roomLabel.trim();
  const bed = bedLabel.trim();
  if (!bed) return room;
  if (bed.includes("/")) return bed;
  if (!room) return bed;
  return `${room}/${bed}`;
}

/** Подпись статуса места в дропдауне бронирования. */
function placeStatusHint(status: RoomStatus): string {
  if (status === "cleaning") return " · уборка";
  if (status === "checkout") return " · выезд";
  if (status === "occupied") return " · занято";
  return "";
}

/** Подпись места в дропдауне бронирования. */
export function formatBookingPlaceOptionLabel(slot: {
  kind: "private" | "dorm";
  roomLabel: string;
  number: string;
  bedLabel: string | null;
  category: string;
  price: number;
  money: (n: number) => string;
  placeStatus?: RoomStatus;
}): string {
  const hint = slot.placeStatus ? placeStatusHint(slot.placeStatus) : "";
  if (slot.kind === "dorm") {
    const place = formatDormPlaceLabel(slot.roomLabel, slot.bedLabel ?? slot.number);
    return `${place}${hint} · ${slot.money(slot.price)}/койка`;
  }
  return `${slot.number}${hint} · ${slot.category} · ${slot.money(slot.price)}/сут.`;
}

/** Подпись статуса койки для карточки в номерном фонде. Живой гость важнее устаревшего статуса койки. */
export function bedCardStatusLabel(status: RoomStatus, guestName: string | null): string {
  if (guestName) return guestName;
  if (status === "cleaning") return "Уборка";
  if (status === "available") return "Свободен";
  if (status === "maintenance") return "Ремонт";
  if (status === "checkout") return "Выезд";
  return "Занят";
}
