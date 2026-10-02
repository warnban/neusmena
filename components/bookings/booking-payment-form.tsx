"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CreditCard, Tag } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { DatePicker } from "@/components/ui/date-picker";
import { PaymentMethodPicker, type PaymentSelection } from "@/components/payments/payment-method-picker";
import { sumSplitParts, type PaymentSplitPart } from "@/lib/payment-split";
import { OperationDateField } from "@/components/ui/operation-date-field";
import { OtaChannelSelect } from "@/components/ui/ota-channel-select";
import { money, fmtDate } from "@/lib/format";
import { calcStayAmount } from "@/lib/booking-pricing";
import {
  accommodationPaidTotal,
  bookingNightlyRate,
  bookingStayNights,
  firstUnpaidNightDateKey,
  nightsFromFirstUnpaidToPaidThrough,
  paidThroughDateKey,
  prepaidNights,
} from "@/lib/booking-payment-due";
import { mskAddDays, mskDateKey, mskNightDiff } from "@/lib/msk-time";
import { OTA_PAYMENT_CODE } from "@/lib/finance";
import {
  activeRulesForHotel,
  calcPaymentWithRule,
  formatRuleLabel,
  hotelHasDiscountRules,
  paymentNightlyWithRule,
  ruleUnmetReason,
} from "@/lib/hotel-discount-rules";
import type { Booking, Transaction } from "@/lib/types";
import { contractAfterNightPayment, unpaidNightTariff } from "@/lib/stay-contract";
import {
  STAY_EXTRAS,
  STAY_EXTRA_CODES,
  hasStayExtra,
  stayExtraFee,
  stayExtrasTotal,
  type StayExtraCode,
} from "@/lib/stay-extras";

export type BookingPaymentPayload = {
  amount: number;
  nights: number;
  paidThroughDate: string;
  paymentMethod: string;
  splits?: PaymentSplitPart[];
  note?: string;
  channelId?: string;
  discountPercent: number;
  discountPerNight: number;
  discountRuleId?: string;
  operationDate?: string;
  /** Новые доплаты: ранний заезд / поздний выезд. `amount` — только оплата ночей. */
  extras?: StayExtraCode[];
};

type PeriodMode = "nights" | "date";

