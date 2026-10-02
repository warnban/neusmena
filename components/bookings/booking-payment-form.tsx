"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CreditCard } from "lucide-react";
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
  matchDiscountRule,
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
  const suggestedRule = useMemo(() => {
    if (!useRules || isSplit || selectedNights <= 0) return null;
    return matchDiscountRule(hotelRules, { paymentNights: selectedNights, paymentMethod: method });
  }, [useRules, isSplit, selectedNights, hotelRules, method]);

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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-[12px]">
        <span>Тариф <b>{money(contractNightly)}</b></span>
        <span>Оплачено <b className="text-success">{money(effectivePaid)}</b></span>
        {prepaid > 0 && currentPaidThrough && (
          <span>до {fmtDate(parseMskDate(currentPaidThrough))} 12:00</span>
        )}
        <span>с {fmtDate(parseMskDate(firstUnpaidKey))}</span>
        <span className={contractDebt > 0 ? "text-destructive font-semibold" : "text-success font-semibold"}>
          к оплате {money(contractDebt)}
        </span>
      </div>

      {STAY_EXTRA_CODES.some((code) => !hasStayExtra(booking, code)) && (
        <div className="flex flex-wrap gap-1.5">
          {STAY_EXTRA_CODES.filter((code) => !hasStayExtra(booking, code)).map((code) => {
            const checked = extrasSel.includes(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggleExtra(code)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border ${
                  checked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {checked ? "✓ " : "+ "}
                {STAY_EXTRAS[code].label} {money(extraFee)}
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <label htmlFor="pay-amount" className="text-[11px] font-bold text-muted-foreground uppercase">Сумма за ночи</label>
            {selectedNights > 0 && (
              <div className="text-[10px] text-muted-foreground">{selectedNights} ноч. · тариф {money(openTariff)}/сут</div>
            )}
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
            className="w-32 px-2 py-1.5 text-right text-[20px] font-black text-primary rounded-lg border border-primary/30 bg-background outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] mt-1">
          <span className="text-muted-foreground">
            {priceIsCustom ? "Своя цена · " : ""}после оплаты {money(nextDue)}
            {extrasSum > 0 ? ` · сейчас ${money(totalToPay)}` : ""}
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

      {useRules && !isSplit && suggestedRule && !selectedRuleId && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-foreground truncate">{formatRuleLabel(suggestedRule, pmLabels)}</div>
            <div className="text-[11px] text-muted-foreground">
              экономия {money(Math.max(0, selectedNights * roomPrice - calcPaymentWithRule(roomPrice, Math.max(1, selectedNights), suggestedRule)))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedRuleId(suggestedRule.id);
              manualNightly.current = null;
              setAmountManual(false);
            }}
            className="shrink-0 px-3 py-1.5 text-[12px] font-bold rounded-lg text-white"
            style={{ background: "hsl(var(--success))" }}
          >
            Применить скидку
          </button>
        </div>
      )}
      {useRules && selectedRule && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-[12px]">
          <span className={`font-semibold truncate ${selectedRuleUnmet ? "text-destructive" : "text-success"}`}>
            {selectedRuleUnmet ? `Не подходит: ${selectedRuleUnmet}` : `Скидка: ${formatRuleLabel(selectedRule, pmLabels)}`}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedRuleId("");
              manualNightly.current = null;
              setAmountManual(false);
            }}
            className="shrink-0 font-semibold text-muted-foreground hover:text-foreground"
          >
            Убрать
          </button>
        </div>
      )}
      {selectedRuleUnmet && (
        <p className="text-[12px] text-destructive font-semibold">Условия скидки не выполнены: {selectedRuleUnmet}</p>
      )}
      {!useRules && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-bold text-muted-foreground">
            Скидка, %
            <input
              type="number"
              min={0}
              max={100}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 text-[13px] rounded-lg border border-border bg-muted outline-none"
            />
          </label>
          <label className="text-[11px] font-bold text-muted-foreground">
            Скидка, ₽/сут.
            <input
              type="number"
              min={0}
              value={discountPerNight}
              onChange={(e) => setDiscountPerNight(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 text-[13px] rounded-lg border border-border bg-muted outline-none"
            />
          </label>
        </div>
      )}

      {allNightsPaid ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
          Все ночи до выезда уже оплачены{extrasSel.length ? " — будет оплачена только доплата." : "."}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-muted-foreground">Ночей</span>
          <button
            type="button"
            onClick={() => setNightsCount(String(Math.max(nightsOptional ? 0 : 1, selectedNights - 1)))}
            className="w-8 h-8 rounded-lg border border-border font-bold"
          >
            −
          </button>
          <input
            type="number"
            min={nightsOptional ? 0 : 1}
            max={maxPayNights}
            value={nightsCount}
            onChange={(e) => {
              setPeriodMode("nights");
              setNightsCount(e.target.value);
            }}
            className="w-16 px-2 py-1.5 text-center text-[15px] font-bold rounded-lg border border-border bg-muted outline-none"
          />
          <button
            type="button"
            onClick={() => setNightsCount(String(Math.min(maxPayNights, selectedNights + 1)))}
            className="w-8 h-8 rounded-lg border border-border font-bold"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setPeriodMode(periodMode === "date" ? "nights" : "date")}
            className="text-[12px] font-semibold text-primary"
          >
            {selectedNights > 0 ? `до ${fmtDate(parseMskDate(selectedPaidThrough))} 12:00` : "только доплата"}
          </button>
        </div>
      )}
      {!allNightsPaid && periodMode === "date" && (
        <DatePicker
          mode="iso"
          value={paidThrough}
          onChange={setPaidThrough}
          min={mskAddDays(firstUnpaidKey, 1)}
          max={maxPaidThroughKey}
          className="w-full"
        />
      )}

      <div>
        <PaymentMethodPicker
          pmConfig={pmConfig}
          total={splitTarget}
          columns={3}
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
