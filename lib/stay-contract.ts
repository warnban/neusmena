/** Верхняя граница одной оплаты проживания, чтобы опечатка не создала гигантский договор. */
export const MAX_NIGHT_PAYMENT = 10_000_000;

/**
 * Цена одной ещё не оплаченной ночи.
 * Остаток договора делится на неоплаченные ночи, поэтому уже внесённая своя цена
 * на следующие ночи не перетекает.
 */
export function unpaidNightTariff(params: {
  amount: number;
  paid: number;
  stayNights: number;
  prepaidNights: number;
  fallbackTariff: number;
}): number {
  const unpaid = Math.max(0, Math.round(params.stayNights) - Math.max(0, Math.round(params.prepaidNights)));
  if (unpaid <= 0) return Math.max(0, Math.round(params.fallbackTariff));
  const remainder = Math.max(0, Math.round(params.amount) - Math.round(params.paid));
  return Math.round(remainder / unpaid);
}

/**
 * Оплата `nights` ночей суммой `nightsAmount`.
 * Договор меняется на разницу с тарифом этих ночей. Доплаты (ранний заезд и т.п.) прибавляются как есть.
 */
export function contractAfterNightPayment(params: {
  amount: number;
  nights: number;
  nightsAmount: number;
  tariffPerNight: number;
  extrasAmount?: number;
}): number {
  const nights = Math.max(0, Math.round(params.nights));
  const nightsAmount = Math.max(0, Math.round(params.nightsAmount));
  const tariff = Math.max(0, Math.round(params.tariffPerNight));
  const extras = Math.max(0, Math.round(params.extrasAmount ?? 0));
  return Math.max(0, Math.round(params.amount) + (nightsAmount - nights * tariff) + extras);
}

/**
 * Ночи снова неоплачены и стоят тариф: отмена оплаты или возврат денег за них.
 * `releasedAmount` — сколько денег уходит из «оплачено».
 */
export function contractAfterReopeningNights(params: {
  amount: number;
  releasedAmount: number;
  nights: number;
  tariffPerNight: number;
}): number {
  const released = Math.max(0, Math.round(params.releasedAmount));
  const nights = Math.max(0, Math.round(params.nights));
  const tariff = Math.max(0, Math.round(params.tariffPerNight));
  return Math.max(0, Math.round(params.amount) - released + nights * tariff);
}

/** Продление или сокращение срока: каждая добавленная или снятая ночь по текущему тарифу неоплаченных. */
export function contractAfterStayNightDelta(amount: number, nightDelta: number, tariffPerNight: number): number {
  return Math.max(0, Math.round(amount) + Math.round(nightDelta) * Math.max(0, Math.round(tariffPerNight)));
}
