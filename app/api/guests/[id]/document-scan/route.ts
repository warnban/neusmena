import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { GUEST_DOC_MAX_BYTES, storeGuestDocument } from "@/lib/guest-document-storage.server";
import { recognizeDocumentFromScan } from "@/lib/document-scan.server";
import { assertGuestDocumentScanAllowed, assertHotelAiEnabled } from "@/lib/ai-premium.server";
import { listFilledExtractFields } from "@/lib/document-scan-parse";
import { apiErrorMessage } from "@/lib/api-error";
import { fileServeUrl } from "@/lib/file-url";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const guest = await prisma.guest.findFirst({
      where: { id: params.id, seatId: session.seatId },
    });
    if (!guest) {
      return NextResponse.json({ error: "Гость не найден" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const docType = (formData.get("type") as string) || "passport";
    const hotelId = String(formData.get("hotelId") ?? "").trim();

    const aiCheck = hotelId
      ? await assertHotelAiEnabled(session.seatId, hotelId)
      : await assertGuestDocumentScanAllowed(session.seatId, guest.id);
    const aiUnavailable: { error: string; status: number } | null = !aiCheck.ok
      ? { error: aiCheck.error, status: aiCheck.status }
      : !process.env.AITUNNEL_API_KEY?.trim()
        ? { error: "Распознавание не настроено: добавьте AITUNNEL_API_KEY в .env", status: 503 }
        : null;

    if (!file?.size) {
      return NextResponse.json({ error: "Выберите файл" }, { status: 400 });
    }
    if (file.size > GUEST_DOC_MAX_BYTES) {
      return NextResponse.json({ error: "Файл больше 10 МБ" }, { status: 400 });
    }

    const mime = (file.type || "image/jpeg").toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: "Формат: JPEG, PNG, WebP или PDF" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let document;
    try {
      document = await storeGuestDocument(
        guest.id,
        { name: file.name, buffer, size: file.size },
        docType
      );
    } catch (e) {
      console.error("[document-scan] storage", e);
      return NextResponse.json(
        { error: apiErrorMessage(e, "Не удалось сохранить файл (проверьте S3 в .env)") },
        { status: 500 }
      );
    }

    const storedDocument = {
      id: document.id,
      name: document.name,
      filePath: fileServeUrl(document.filePath),
      type: document.type,
    };

    // Без AI скан всё равно остаётся в профиле гостя — поля администратор заполнит вручную.
    if (aiUnavailable) {
      return NextResponse.json(
        { error: aiUnavailable.error, document: storedDocument, partial: true, aiUnavailable: true },
        { status: aiUnavailable.status }
      );
    }

    let extract;
    try {
      extract = await recognizeDocumentFromScan(buffer, mime, file.name);
    } catch (e) {
      return NextResponse.json(
        {
          error: apiErrorMessage(e, "Не удалось распознать документ"),
          document: storedDocument,
          partial: true,
        },
        { status: 422 }
      );
    }

    const filledFields = listFilledExtractFields(extract);
    const suggestedIsForeigner = extract.isForeigner;
    const isForeignerMismatch = suggestedIsForeigner !== guest.isForeigner;

    return NextResponse.json({
      ok: true,
      extract,
      filledFields,
      document: storedDocument,
      suggestedIsForeigner,
      isForeignerMismatch,
    });
  } catch (e) {
    console.error("[document-scan]", e);
    return NextResponse.json(
      { error: apiErrorMessage(e, "Ошибка распознавания") },
      { status: 500 }
    );
  }
}