export function BookingPaymentForm({
  booking,
  roomPrice,
  transactions,
  onSubmit,
  busy = false,
  showSubmit = true,
}: {
  booking: Booking;
  roomPrice: number;
  transactions?: Transaction[];
  onSubmit: (payload: BookingPaymentPayload) => Promise<boolean>;
  busy?: boolean;
  showSubmit?: boolean;
}) {
  const { pmConfig, channels, hotelDiscountRules, canManageSettings } = useApp();
  const checkOutKey = mskDateKey(booking.checkOut);
  const stayNights = bookingStayNights(booking);

  const hotelRules = useMemo(
    () => activeRulesForHotel(hotelDiscountRules, booking.hotelId),
    [hotelDiscountRules, booking.hotelId]
  );
  const useRules = hotelHasDiscountRules(hotelDiscountRules, booking.hotelId);

  const [discountPercent, setDiscountPercent] = useState(String(booking.discountPercent ?? 0));
  const [discountPerNight, setDiscountPerNight] = useState(String(booking.discountPerNight ?? 0));
  /** Выбранное правило отеля; пустая строка = без скидки. */
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("nights");
  const [nightsCount, setNightsCount] = useState("1");
  const [paidThrough, setPaidThrough] = useState("");
  const [paymentSel, setPaymentSel] = useState<PaymentSelection>({ mode: "single", method: "cash" });
  const [channelId, setChannelId] = useState("");
  const [note, setNote] = useState("");
  const [operationDate, setOperationDate] = useState(() => mskDateKey());
  const [extrasSel, setExtrasSel] = useState<StayExtraCode[]>([]);
  const [error, setError] = useState("");
  const [amountDraft, setAmountDraft] = useState("");
  const [amountManual, setAmountManual] = useState(false);
  /** Своя цена одной ночи. null — сумма следует за тарифом и скидкой. */
  const manualNightly = useRef<number | null>(null);

  useEffect(() => {
    if (!useRules) {
      setDiscountPercent(String(booking.discountPercent ?? 0));
      setDiscountPerNight(String(booking.discountPerNight ?? 0));
    }
    manualNightly.current = null;
    setAmountManual(false);
  }, [booking.id, booking.discountPercent, booking.discountPerNight, booking.paid, booking.amount, useRules]);

  const pct = Math.max(0, Math.min(100, Math.round(Number(discountPercent) || 0)));
  const perNight = Math.max(0, Math.round(Number(discountPerNight) || 0));
  const discountChanged =
    !useRules && (pct !== (booking.discountPercent ?? 0) || perNight !== (booking.discountPerNight ?? 0));

  const quoteAmount = useMemo(
    () =>
      calcStayAmount({
        roomPrice,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        discountPercent: pct,
        discountPerNight: perNight,
        extras: stayExtrasTotal(booking),
      }),
    [roomPrice, booking, pct, perNight]
  );

  const contractAmount = booking.amount;
  const totalAmount = discountChanged ? quoteAmount : contractAmount;

  const effectivePaid = useMemo(
    () => accommodationPaidTotal(booking, transactions),
    [booking, transactions]
  );

  const contractBooking = useMemo(
    () => ({ ...booking, paid: effectivePaid, amount: contractAmount }),
    [booking, effectivePaid, contractAmount]
  );

  const contractNightly = bookingNightlyRate(contractBooking);
  const quoteNightly =
    stayNights > 0 ? Math.round(Math.max(0, quoteAmount - stayExtrasTotal(booking)) / stayNights) : 0;

  const firstUnpaidKey = firstUnpaidNightDateKey(contractBooking, undefined, transactions);
  const currentPaidThrough = paidThroughDateKey(contractBooking, undefined, transactions);
  const prepaid = prepaidNights(contractBooking, undefined, transactions);
  const maxPaidThroughKey = checkOutKey;
  const unpaidNightsLeft = Math.max(0, mskNightDiff(firstUnpaidKey, checkOutKey));
  const allNightsPaid = unpaidNightsLeft <= 0;
  const maxPayNights = Math.max(1, unpaidNightsLeft);

  const extraFee = stayExtraFee(discountChanged ? quoteNightly : contractNightly);
  const extrasSum = extrasSel.length * extraFee;
  const nightsOptional = extrasSel.length > 0;

  const selectedNights = useMemo(() => {
    if (allNightsPaid) return 0;
    if (periodMode === "nights") {
      const raw = Math.round(Number(nightsCount) || 0);
      if (nightsOptional && raw <= 0) return 0;
      return Math.min(Math.max(1, raw), maxPayNights);
    }
    if (!paidThrough) return 1;
    const n = nightsFromFirstUnpaidToPaidThrough(firstUnpaidKey, paidThrough);
    return Math.max(1, Math.min(n, maxPayNights));
  }, [allNightsPaid, periodMode, nightsCount, nightsOptional, paidThrough, firstUnpaidKey, maxPayNights]);

  const selectedPaidThrough = useMemo(() => {
    if (periodMode === "date" && paidThrough) return paidThrough;
    return mskAddDays(firstUnpaidKey, selectedNights);
  }, [periodMode, paidThrough, firstUnpaidKey, selectedNights]);

  const isSplit = paymentSel.mode === "split";
  const method = paymentSel.mode === "single" ? paymentSel.method : (paymentSel.parts[0]?.method ?? "cash");

  const pmEntries = Object.entries(pmConfig);
  const pmLabels = useMemo(
    () => Object.fromEntries(pmEntries.map(([k, v]) => [k, v.label])),
    [pmEntries]
  );

  const selectedRule = useMemo(() => {
    if (!useRules || isSplit || !selectedRuleId) return null;
    return hotelRules.find((r) => r.id === selectedRuleId) ?? null;
  }, [useRules, isSplit, selectedRuleId, hotelRules]);

  const selectedRuleUnmet = useMemo(() => {
    if (!selectedRule) return null;
    return ruleUnmetReason(selectedRule, { paymentNights: selectedNights, paymentMethod: method }, pmLabels);
  }, [selectedRule, selectedNights, method, pmLabels]);

  const appliedRule = selectedRule && !selectedRuleUnmet ? selectedRule : null;

  const paymentNightly = useRules
    ? isSplit
      ? roomPrice
      : paymentNightlyWithRule(roomPrice, selectedNights, appliedRule)
    : discountChanged
      ? quoteNightly
      : contractNightly;

  const paymentAmount =
    selectedNights <= 0
      ? 0
      : useRules
        ? isSplit
          ? selectedNights * roomPrice
          : calcPaymentWithRule(roomPrice, selectedNights, appliedRule)
        : selectedNights * paymentNightly;

  useEffect(() => {
    if (manualNightly.current == null) {
      setAmountDraft(selectedNights > 0 ? String(paymentAmount) : "0");
      return;
    }
    if (selectedNights > 0) setAmountDraft(String(manualNightly.current * selectedNights));
  }, [paymentAmount, selectedNights, booking.id]);

  const nightsAmount = selectedNights <= 0 ? 0 : Math.max(0, Math.round(Number(amountDraft) || 0));
  const totalToPay = nightsAmount + extrasSum;
  const splitTarget = totalToPay;
  const openTariff = unpaidNightTariff({
    amount: contractAmount,
    paid: effectivePaid,
    stayNights,
    prepaidNights: prepaid,
    fallbackTariff: roomPrice,
  });
  const nextContract = contractAfterNightPayment({
    amount: contractAmount,
    nights: selectedNights,
    nightsAmount,
    tariffPerNight: openTariff,
    extrasAmount: extrasSum,
  });
  const nextDue = Math.max(0, nextContract - (effectivePaid + totalToPay));
  const priceIsCustom = amountManual && selectedNights > 0 && Math.abs(nightsAmount - paymentAmount) > 1;

  const contractDebt = Math.max(0, contractAmount + extrasSum - effectivePaid);

  function toggleExtra(code: StayExtraCode) {
    setExtrasSel((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  useEffect(() => {
    setPaidThrough(mskAddDays(firstUnpaidKey, Math.max(1, selectedNights)));
  }, [firstUnpaidKey, selectedNights]);

  async function handleSubmit() {
    setError("");
    if (totalToPay <= 0) {
      setError("Сумма оплаты должна быть больше нуля");
      return;
    }
    if (selectedRuleUnmet) {
      setError(`Условия скидки не выполнены: ${selectedRuleUnmet}`);
      return;
    }
    if (isSplit) {
      if (paymentSel.parts.some((p) => p.amount <= 0)) {
        setError("Сумма каждого способа должна быть больше нуля");
        return;
      }
      if (sumSplitParts(paymentSel.parts) !== totalToPay) {
        setError("Распределите всю сумму по способам оплаты");
        return;
      }
    } else if (method === OTA_PAYMENT_CODE && !channelId) {
      setError("Выберите канал OTA");
      return;
    }
    const ok = await onSubmit({
      amount: nightsAmount,
      nights: selectedNights,
      paidThroughDate: selectedNights > 0 ? selectedPaidThrough : "",
      extras: extrasSel.length ? extrasSel : undefined,
      paymentMethod: method,
      splits: isSplit ? paymentSel.parts : undefined,
      note: note.trim() || undefined,
      channelId: !isSplit && method === OTA_PAYMENT_CODE ? channelId : undefined,
      discountPercent: useRules ? 0 : pct,
      discountPerNight: useRules ? 0 : perNight,
      discountRuleId:
        isSplit || !appliedRule || Math.abs(nightsAmount - paymentAmount) > 1 ? undefined : appliedRule.id,
      operationDate: canManageSettings ? operationDate : undefined,
    });
    if (!ok) setError("Не удалось принять платёж");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[["Стоимость", money(totalAmount + extrasSum), "text-foreground"], ["Оплачено", money(effectivePaid), "text-success"], ["По договору", money(contractDebt), contractDebt > 0 ? "text-destructive" : "text-success"]].map(([l, v, c]) => (
          <div key={String(l)} className="rounded-xl p-3 text-center bg-muted border border-border">
            <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">{l}</div>
            <div className={`text-[18px] font-black ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-4 bg-muted/60 border border-border space-y-2 text-[12px]">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Тариф по договору</span>
          <span className="font-semibold text-right">{money(contractNightly)}/сут.</span>
        </div>
        {STAY_EXTRA_CODES.filter((code) => hasStayExtra(booking, code)).map((code) => (
          <div key={code} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{STAY_EXTRAS[code].label} ({STAY_EXTRAS[code].hours})</span>
            <span className="font-semibold text-right">{money(booking[STAY_EXTRAS[code].field] ?? 0)}</span>
          </div>
        ))}
        {prepaid > 0 && currentPaidThrough && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Сейчас оплачено до</span>
            <span className="font-semibold">{fmtDate(parseMskDate(currentPaidThrough))} 12:00 · {prepaid} н.</span>
          </div>
        )}
        <div className="flex justify-between gap-2 pt-1 border-t border-border">
          <span className="text-muted-foreground">Следующая оплата с</span>
          <span className="font-bold text-foreground">{fmtDate(parseMskDate(firstUnpaidKey))}</span>
        </div>
        {effectivePaid > booking.paid && (
          <p className="text-[10px] text-muted-foreground">
            Включая платёж при заселении ({money(effectivePaid - booking.paid)} из транзакций)
          </p>
        )}
      </div>

      {useRules ? (
        <div className="rounded-xl p-4 border border-border bg-muted/40 space-y-3">
          <div className="flex items-start gap-3">
            <Tag size={16} className={appliedRule ? "text-success mt-0.5" : "text-muted-foreground mt-0.5"} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-muted-foreground uppercase mb-1">Скидка по правилам отеля</div>
              <p className="text-[11px] text-muted-foreground">
                {isSplit
                  ? "При смежной оплате скидка недоступна — полный тариф."
                  : "По умолчанию без скидки. Выберите правило, если условия выполнены."}
              </p>
            </div>
          </div>
          {!isSplit && (
            <div className="space-y-2">
              <label
                className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                  !selectedRuleId ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="discount-rule"
                  checked={!selectedRuleId}
                  onChange={() => setSelectedRuleId("")}
                  className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-foreground">Без скидки</span>
                  <span className="block text-[11px] text-muted-foreground">Полный тариф · {money(selectedNights * roomPrice)}</span>
                </span>
              </label>
              {hotelRules.map((rule) => {
                const unmet = ruleUnmetReason(
                  rule,
                  { paymentNights: selectedNights, paymentMethod: method },
                  pmLabels
                );
                const checked = selectedRuleId === rule.id;
                const withDiscount = calcPaymentWithRule(roomPrice, Math.max(1, selectedNights), rule);
                return (
                  <label
                    key={rule.id}
                    className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                      checked && !unmet
                        ? "border-emerald-500 bg-emerald-500/10"
                        : checked && unmet
                          ? "border-destructive/50 bg-destructive/5"
                          : unmet
                            ? "border-border opacity-70"
                            : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="discount-rule"
                      checked={checked}
                      onChange={() => setSelectedRuleId(rule.id)}
                      className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-foreground">
                        {formatRuleLabel(rule, pmLabels)}
                      </span>
                      {unmet ? (
                        <span className="block text-[11px] text-destructive mt-0.5">Недоступно: {unmet}</span>
                      ) : (
                        <span className="block text-[11px] text-muted-foreground mt-0.5">
                          К оплате {money(withDiscount)}
                          {selectedNights > 0
                            ? ` · экономия ${money(selectedNights * roomPrice - withDiscount)}`
                            : ""}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
              {selectedRuleUnmet && (
                <p className="text-[12px] text-destructive font-semibold">
                  Выбранная скидка сейчас не подходит: {selectedRuleUnmet}. Будет полный тариф, пока не смените условия или скидку.
                </p>
              )}
              {appliedRule && selectedNights > 0 && (
                <p className="text-[12px] font-semibold text-success">
                  Скидка применена · экономия {money(selectedNights * roomPrice - paymentAmount)}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Скидка, %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Скидка, ₽/сут.</label>
            <input
              type="number"
              min={0}
              value={discountPerNight}
              onChange={(e) => setDiscountPerNight(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {STAY_EXTRA_CODES.some((code) => !hasStayExtra(booking, code)) && (
        <fieldset>
          <legend className="text-[12px] font-bold text-muted-foreground mb-2">Дополнительно к проживанию</legend>
          <div className="space-y-2">
            {STAY_EXTRA_CODES.filter((code) => !hasStayExtra(booking, code)).map((code) => {
              const checked = extrasSel.includes(code);
              return (
                <label
                  key={code}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                    checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleExtra(code)}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold text-foreground">{STAY_EXTRAS[code].label}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {STAY_EXTRAS[code].hours} · 50% стоимости суток
                    </span>
                  </span>
                  <span className="text-[13px] font-bold text-foreground">+{money(extraFee)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {allNightsPaid ? (
        <p className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-[12px] text-muted-foreground">
          Все ночи до выезда уже оплачены{extrasSel.length ? " — будет оплачена только доплата." : "."}
        </p>
      ) : (
      <div>
        <label className="text-[12px] font-bold text-muted-foreground block mb-2">Период оплаты</label>
        <div className="flex gap-2 mb-3">
          {([
            ["nights", "Кол-во ночей"],
            ["date", "Оплачено до"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPeriodMode(id)}
              className="flex-1 py-2 text-[12px] font-bold rounded-lg border transition-all"
              style={{
                borderColor: periodMode === id ? "#10B981" : "hsl(var(--border))",
                background: periodMode === id ? "hsl(var(--success) / 0.1)" : undefined,
                color: periodMode === id ? "#059669" : undefined,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {periodMode === "nights" ? (
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Ночей</label>
            <input
              type="number"
              min={nightsOptional ? 0 : 1}
              max={maxPayNights}
              value={nightsCount}
              onChange={(e) => setNightsCount(e.target.value)}
              className="w-full px-3 py-2.5 text-[15px] font-bold rounded-xl border border-border bg-muted outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {selectedNights > 0
                ? `До ${fmtDate(parseMskDate(selectedPaidThrough))} 12:00`
                : "Без оплаты ночей — только доплата"}
            </p>
          </div>
        ) : (
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Оплачено до (до 12:00)</label>
            <DatePicker
              mode="iso"
              value={paidThrough}
              onChange={setPaidThrough}
              min={mskAddDays(firstUnpaidKey, 1)}
              max={maxPaidThroughKey}
              className="w-full"
            />
            <p className="text-[10px] text-muted-foreground mt-1">{selectedNights} ноч. · {money(nightsAmount)}</p>
          </div>
        )}
      </div>
      )}

      <div className="rounded-xl p-3 border-2 border-primary/30 bg-primary/5 space-y-2">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <label htmlFor="pay-amount" className="text-[11px] font-bold text-muted-foreground uppercase">Сумма за ночи</label>
            {selectedNights > 0 && (
              <div className="text-[10px] text-muted-foreground">
                {selectedNights} ноч. · тариф {money(openTariff)}/сут
              </div>
            )}
            {extrasSel.map((code) => (
              <div key={code} className="text-[10px] text-muted-foreground">
                + {STAY_EXTRAS[code].label.toLowerCase()} {money(extraFee)}
              </div>
            ))}
          </div>
          <input
            id="pay-amount"
            inputMode="numeric"
            value={amountDraft}
            disabled={selectedNights <= 0}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d]/g, "");
              setAmountDraft(raw);
              const next = Math.round(Number(raw) || 0);
              manualNightly.current = selectedNights > 0 ? Math.round(next / selectedNights) : null;
              setAmountManual(true);
            }}
            className="w-36 px-3 py-2 text-right text-[22px] font-black text-primary rounded-xl border border-primary/30 bg-background outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">
            {priceIsCustom ? `Своя цена · после оплаты к оплате ${money(nextDue)}` : `После оплаты к оплате ${money(nextDue)}`}
            {extrasSum > 0 ? ` · всего сейчас ${money(totalToPay)}` : ""}
          </span>
          {priceIsCustom && (
            <button
              type="button"
              className="font-semibold text-primary shrink-0"
              onClick={() => {
                manualNightly.current = null;
                setAmountManual(false);
                setAmountDraft(selectedNights > 0 ? String(paymentAmount) : "0");
              }}
            >
              По расчёту
            </button>
          )}
        </div>
      </div>

      <div>
        <PaymentMethodPicker
          pmConfig={pmConfig}
          total={splitTarget}
          value={paymentSel}
          onChange={(sel) => {
            setPaymentSel(sel);
            if (sel.mode !== "single" || sel.method !== OTA_PAYMENT_CODE) setChannelId("");
          }}
        />
        {!isSplit && method === OTA_PAYMENT_CODE && (
          <div className="mt-3">
            <OtaChannelSelect hotelId={booking.hotelId} channels={channels} value={channelId} onChange={setChannelId} />
          </div>
        )}
        {isSplit && useRules && (
          <p className="text-[11px] text-muted-foreground mt-2">
            При смежной оплате скидка по правилам отеля не применяется — расчёт по полному тарифу.
          </p>
        )}
      </div>

      <div>
        <label className="text-[12px] font-bold text-muted-foreground block mb-1.5">Примечание</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Необязательно..."
          className="w-full px-3 py-2 text-[12px] rounded-xl outline-none focus:ring-1 focus:ring-ring border border-border bg-muted text-foreground"
        />
      </div>

      <OperationDateField
        enabled={canManageSettings}
        value={operationDate}
        onChange={setOperationDate}
      />

      {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}

      {showSubmit && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={
            busy ||
            totalToPay <= 0 ||
            !!selectedRuleUnmet ||
            (!isSplit && method === OTA_PAYMENT_CODE && !channelId) ||
            (isSplit && sumSplitParts(paymentSel.parts) !== totalToPay)
          }
          className="w-full flex items-center justify-center gap-2 py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
          style={{ background: "hsl(var(--success))" }}
        >
          <CreditCard size={14} /> Принять платёж
        </button>
      )}
    </div>
  );
}

function parseMskDate(key: string): Date {
  return new Date(`${key.slice(0, 10)}T12:00:00+03:00`);
}
