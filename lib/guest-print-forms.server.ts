import "server-only";

import path from "path";
import fs from "fs";
import { GUEST_FORM_TEMPLATES, type GuestFormId } from "@/lib/guest-print-forms";
import { renderDocxTemplate } from "@/lib/docx-template.server";

const TEMPLATES_DIR = path.join(process.cwd(), "templates", "guest-forms");

export function guestFormTemplatePath(formId: GuestFormId): string {
  const meta = GUEST_FORM_TEMPLATES[formId];
  return path.join(TEMPLATES_DIR, meta.filename);
}

export function templateExists(formId: GuestFormId): boolean {
  return fs.existsSync(guestFormTemplatePath(formId));
}

export function renderGuestFormDocx(formId: GuestFormId, context: Record<string, string>): Buffer {
  return renderDocxTemplate(guestFormTemplatePath(formId), context);
}
