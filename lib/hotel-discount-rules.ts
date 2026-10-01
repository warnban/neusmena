import type { HotelDiscountRule } from "@/lib/types";

export type { HotelDiscountRule };

export function calcNightPaymentTotal(
  roomPrice: number,
  nights: number,
  discountPercent = 0,
  discountPerNight = 0
): number {
  const n = Math.max(1, Math.round(nights));
  const base = roomPrice * n;
  let total = base;
  if (discountPercent > 0) {
    total = Math.round(base * (1 - discountPercent / 100));
  }
  if (discountPerNight > 0) {
    total = Math.max(0, total - discountPerNight * n);
  }
  return total;
}

export function calcPaymentWithRule(
  roomPrice: number,
  nights: number,
  rule: Pick<HotelDiscountRule, "discountPercent" | "discountPerNight"> | null
): number {
  if (!rule) return calcNightPaymentTotal(roomPrice, nights, 0, 0);
  return calcNightPaymentTotal(roomPrice, nights, rule.discountPercent, rule.discountPerNight);
}

export function paymentNightlyWithRule(
  roomPrice: number,
  nights: number,
  rule: Pick<HotelDiscountRule, "discountPercent" | "discountPerNight"> | null
): number {
  const n = Math.max(1, Math.round(nights));
  return Math.round(calcPaymentWithRule(roomPrice, n, rule) / n);
}

export function ruleMatches(
  rule: HotelDiscountRule,
  params: { paymentNights: number; paymentMethod: string }
): boolean {
  if (!rule.active) return false;
  if (params.paymentNights < rule.minNights) return false;
  if (rule.paymentMethod && rule.paymentMethod !== params.paymentMethod) return false;
  if (rule.discountPercent <= 0 && rule.discountPerNight <= 0) return false;
  return true;
}

/** Почему правило не подходит к оплате; null — условия выполнены. */
export function ruleUnmetReason(
  rule: HotelDiscountRule,
  params: { paymentNights: number; paymentMethod: string },
  pmLabels?: Record<string, string>
): string | null {
  if (!rule.active) return "скидка отключена";
  if (rule.discountPercent <= 0 && rule.discountPerNight <= 0) return "размер скидки не задан";
  if (params.paymentNights < rule.minNights) return `нужна оплата от ${rule.minNights} ноч.`;
  if (rule.paymentMethod && rule.paymentMethod !== params.paymentMethod) {
    return `только при оплате «${pmLabels?.[rule.paymentMethod] ?? rule.paymentMethod}»`;
  }
  return null;
}

/** Лучшее правило: максимальный minNights среди подходящих (наиболее выгодный tier). */
export function matchDiscountRule(
  rules: HotelDiscountRule[],
  params: { paymentNights: number; paymentMethod: string }
): HotelDiscountRule | null {
  const matching = rules
    .filter((r) => ruleMatches(r, params))
    .sort((a, b) => b.minNights - a.minNights || b.sortOrder - a.sortOrder);
  return matching[0] ?? null;
}

export function activeRulesForHotel(rules: HotelDiscountRule[], hotelId: string): HotelDiscountRule[] {
  return rules
    .filter((r) => r.hotelId === hotelId && r.active)
    .sort((a, b) => a.minNights - b.minNights || a.sortOrder - b.sortOrder);
}

export function hotelHasDiscountRules(rules: HotelDiscountRule[], hotelId: string): boolean {
  return rules.some((r) => r.hotelId === hotelId && r.active);
}

export function formatRuleDiscount(rule: Pick<HotelDiscountRule, "discountPercent" | "discountPerNight">): string {
  const parts: string[] = [];
  if (rule.discountPercent > 0) parts.push(`${rule.discountPercent}%`);
  if (rule.discountPerNight > 0) parts.push(`${rule.discountPerNight} ₽/сут.`);
  return parts.join(" + ") || "—";
}

export function formatRuleLabel(
  rule: HotelDiscountRule,
  pmLabels?: Record<string, string>
): string {
  const name = rule.name.trim();
  const discount = formatRuleDiscount(rule);
  const pm =
    rule.paymentMethod && pmLabels?.[rule.paymentMethod]
      ? pmLabels[rule.paymentMethod]
      : rule.paymentMethod
        ? rule.paymentMethod
        : "любой способ";
  const base = `от ${rule.minNights} ноч. · ${discount} · ${pm}`;
  return name ? `${name}: ${base}` : base;
}

export function validatePaymentDiscount(params: {
  rules: HotelDiscountRule[];
  hotelId: string;
  roomPrice: number;
  paymentNights: number;
  paymentMethod: string;
  amount: number;
  discountRuleId?: string | null;
  discountPercent?: number;
  discountPerNight?: number;
}): {
  ok: true;
  rule: HotelDiscountRule | null;
  expectedAmount: number;
  discountPercent: number;
  discountPerNight: number;
} | { ok: false; error: string } {
  const hotelRules = activeRulesForHotel(params.rules, params.hotelId);

  if (hotelRules.length > 0) {
    const fullAmount = calcPaymentWithRule(params.roomPrice, params.paymentNights, null);

    if (params.discountRuleId) {
      const chosen = hotelRules.find((r) => r.id === params.discountRuleId);
      if (!chosen) {
        return { ok: false, error: "Выбранная скидка не найдена или отключена" };
      }
      const unmet = ruleUnmetReason(chosen, {
        paymentNights: params.paymentNights,
        paymentMethod: params.paymentMethod,
      });
      if (unmet) {
        return { ok: false, error: `Условия скидки не выполнены: ${unmet}` };
      }
      const expectedAmount = calcPaymentWithRule(params.roomPrice, params.paymentNights, chosen);
      if (Math.abs(params.amount - expectedAmount) > 1) {
        return { ok: false, error: "Сумма не совпадает с тарифом и скидкой" };
      }
      return {
        ok: true,
        rule: chosen,
        expectedAmount,
        discountPercent: chosen.discountPercent,
        discountPerNight: chosen.discountPerNight,
      };
    }

    if (Math.abs(params.amount - fullAmount) > 1) {
      return { ok: false, error: "Сумма не совпадает с тарифом" };
    }
    if ((params.discountPercent ?? 0) > 0 || (params.discountPerNight ?? 0) > 0) {
      return { ok: false, error: "Выберите скидку из правил отеля" };
    }
    return {
      ok: true,
      rule: null,
      expectedAmount: fullAmount,
      discountPercent: 0,
      discountPerNight: 0,
    };
  }

  const pct = Math.max(0, Math.min(100, Math.round(params.discountPercent ?? 0)));
  const perNight = Math.max(0, Math.round(params.discountPerNight ?? 0));
  const expectedAmount = calcNightPaymentTotal(params.roomPrice, params.paymentNights, pct, perNight);
  if (Math.abs(params.amount - expectedAmount) > 1) {
    return { ok: false, error: "Сумма не совпадает с тарифом за выбранный период" };
  }
  return { ok: true, rule: null, expectedAmount, discountPercent: pct, discountPerNight: perNight };
}
