import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bookingStayNights, prepaidNights } from "@/lib/booking-payment-due";
import { contractAfterReopeningNights, unpaidNightTariff } from "@/lib/stay-contract";
import { isReportDayClosed } from "@/lib/transaction-manual.server";
import { mskDateKey } from "@/lib/msk-time";

const ACCOMMODATION = "accommodation";
const ALREADY_CANCELLED = "TX_ALREADY_CANCELLED";

export async function cancelTransaction(
  transactionId: string,
  seatId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!transactionId?.trim()) {
    return { ok: false, error: "Не указана транзакция" };
  }

  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, hotel: { seatId } },
  });

  if (!tx) return { ok: false, error: "Транзакция не найдена" };
  if (tx.cancelledAt) return { ok: false, error: "Транзакция уже отменена" };
  if (await isReportDayClosed(tx.hotelId, mskDateKey(tx.date))) {
    return { ok: false, error: "Сутки закрыты отчётом — сначала разблокируйте отчёт за этот день" };
  }

  const [booking, refundRecord, salaryEntry] = await Promise.all([
    tx.bookingId
      ? prisma.booking.findUnique({ where: { id: tx.bookingId } })
      : Promise.resolve(null),
    prisma.refundRecord.findUnique({ where: { transactionId: tx.id } }),
    prisma.salaryLedgerEntry.findUnique({ where: { transactionId: tx.id } }),
  ]);

  try {
    await prisma.$transaction(async (db) => {
      const [current] = await db.$queryRaw<{ cancelledAt: Date | null }[]>`
        SELECT "cancelledAt" FROM "Transaction" WHERE id = ${tx.id} FOR UPDATE`;
      if (!current || current.cancelledAt) throw new Error(ALREADY_CANCELLED);
      if (tx.bookingId) {
        await db.$queryRaw`SELECT id FROM "Booking" WHERE id = ${tx.bookingId} FOR UPDATE`;
      }

      if (tx.type === "payment" && tx.category === ACCOMMODATION && tx.bookingId && booking) {
        const stay = await db.booking.findUnique({
          where: { id: tx.bookingId },
          include: { room: true },
        });
        const txs = await db.transaction.findMany({
          where: { bookingId: tx.bookingId, category: ACCOMMODATION, cancelledAt: null },
        });
        const nights = Math.max(0, tx.paymentNights ?? 0);
        const tariff = stay
          ? unpaidNightTariff({
              amount: stay.amount,
              paid: stay.paid,
              stayNights: bookingStayNights(stay),
              prepaidNights: prepaidNights(stay, undefined, txs),
              fallbackTariff: Math.max(0, stay.room?.price ?? 0),
            })
          : 0;
        const othersInGroup =
          tx.paymentGroupId && nights > 0
            ? txs.filter(
                (row) =>
                  row.id !== tx.id &&
                  row.type === "payment" &&
                  !row.stayExtra &&
                  row.paymentGroupId === tx.paymentGroupId &&
                  (row.paymentNights ?? 0) > 0
              ).length
            : 0;
        const reopen = !tx.stayExtra && nights > 0 && othersInGroup === 0;
        const nextAmount = stay
          ? tx.stayExtra
            ? Math.max(0, stay.amount - tx.amount)
            : reopen
              ? contractAfterReopeningNights({
                  amount: stay.amount,
                  releasedAmount: tx.amount,
                  nights,
                  tariffPerNight: tariff,
                })
              : Math.max(0, stay.amount - tx.amount)
          : booking.amount;
        await db.booking.update({
          where: { id: tx.bookingId },
          data: {
            paid: Math.max(0, (stay ?? booking).paid - tx.amount),
            amount: nextAmount,
          },
        });
      }

      if (tx.type === "refund" && tx.bookingId && booking) {
        const stay = await db.booking.findUnique({
          where: { id: tx.bookingId },
          include: { room: true },
        });
        const txs = stay
          ? await db.transaction.findMany({
              where: { bookingId: stay.id, category: ACCOMMODATION, cancelledAt: null },
            })
          : [];
        const nights = Math.max(0, tx.paymentNights ?? 0);
        const tariff = stay
          ? unpaidNightTariff({
              amount: stay.amount,
              paid: stay.paid,
              stayNights: bookingStayNights(stay),
              prepaidNights: prepaidNights(stay, undefined, txs),
              fallbackTariff: Math.max(0, stay.room?.price ?? 0),
            })
          : 0;
        const restoredAmount = stay
          ? Math.max(0, stay.amount + tx.amount - nights * tariff)
          : booking.amount;
        await db.booking.update({
          where: { id: tx.bookingId },
          data: {
            paid: Math.min(restoredAmount, (stay ?? booking).paid + tx.amount),
            amount: restoredAmount,
          },
        });
        if (refundRecord) {
          await db.refundRecord.delete({ where: { id: refundRecord.id } });
        }
      }

      if (tx.type === "payment" && tx.category === ACCOMMODATION && tx.organizationStayId) {
        const stay = await db.organizationStay.findUnique({
          where: { id: tx.organizationStayId },
          include: { organization: true },
        });
        if (stay) {
          await db.organizationStay.update({
            where: { id: stay.id },
            data: { paid: Math.max(0, stay.paid - tx.amount) },
          });
          await db.organization.update({
            where: { id: stay.organizationId },
            data: { totalSpent: Math.max(0, stay.organization.totalSpent - tx.amount) },
          });
        }
      }

      if (tx.type === "service" && tx.bookingId) {
        const sale = await db.serviceSale.findFirst({
          where: {
            bookingId: tx.bookingId,
            amount: tx.amount,
            paymentMethod: tx.paymentMethod,
          },
          orderBy: { date: "desc" },
        });
        if (sale) await db.serviceSale.delete({ where: { id: sale.id } });
      }

      if (salaryEntry) {
        await db.salaryLedgerEntry.delete({ where: { id: salaryEntry.id } });
      }

      await db.transaction.update({
        where: { id: tx.id },
        data: {
          cancelledAt: new Date(),
          cancelledByUserId: userId,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === ALREADY_CANCELLED) {
      return { ok: false, error: "Транзакция уже отменена" };
    }
    console.error("[cancelTransaction]", e);
    if (e instanceof Prisma.PrismaClientValidationError) {
      const msg = e.message;
      if (msg.includes("cancelledAt") || msg.includes("cancelledByUserId")) {
        return {
          ok: false,
          error:
            "Схема БД не обновлена. Выполните: npx prisma db push && npx prisma generate, затем перезапустите сервер",
        };
      }
      return { ok: false, error: "Ошибка валидации данных при отмене" };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
      return {
        ok: false,
        error:
          "В БД нет полей отмены транзакции. Выполните: npx prisma db push, затем перезапустите сервер",
      };
    }
    if (e instanceof Error && e.message) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Не удалось отменить транзакцию" };
  }

  return { ok: true };
}
