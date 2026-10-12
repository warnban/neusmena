import { existsSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildIncidentFormContext, INCIDENT_FORM_TEMPLATES, INCIDENT_FORM_IDS } from "@/lib/incident-forms";
import type { Hotel } from "@/lib/types";

const hotel = {
  name: "Grand Hotel Moscow",
  legalName: "ООО Тест",
  city: "Москва",
  address: "Тверская ул., 1",
  phone: "+7 495 123-45-67",
  email: "test@example.com",
  website: "https://example.com",
} as Hotel;

describe("incident forms", () => {
  it("подставляет реквизиты гостиницы", () => {
    const context = buildIncidentFormContext(hotel);
    expect(context.hotel_name).toBe("Grand Hotel Moscow");
    expect(context.hotel_legal_name).toBe("ООО Тест");
    expect(context.hotel_city).toBe("Москва");
  });

  it("шаблоны Word лежат в templates/incident-forms", () => {
    for (const id of INCIDENT_FORM_IDS) {
      const file = path.join(process.cwd(), "templates", "incident-forms", INCIDENT_FORM_TEMPLATES[id].filename);
      expect(existsSync(file), file).toBe(true);
    }
  });
});
