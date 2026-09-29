"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DocxPrintView, type DocxPrintItem } from "@/components/print/docx-print-view";
import {
  GUEST_FORM_TEMPLATES,
  parseGuestFormIds,
  parseStayAmendmentFromSearchParams,
  type GuestFormId,
} from "@/lib/guest-print-forms";

function resolveFormIds(sp: URLSearchParams): GuestFormId[] {
  const fromList = parseGuestFormIds(sp.get("formIds"));
  if (fromList.length) return fromList;
  const single = sp.get("formId");
  if (single && single in GUEST_FORM_TEMPLATES) return [single as GuestFormId];
  return [];
}

function FormPrintContent() {
  const sp = useSearchParams();
  const guestId = sp.get("guestId") ?? "";
  const formIds = resolveFormIds(sp);
  const bookingId = sp.get("bookingId") ?? "";
  const autoPrint = sp.get("print") !== "0";
  const amendment = parseStayAmendmentFromSearchParams(sp);
  const amendmentKey = amendment
    ? `${amendment.checkOut}-${amendment.amount}-${amendment.nights}`
    : "";

  const items: DocxPrintItem[] = guestId
    ? formIds.map((formId) => {
        const q = new URLSearchParams({ format: "docx" });
        if (bookingId) q.set("bookingId", bookingId);
        if (amendment) {
          q.set("prevCheckOut", new Date(amendment.checkOut).toISOString().slice(0, 10));
          q.set("prevAmount", String(amendment.amount));
          q.set("prevNights", String(amendment.nights));
        }
        return {
          url: `/api/guests/${guestId}/forms/${formId}?${q.toString()}`,
          label: GUEST_FORM_TEMPLATES[formId].label,
        };
      })
    : [];

  const title =
    formIds.length === 1
      ? (GUEST_FORM_TEMPLATES[formIds[0]]?.label ?? "Бланк")
      : `Печать документов (${formIds.length})`;

  return (
    <DocxPrintView
      items={items}
      title={title}
      autoPrint={autoPrint}
      paramsKey={`${guestId}:${bookingId}:${amendmentKey}`}
    />
  );
}

export default function GuestFormPrintPage() {
  return (
    <Suspense fallback={<p className="docx-print-message no-print">Загрузка…</p>}>
      <FormPrintContent />
    </Suspense>
  );
}
