import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/api-error";
import {
  INCIDENT_FORM_TEMPLATES,
  buildIncidentFormContext,
  isIncidentFormId,
  type IncidentFormId,
} from "@/lib/incident-forms";
import {
  incidentTemplateExists,
  renderIncidentFormDocx,
} from "@/lib/incident-forms.server";
import type { Hotel } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; formId: string } }
) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isIncidentFormId(params.formId)) {
      return NextResponse.json({ error: "Неизвестный бланк" }, { status: 400 });
    }
    const formId: IncidentFormId = params.formId;

    if (!incidentTemplateExists(formId)) {
      const meta = INCIDENT_FORM_TEMPLATES[formId];
      return NextResponse.json(
        {
          error: `Шаблон «${meta.filename}» не найден. Выполните: npm run generate:incident-forms`,
        },
        { status: 404 }
      );
    }

    const hotel = await prisma.hotel.findFirst({
      where: { id: params.id, seatId: session.seatId },
    });
    if (!hotel) return NextResponse.json({ error: "Отель не найден" }, { status: 404 });

    const context = buildIncidentFormContext(hotel as unknown as Hotel);
    const docxBuffer = renderIncidentFormDocx(formId, context);
    const meta = INCIDENT_FORM_TEMPLATES[formId];
    const safeHotel = hotel.name.replace(/[^\wа-яА-ЯёЁ\s-]/gi, "").trim().replace(/\s+/g, "_");
    const filename = `${meta.filename.replace(".docx", "")}_${safeHotel}.docx`;

    const format = req.nextUrl.searchParams.get("format") ?? "docx";
    if (format === "docx") {
      return new NextResponse(new Uint8Array(docxBuffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    }

    return NextResponse.json({ ok: true, form: meta, context });
  } catch (e) {
    console.error("[incident form]", e);
    return NextResponse.json(
      { error: apiErrorMessage(e, "Не удалось сформировать бланк") },
      { status: 500 }
    );
  }
}
