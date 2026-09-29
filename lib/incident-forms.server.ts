import "server-only";

import path from "path";
import fs from "fs";
import { INCIDENT_FORM_TEMPLATES, type IncidentFormId } from "@/lib/incident-forms";
import { renderDocxTemplate } from "@/lib/docx-template.server";

const TEMPLATES_DIR = path.join(process.cwd(), "templates", "incident-forms");

export function incidentFormTemplatePath(formId: IncidentFormId): string {
  return path.join(TEMPLATES_DIR, INCIDENT_FORM_TEMPLATES[formId].filename);
}

export function incidentTemplateExists(formId: IncidentFormId): boolean {
  return fs.existsSync(incidentFormTemplatePath(formId));
}

export function renderIncidentFormDocx(
  formId: IncidentFormId,
  context: Record<string, string>
): Buffer {
  return renderDocxTemplate(incidentFormTemplatePath(formId), context);
}
