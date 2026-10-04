import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertHotelWrite } from "@/lib/permissions";
import {
  assertPaymentOperationAllowed,
  resolveTransactionDateInput,
} from "@/lib/transaction-date.server";
import { catalogItemCategory } from "@/lib/transaction-categories";
import {
  allocateSplitAcrossItems,
  isSplitPayment,
  newPaymentGroupId,
  sanitizeSplitParts,
  validateSplitParts,
} from "@/lib/payment-split";

type SaleItem = { serviceId: string; qty: number; amount?: number };

export async function POST(req: NextRequest) {
  const session = await import("@/lib/auth").then((m) => m.getSession());
  const body = await req.json();
  const hotelId = String(body.hotelId ?? "");
  const kind = body.kind === "expense" ? "expense" : "service";
  const paymentMethod = String(body.paymentMethod ?? "cash");
  const items = (body.items ?? []) as SaleItem[];
  const bookingId = body.bookingId ?? null;
  const guestName = body.guestName ?? null;
  const note = body.note ?? null;

  if (!hotelId || !items.length) {
    return NextResponse.json({ error: "Укажите отель и позиции" }, { status: 400 });
  }

  const auth = await assertHotelWrite(session, hotelId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const dateResolved = resolveTransactionDateInput(auth.session.role, body.date ?? body.operationDate);
  if (!dateResolved.ok) {
    return NextResponse.json({ error: dateResolved.error }, { status: dateResolved.status });
  }

  const payLock = await assertPaymentOperationAllowed(
    hotelId,
    auth.session.role,
    dateResolved.dateKey
  );
  if (!payLock.ok) return NextResponse.json({ error: payLock.error }, { status: payLock.status });

  const services = await prisma.service.findMany({
    where: {
      id: { in: items.map((i) => i.serviceId) },
      seatId: auth.session.seatId,
      kind: kind === "expense" ? "expense" : "service",
      active: true,
    },
  });
  if (services.length !== items.length) {
    return NextResponse.json({ error: "Некоторые позиции не найдены" }, { status: 400 });
  }

  let roomNumber: string | null = null;
  let resolvedGuestName = guestName;
  if (bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { room: true },
    });
    if (booking && booking.hotelId === hotelId) {
      roomNumber = booking.room.number;
      resolvedGuestName = resolvedGuestName ?? booking.guestName;
    }
  }

  const svcMap = Object.fromEntries(services.map((s) => [s.id, s]));
  const lineItems = items.map((item) => {
    const svc = svcMap[item.serviceId];
    const qty = Math.max(1, Math.round(Number(item.qty) || 1));
    const catalogSum = svc.price * qty;
    const requested = Math.round(Number(item.amount));
    const amount = Number.isFinite(requested) && requested >= 0 ? Math.min(requested, 10_000_000) : catalogSum;
    return { svc, qty, amount, category: catalogItemCategory(svc.name), name: svc.name };
  });
  const total = lineItems.reduce((sum, l) => sum + l.amount, 0);

  // Смежная (раздельная) оплата: одна операция несколькими способами.
  const splits = sanitizeSplitParts(body.splits);
  const useSplit = isSplitPayment(splits);
  if (useSplit) {
    const check = validateSplitParts(splits, total);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
  }
  const groupId = useSplit ? newPaymentGroupId() : null;
  const ops = [];
  const seatId = auth.session.seatId;
  if (seatId) {
    for (const category of Array.from(new Set(lineItems.map((line) => line.category)))) {
      ops.push(
        prisma.transactionCategoryDef.upsert({
          where: { seatId_code: { seatId, code: category } },
          create: { seatId, code: category, label: category },
          update: { label: category },
        })
      );
    }
  }

  if (kind === "service") {
    for (const line of lineItems) {
      ops.push(
        prisma.serviceSale.create({
          data: {
            hotelId,
            bookingId,
            serviceId: line.svc.id,
            guestName: resolvedGuestName ?? "",
            serviceName: line.svc.name,
            serviceCategory: line.svc.category,
            qty: line.qty,
            amount: line.amount,
            paymentMethod: useSplit ? splits[0].method : paymentMethod,
          },
        })
      );
    }
  }

  const txRows = useSplit
    ? allocateSplitAcrossItems(
        lineItems.map((l) => ({ category: l.category, name: l.name, amount: l.amount })),
        splits
      )
    : lineItems.map((l) => ({ category: l.category, name: l.name, amount: l.amount, method: paymentMethod }));

  for (const row of txRows) {
    ops.push(
      prisma.transaction.create({
        data: {
          hotelId,
          type: kind === "expense" ? "expense" : "service",
          category: row.category,
          paymentMethod: row.method,
          amount: row.amount,
          date: dateResolved.date,
          bookingId,
          guestName: resolvedGuestName,
          roomNumber,
          note: kind === "expense" ? (note ?? row.name) : note,
          ...(groupId ? { paymentGroupId: groupId } : {}),
        },
      })
    );
  }

  await prisma.$transaction(ops);
  return NextResponse.json({ ok: true, total });
}
