import "server-only";

import { execFileSync } from "child_process";
import path from "path";
import fs from "fs";
import {
  INCIDENT_FORM_IDS,
  INCIDENT_FORM_TEMPLATES,
  type IncidentFormId,
} from "@/lib/incident-forms";
import { renderDocxTemplate } from "@/lib/docx-template.server";

const TEMPLATES_DIR = path.join(process.cwd(), "templates", "incident-forms");
const GENERATE_SCRIPT = path.join(process.cwd(), "scripts", "generate-incident-forms-templates.mjs");

export function incidentFormTemplatePath(formId: IncidentFormId): string {
  return path.join(TEMPLATES_DIR, INCIDENT_FORM_TEMPLATES[formId].filename);
}

function generateIncidentTemplates(): void {
  if (!fs.existsSync(GENERATE_SCRIPT)) return;
  execFileSync(process.execPath, [GENERATE_SCRIPT], { cwd: process.cwd(), stdio: "pipe" });
}

export function incidentTemplateExists(formId: IncidentFormId): boolean {
  if (fs.existsSync(incidentFormTemplatePath(formId))) return true;
  if (INCIDENT_FORM_IDS.some((id) => !fs.existsSync(incidentFormTemplatePath(id)))) {
    try {
      generateIncidentTemplates();
    } catch {
      return false;
    }
  }
  return fs.existsSync(incidentFormTemplatePath(formId));
}

export function renderIncidentFormDocx(
  formId: IncidentFormId,
  context: Record<string, string>
): Buffer {
  if (!incidentTemplateExists(formId)) {
    throw new Error(`Шаблон «${INCIDENT_FORM_TEMPLATES[formId].filename}» не найден`);
  }
  return renderDocxTemplate(incidentFormTemplatePath(formId), context);
}
