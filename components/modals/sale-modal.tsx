"use client";

import { useMemo, useState } from "react";
import { X, Plus, Minus, Check, ShoppingBag, Receipt } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { OperationDateField } from "@/components/ui/operation-date-field";
import { Modal } from "@/components/ui/modal";
import { PaymentMethodPicker, type PaymentSelection } from "@/components/payments/payment-method-picker";
import { sumSplitParts } from "@/lib/payment-split";
import { money } from "@/lib/format";
import { mskDateKey } from "@/lib/msk-time";

type Mode = "sale" | "expense";

type CartItem = { serviceId: string; qty: number };

export function SaleModal({ onClose }: { onClose: () => void }) {
  const { services, expenses, pmConfig, hotels, hotelId, canManageSettings, refresh } = useApp();
  const [mode, setMode] = useState<Mode>("sale");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentSel, setPaymentSel] = useState<PaymentSelection>({ mode: "single", method: "cash" });
  const [note, setNote] = useState("");
  const [operationDate, setOperationDate] = useState(() => mskDateKey());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const catalog = mode === "sale" ? services : expenses;
  const activeHotelId = hotelId !== "all" ? hotelId : hotels[0]?.id ?? "";

  const cartDetails = useMemo(() => {
    return cart.map((c) => {
      const item = catalog.find((s) => s.id === c.serviceId);
      return { ...c, item, subtotal: (item?.price ?? 0) * c.qty };
    }).filter((c) => c.item);
  }, [cart, catalog]);

  const total = cartDetails.reduce((s, c) => s + c.subtotal, 0);
  const isSplit = paymentSel.mode === "split";

  function toggleItem(id: string) {
    setCart((prev) => {
      const exists = prev.find((c) => c.serviceId === id);
      if (exists) return prev.filter((c) => c.serviceId !== id);
      return [...prev, { serviceId: id, qty: 1 }];
    });
  }

  function setQty(id: string, qty: number) {
    setCart((prev) =>
      prev.map((c) => (c.serviceId === id ? { ...c, qty: Math.max(1, qty) } : c))
    );
  }

  async function createItem() {
    if (!newName.trim()) return;
    const res = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        price: Math.round(Number(newPrice) || 0),
        kind: mode === "sale" ? "service" : "expense",
        category: "extra",
      }),
    });
    if (res.ok) {
      await refresh();
      setShowCreate(false);
      setNewName("");
      setNewPrice("");
    }
  }

  async function submit() {
    setError("");
    if (!activeHotelId) {
      setError("Выберите конкретный отель");
      return;
    }
    if (!cart.length) {
      setError("Выберите хотя бы одну позицию");
      return;
    }
    if (isSplit && sumSplitParts(paymentSel.parts) !== total) {
      setError("Распределите всю сумму по способам оплаты");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: activeHotelId,
          kind: mode === "sale" ? "service" : "expense",
          paymentMethod: paymentSel.mode === "single" ? paymentSel.method : paymentSel.parts[0]?.method,
          splits: isSplit ? paymentSel.parts : undefined,
          items: cart,
          note: note.trim() || undefined,
          operationDate: canManageSettings ? operationDate : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка");
        return;
      }
      await refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} className="max-w-[560px]">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-foreground">Касса</h2>
            <button type="button" onClick={onClose} aria-label="Закрыть" className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"><X size={16} /></button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setMode("sale"); setCart([]); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] font-bold rounded-xl border ${mode === "sale" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
            >
              <ShoppingBag size={14} /> Продажа
            </button>
            <button
              type="button"
              onClick={() => { setMode("expense"); setCart([]); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] font-bold rounded-xl border ${mode === "expense" ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-muted-foreground"}`}
            >
              <Receipt size={14} /> Расход
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {!activeHotelId && (
            <p className="text-[12px] text-warning font-semibold p-3 rounded-xl bg-warning/10 border border-warning/30">
              Выберите конкретный отель в переключателе
            </p>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-bold text-muted-foreground uppercase">
              {mode === "sale" ? "Услуги" : "Статьи расхода"}
            </h3>
            {canManageSettings && (
              <button
                type="button"
                onClick={() => setShowCreate((v) => !v)}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                + Создать
              </button>
            )}
          </div>

          {showCreate && canManageSettings && (
            <div className="flex gap-2 p-3 rounded-xl border border-border bg-muted/50">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Название"
                className="flex-1 px-2 py-1.5 text-[12px] rounded-lg border border-border bg-card outline-none"
              />
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Цена"
                className="w-24 px-2 py-1.5 text-[12px] rounded-lg border border-border bg-card outline-none"
              />
              <button type="button" onClick={createItem} className="px-3 py-1.5 text-white text-[11px] font-bold rounded-lg bg-primary">OK</button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {catalog.map((svc) => {
              const inCart = cart.find((c) => c.serviceId === svc.id);
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => toggleItem(svc.id)}
                  className="flex items-center gap-2 p-2.5 rounded-xl text-left bg-muted transition-all"
                  style={{ border: `2px solid ${inCart ? "hsl(var(--primary))" : "hsl(var(--border))"}` }}
                >
                  <span className="text-[16px]">{svc.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-foreground truncate">{svc.name}</div>
                    <div className={`text-[10px] font-bold ${mode === "expense" ? "text-destructive" : "text-success"}`}>{money(svc.price)}</div>
                  </div>
                  {inCart && <Check size={12} className="text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {cartDetails.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[12px] font-bold text-muted-foreground uppercase">Корзина</h3>
              {cartDetails.map((c) => (
                <div key={c.serviceId} className="flex items-center gap-2 text-[12px]">
                  <span className="flex-1 font-semibold">{c.item!.name}</span>
                  <button type="button" onClick={() => setQty(c.serviceId, c.qty - 1)} className="w-6 h-6 rounded border border-border flex items-center justify-center"><Minus size={10} /></button>
                  <span className="w-6 text-center font-bold">{c.qty}</span>
                  <button type="button" onClick={() => setQty(c.serviceId, c.qty + 1)} className="w-6 h-6 rounded border border-border flex items-center justify-center"><Plus size={10} /></button>
                  <span className="w-20 text-right font-bold">{money(c.subtotal)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-border font-black text-[15px]">
                <span>Итого</span>
                <span className={mode === "expense" ? "text-destructive" : "text-success"}>{money(total)}</span>
              </div>
            </div>
          )}

          <PaymentMethodPicker
            pmConfig={pmConfig}
            total={total}
            value={paymentSel}
            onChange={setPaymentSel}
            label="Способ оплаты (касса)"
          />

          {mode === "expense" && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Комментарий к расходу"
              className="w-full px-3 py-2 text-[12px] rounded-xl border border-border bg-muted outline-none"
            />
          )}

          <OperationDateField
            enabled={canManageSettings}
            value={operationDate}
            onChange={setOperationDate}
          />

          {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border">
          <button
            onClick={submit}
            disabled={busy || !cart.length}
            className="w-full py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
            style={{ background: mode === "expense" ? "hsl(var(--destructive))" : "hsl(var(--primary))" }}
          >
            {busy ? "Проведение…" : mode === "expense" ? "Списать расход" : "Оформить продажу"}
          </button>
        </div>
    </Modal>
  );
}
