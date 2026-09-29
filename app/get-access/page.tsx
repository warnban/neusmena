"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { crmAppUrl } from "@/lib/host-routing";
import "@/components/landing/landing.css";

type Plan = "basic" | "premium";
type Step = "plan" | "form" | "done";

const PLANS: {
  id: Plan;
  name: string;
  price: number;
  desc: string;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    id: "basic",
    name: "Смена CRM",
    price: 5000,
    desc: "Полный функционал для гостиницы или сети",
    features: [
      "Неограниченное число отелей",
      "Бронирования, гости, касса",
      "Миграционный учёт и печать",
      "Отчёты и OTA-каналы",
    ],
  },
  {
    id: "premium",
    name: "CRM + AI Premium",
    price: 10000,
    desc: "CRM и AI-модули для стойки регистрации",
    highlight: true,
    features: [
      "Всё из базового тарифа",
      "AI-распознавание паспортов",
      "AI-аналитика и рекомендации",
      "AI-помощник администратора",
    ],
  },
];

export default function GetAccessPage() {
  const [step, setStep] = useState<Step>("plan");
  const [plan, setPlan] = useState<Plan>("basic");
  const [contactName, setContactName] = useState("");
  const [seatName, setSeatName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState("");

  const selected = PLANS.find((p) => p.id === plan)!;

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/access/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, contactName, seatName, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка оформления");
        return;
      }
      setOrderId(data.order?.id ?? "");
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing-page min-h-screen landing-mesh text-[var(--lp-text)]">
      <header className="border-b border-[var(--lp-border)] bg-[var(--lp-bg)]/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-[var(--lp-muted)] hover:text-white">
            <ArrowLeft size={16} /> На главную
          </Link>
          <Link href={crmAppUrl("/login")} className="text-sm font-semibold text-[var(--lp-muted)] hover:text-white">
            Уже есть доступ? Войти
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {step === "plan" && (
          <>
            <div className="text-center mb-10">
              <h1 className="text-2xl sm:text-4xl font-black mb-3">Оформление доступа</h1>
              <p className="text-[var(--lp-muted)]">Выберите тариф для вашей сети отелей</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlan(p.id)}
                  className={`text-left p-6 rounded-2xl transition-all landing-card-glow ${
                    plan === p.id
                      ? p.highlight
                        ? "landing-bento-highlight ring-2 ring-[var(--lp-gold)]/50"
                        : "ring-2 ring-[var(--lp-blue)]/50 bg-[var(--lp-surface)]"
                      : "bg-[var(--lp-surface)] opacity-80 hover:opacity-100"
                  }`}
                >
                  {p.highlight && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--lp-gold)] mb-2">
                      <Sparkles size={12} /> AI Premium
                    </span>
                  )}
                  <h2 className="text-lg font-black mb-1">{p.name}</h2>
                  <p className="text-2xl font-black mb-1">
                    {p.price.toLocaleString("ru-RU")} <span className="text-sm font-normal text-[var(--lp-muted)]">₽/мес</span>
                  </p>
                  <p className="text-xs text-[var(--lp-muted)] mb-4">{p.desc}</p>
                  <ul className="space-y-1.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2 text-[12px] text-[var(--lp-muted)]">
                        <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setStep("form")}
              className="landing-btn-primary w-full sm:w-auto mx-auto flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold text-white"
            >
              Продолжить · {selected.price.toLocaleString("ru-RU")} ₽/мес <ArrowRight size={18} />
            </button>
          </>
        )}

        {step === "form" && (
          <>
            <button type="button" onClick={() => setStep("plan")} className="text-sm text-[var(--lp-muted)] hover:text-white mb-6 flex items-center gap-1">
              <ArrowLeft size={14} /> Назад к тарифам
            </button>
            <h1 className="text-2xl sm:text-3xl font-black mb-2">Контактные данные</h1>
            <p className="text-[var(--lp-muted)] text-sm mb-8">
              Тариф: <strong className="text-white">{selected.name}</strong> — {selected.price.toLocaleString("ru-RU")} ₽/мес
            </p>

            <form onSubmit={submitOrder} className="space-y-5 p-6 sm:p-8 rounded-2xl bg-[var(--lp-surface)] border border-[var(--lp-border)] landing-card-glow">
              <div>
                <label className="text-xs font-bold text-[var(--lp-muted)] uppercase tracking-wider block mb-2">Ваше имя</label>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-black/20 border border-[var(--lp-border)] text-white outline-none focus:ring-2 focus:ring-[var(--lp-blue)]/40"
                  placeholder="Иван Иванов"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--lp-muted)] uppercase tracking-wider block mb-2">Название сети отелей</label>
                <input
                  value={seatName}
                  onChange={(e) => setSeatName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-black/20 border border-[var(--lp-border)] text-white outline-none focus:ring-2 focus:ring-[var(--lp-blue)]/40"
                  placeholder="Grand Hotels"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--lp-muted)] uppercase tracking-wider block mb-2">Email для доступа</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-black/20 border border-[var(--lp-border)] text-white outline-none focus:ring-2 focus:ring-[var(--lp-blue)]/40"
                  placeholder="owner@hotel.ru"
                />
                <p className="text-[11px] text-[var(--lp-muted)] mt-2">На этот адрес придут логин и пароль главного аккаунта после оплаты</p>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="p-4 rounded-xl bg-[var(--lp-gold-dim)] border border-[var(--lp-gold)]/20 text-[13px] text-[var(--lp-muted)] leading-relaxed">
                Оплата подключается отдельно. После подтверждения платежа на указанный email придёт письмо с логином и паролем
                владельца сети. Сотрудников вы добавите через приглашения в настройках CRM.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="landing-btn-gold w-full py-4 rounded-full font-black text-[#0a0a0f] disabled:opacity-50"
              >
                {loading ? "Отправка…" : "Оформить заявку"}
              </button>
            </form>
          </>
        )}

        {step === "done" && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-6">
              <Check size={32} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mb-4">Заявка принята</h1>
            <p className="text-[var(--lp-muted)] text-base leading-relaxed max-w-md mx-auto mb-6">
              После оплаты тарифа <strong className="text-white">{selected.name}</strong> на{" "}
              <strong className="text-white">{email}</strong> придёт письмо с логином и паролем главного аккаунта вашей сети «{seatName}».
            </p>
            <p className="text-[13px] text-[var(--lp-muted)] mb-8">
              Номер заявки: {orderId.slice(0, 8)}… · {selected.price.toLocaleString("ru-RU")} ₽/мес
            </p>
            <Link href={crmAppUrl("/login")} className="landing-btn-primary inline-flex items-center gap-2 px-8 py-3 rounded-full font-bold text-white">
              Перейти ко входу
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
