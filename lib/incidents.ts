import type { IncidentType, IncidentStatus } from "@/lib/types";

type Tone = "danger" | "warning" | "info" | "neutral";

export const INCIDENT_TYPE_META: Record<
  IncidentType,
  { label: string; icon: string; tone: Tone }
> = {
  rule_violation: { label: "Нарушение правил проживания", icon: "FileWarning", tone: "warning" },
  public_order: { label: "Нарушение общественного порядка", icon: "Megaphone", tone: "danger" },
  property_damage: { label: "Повреждение имущества", icon: "Hammer", tone: "danger" },
  access_control: { label: "Нарушение пропускного режима", icon: "DoorClosed", tone: "info" },
  intoxication: { label: "Опьянение / опасное поведение", icon: "Wine", tone: "warning" },
  other: { label: "Иное происшествие", icon: "CircleAlert", tone: "neutral" },
};

export const INCIDENT_TYPE_OPTIONS = (Object.keys(INCIDENT_TYPE_META) as IncidentType[]).map(
  (value) => ({ value, label: INCIDENT_TYPE_META[value].label })
);

export const INCIDENT_STATUS_META: Record<
  IncidentStatus,
  { label: string; tone: Tone }
> = {
  open: { label: "Открыто", tone: "warning" },
  resolved: { label: "Закрыто", tone: "neutral" },
};

export function isIncidentType(v: string): v is IncidentType {
  return v in INCIDENT_TYPE_META;
}
