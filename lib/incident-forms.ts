import { fmtDateRu } from "@/lib/format";
import type { Hotel } from "@/lib/types";

export type IncidentFormId =
  | "rule-violation-act"
  | "property-damage-act"
  | "guest-explanation";

export const INCIDENT_FORM_TEMPLATES: Record<
  IncidentFormId,
  { id: IncidentFormId; label: string; short: string; filename: string; description: string }
> = {
  "rule-violation-act": {
    id: "rule-violation-act",
    label: "Акт о нарушении правил проживания",
    short: "Акт о нарушении",
    filename: "rule-violation-act.docx",
    description:
      "Фиксирует факт нарушения правил проживания / общественного порядка / пропускного режима.",
  },
  "property-damage-act": {
    id: "property-damage-act",
    label: "Акт о повреждении имущества",
    short: "Акт о повреждении",
    filename: "property-damage-act.docx",
    description:
      "Фиксирует повреждение имущества гостиницы и расчёт суммы причинённого ущерба.",
  },
  "guest-explanation": {
    id: "guest-explanation",
    label: "Объяснение гостя",
    short: "Объяснение гостя",
    filename: "guest-explanation.docx",
    description:
      "Письменное объяснение гостя по факту происшествия (заполняется гостем).",
  },
};

export const INCIDENT_FORM_IDS = Object.keys(
  INCIDENT_FORM_TEMPLATES
) as IncidentFormId[];

export function isIncidentFormId(v: string): v is IncidentFormId {
  return v in INCIDENT_FORM_TEMPLATES;
}

/** Контекст для бланка-заготовки: реквизиты гостиницы + дата формирования. */
export function buildIncidentFormContext(hotel: Hotel): Record<string, string> {
  return {
    hotel_name: hotel.name || "—",
    hotel_legal_name: hotel.legalName || hotel.name || "—",
    hotel_city: hotel.city || "—",
    hotel_address: hotel.address || "—",
    hotel_phone: hotel.phone || "—",
    hotel_email: hotel.email || "—",
    hotel_website: hotel.website || "—",
    print_date: fmtDateRu(new Date()),
  };
}

export function buildIncidentFormsPrintUrl(params: {
  hotelId: string;
  formIds?: IncidentFormId[];
  autoPrint?: boolean;
}): string {
  const q = new URLSearchParams({
    hotelId: params.hotelId,
    formIds: (params.formIds ?? INCIDENT_FORM_IDS).join(","),
    print: params.autoPrint === false ? "0" : "1",
  });
  return `/documents/incident-print?${q.toString()}`;
}

export function parseIncidentFormIds(raw: string | null): IncidentFormId[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(isIncidentFormId);
}

/** Тип вложения журнала происшествий ↔ бланк для печати. */
export const INCIDENT_ATTACHMENT_KIND_LABELS: Record<string, string> = {
  guest_explanation: "Объяснение гостя",
  rule_violation_act: "Акт о нарушении",
  property_damage_act: "Акт о повреждении",
  photo: "Фото/видео",
  other: "Другое",
};
