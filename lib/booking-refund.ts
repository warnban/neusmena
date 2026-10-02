import { prisma } from "@/lib/prisma";
import {
  accommodationPaymentTransactions,
  accommodationPaidTotal,
  bookingNightlyRate,
  nightsConsumedThrough,
  prepaidNights,
} from "@/lib/booking-payment-due";
import { calcNightPaymentTotal } from "@/lib/hotel-discount-rules";
import type { HotelDiscountRule } from "@/lib/hotel-discount-rules";
import { computeRefundQuote, type AccommodationPaymentSlice } from "@/lib/refund-pricing";
import type { Booking } from "@/lib/types";

export function refundableNights(
  booking: Parameters<typeof prepaidNights>[0],
  dateKey?: string,
  transactions?: Parameters<typeof prepaidNights>[2],
  refundNights?: number
): number {
  const prepaid = prepaidNights(booking, undefined, transactions, refundNights);
  const consumed = nightsConsumedThrough(booking, dateKey);
  return Math.max(0, prepaid - consumed);
}

export function refundAmountForNights(booking: Booking, nights: number): number {
  return nights * bookingNightlyRate(booking);
}

export function canRefundBooking(
  booking: Parameters<typeof prepaidNights>[0] & { status: string },
  dateKey?: string,
  transactions?: Parameters<typeof prepaidNights>[2],
  refundNights?: number
): boolean {
  if (booking.status !== "checkedin" && booking.status !== "checkedout" && booking.status !== "confirmed") {
    return false;
  }
  if (accommodationPaidTotal(booking, transactions) <= 0) return false;
  return refundableNights(booking, dateKey, transactions, refundNights) > 0;
}

export async function loadRefundContext(bookingId: string, hotelId: string, seatId: string) {
  const [booking, rules, transactions, refundRecords] = await Promise.all([
    prisma.booking.findFirst({
      where: { id: bookingId, hotelId, hotel: { seatId } },
      include: { room: true },
    }),
    prisma.hotelDiscountRule.findMany({
      where: { hotelId, active: true },
      orderBy: [{ minNights: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.transaction.findMany({
      where: { bookingId, category: "accommodation", cancelledAt: null },
      orderBy: { date: "asc" },
    }),
    prisma.refundRecord.findMany({
      where: { bookingId },
      select: { nights: true, bookingId: true },
    }),
  ]);

  if (!booking) return null;

  const refundNightsTotal = refundRecords.reduce((s, r) => s + r.nights, 0);
  const roomPrice = booking.room.price;
  const rawPayments = accommodationPaymentTransactions(bookingId, transactions);

  // Смежные (split) части одного платежа: nights одинаковые у всех, суммы разные.
  // При построении payment slices слепляем их в одну запись: nights один раз,
  // amount — сумма частей, dominant paymentMethod и скидки — из первой части.
  const bySlice = new Map<string, {
    nights: number;
    amount: number;
    methodTotals: Map<string, number>;
    discountPercent: number;
    discountPerNight: number;
    discountRuleId: string | null | undefined;
  }>();
  const singles: AccommodationPaymentSlice[] = [];

  for (const t of rawPayments) {
    const discountPercent = t.discountPercentApplied ?? 0;
    const discountPerNight = t.discountPerNightApplied ?? 0;
    let nights = t.paymentNights ?? 0;
    if (nights <= 0 && t.amount > 0) {
      const sampleNightly = Math.max(1, calcNightPaymentTotal(roomPrice, 1, discountPercent, discountPerNight));
      nights = Math.max(1, Math.round(t.amount / sampleNightly));
    }
    if (t.paymentGroupId) {
      const g = bySlice.get(t.paymentGroupId);
      if (g) {
        g.amount += t.amount;
        g.methodTotals.set(t.paymentMethod, (g.methodTotals.get(t.paymentMethod) ?? 0) + t.amount);
      } else {
        bySlice.set(t.paymentGroupId, {
          nights,
          amount: t.amount,
          methodTotals: new Map([[t.paymentMethod, t.amount]]),
          discountPercent,
          discountPerNight,
          discountRuleId: t.discountRuleId,
        });
      }
    } else {
      singles.push({
        nights,
        amount: t.amount,
        paymentMethod: t.paymentMethod,
        discountPercent,
        discountPerNight,
        discountRuleId: t.discountRuleId,
      });
    }
  }

  const grouped: AccommodationPaymentSlice[] = Array.from(bySlice.values()).map((g) => {
    let dominantMethod = "cash";
    let bestSum = -1;
    for (const [m, s] of Array.from(g.methodTotals.entries())) {
      if (s > bestSum) { dominantMethod = m; bestSum = s; }
    }
    return {
      nights: g.nights,
      amount: g.amount,
      paymentMethod: dominantMethod,
      discountPercent: g.discountPercent,
      discountPerNight: g.discountPerNight,
      discountRuleId: g.discountRuleId,
    };
  });

  const payments: AccommodationPaymentSlice[] = [...singles, ...grouped];

  const bookingDto = {
    ...booking,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
  };

    return {
      booking: bookingDto,
      roomPrice,
      roomNumber: booking.room.number,
      rules: rules as HotelDiscountRule[],
    payments,
    refundNightsTotal,
    transactions,
  };
}

export function buildRefundQuoteFromContext(
  ctx: NonNullable<Awaited<ReturnType<typeof loadRefundContext>>>,
  refundNights: number,
  withholdNights: number
) {
  const consumed = nightsConsumedThrough(ctx.booking);
  const prepaid = prepaidNights(ctx.booking, undefined, ctx.transactions, ctx.refundNightsTotal);

  return computeRefundQuote({
    booking: ctx.booking,
    roomPrice: ctx.roomPrice,
    rules: ctx.rules,
    payments: ctx.payments,
    refundNights,
    withholdNights,
    consumedNights: consumed,
    prepaidNights: prepaid,
  });
}
