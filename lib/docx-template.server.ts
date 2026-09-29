import "server-only";

import fs from "fs";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

/** Единый рендер docx-шаблона: подставляет {переменные} и возвращает Buffer. */
export function renderDocxTemplate(
  templatePath: string,
  context: Record<string, string>
): Buffer {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Шаблон не найден: ${templatePath}`);
  }

  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(context);

  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;
}
