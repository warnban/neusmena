"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DocxPrintView, type DocxPrintItem } from "@/components/print/docx-print-view";
import { INCIDENT_FORM_TEMPLATES, parseIncidentFormIds } from "@/lib/incident-forms";

function IncidentPrintContent() {
  const sp = useSearchParams();
  const hotelId = sp.get("hotelId") ?? "";
  const formIds = parseIncidentFormIds(sp.get("formIds"));
  const autoPrint = sp.get("print") !== "0";

  const items: DocxPrintItem[] =
    hotelId && formIds.length
      ? formIds.map((formId) => ({
          url: `/api/hotels/${hotelId}/incident-forms/${formId}?format=docx`,
          label: INCIDENT_FORM_TEMPLATES[formId].label,
        }))
      : [];

  const title =
    formIds.length === 1
      ? (INCIDENT_FORM_TEMPLATES[formIds[0]]?.label ?? "Бланк")
      : `Печать документов (${formIds.length})`;

  return (
    <DocxPrintView items={items} title={title} autoPrint={autoPrint} paramsKey={hotelId} />
  );
}

export default function IncidentDocumentsPrintPage() {
  return (
    <Suspense fallback={<p className="docx-print-message no-print">Загрузка…</p>}>
      <IncidentPrintContent />
    </Suspense>
  );
}
