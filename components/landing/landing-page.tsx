"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BedDouble,
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Globe,
  Layers,
  Menu,
  Minus,
  ScanLine,
  Shield,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { crmAppUrl, platformUrl } from "@/lib/host-routing";
import "./landing.css";

const NAV = [
  { href: "#pain", label: "Проблема" },
  { href: "#features", label: "Возможности" },
  { href: "#ai", label: "AI Premium" },
  { href: "#pricing", label: "Тарифы" },
];

const PAIN_POINTS = [
  "Гость ждёт, пока админ ищет бронь в Excel и чатах",
  "Паспорт вбивают вручную — ошибки и очередь на стойке",
  "Непонятно, сколько реально заработал отель за смену",
  "Миграционный учёт «на потом» — риск штрафов",
  "Третий отель в сети = третья программа и доплата",
];

const BENTO = [
  {
    icon: Building2,
    title: "Вся сеть — один аккаунт",
    text: "Grand Hotel в Москве, хостел в Казани, aparthotel в СПб. Переключение за секунду, общая база гостей.",
    span: "lg:col-span-2 lg:row-span-2",
    highlight: true,
    stat: "∞ отелей",
  },
  {
    icon: CalendarDays,
    title: "Бронирования",
    text: "Booking, Яндекс, прямые — единый список, оплаты, переселения.",
    span: "",
  },
  {
    icon: Users,
    title: "Гости и МВД",
    text: "Миграционный учёт, бланки, форма №5 из карточки.",
    span: "",
  },
  {
    icon: BarChart3,
    title: "Финансы",
    text: "Касса, RevPAR, зарплаты, инкассация — без 1С на стойке.",
    span: "",
  },
  {
    icon: Globe,
    title: "OTA-каналы",
    text: "Источники, предоплаты, аналитика по каналам.",
    span: "",
  },
  {
    icon: Sparkles,
    title: "Housekeeping",
    text: "Уборка, статусы номеров, контроль белья.",
    span: "lg:col-span-2",
  },
];

const AI_FEATURES = [
  {
    icon: ScanLine,
    title: "Скан паспорта",
    text: "Фото документа → карточка гостя заполнена за секунды. Меньше ошибок, короче очередь.",
  },
  {
    icon: TrendingUp,
    title: "AI-аналитика",
    text: "Подсказки по тарифам и загрузке: где поднять цену, какие дни «проседают».",
  },
  {
    icon: Bot,
    title: "AI-администратор",
    text: "«Засели Петрова, оплата картой» — помощник выполняет рутину и готовит бланки.",
  },
];

const COMPARE = {
  before: ["Excel + WhatsApp + блокнот", "Доплата за каждый отель", "Паспорт — 5 минут руками", "Отчёт — в конце месяца"],
  after: ["Всё в одном окне браузера", "5 000 ₽ — вся сеть", "AI-скан за 3 секунды", "Касса и RevPAR в реальном времени"],
};

const TESTIMONIALS = [
  {
    quote: "Перешли с таблиц за выходные. Админы перестали звонить «где эта бронь» — всё видно с телефона.",
    role: "Управляющий сети",
    city: "3 отеля · Москва и СПб",
  },
  {
    quote: "Миграционный учёт наконец под контролем. Статусы МВД и печать бланков — без паники перед проверкой.",
    role: "Администратор",
    city: "Гостиница · 42 номера",
  },
];

const FAQ = [
  { q: "Сколько отелей в одном аккаунте?", a: "Неограниченно. 5 000 ₽/мес — за всю сеть, без доплат за объекты." },
  { q: "Нужна установка?", a: "Нет. Браузер на ПК, планшете и телефоне. Можно добавить на главный экран как приложение." },
  { q: "Что даёт AI Premium?", a: "Распознавание паспортов, AI-аналитика и AI-помощник — +5 000 ₽/мес к базовому тарифу." },
  { q: "Подходит для хостелов?", a: "Да: общие комнаты, койко-места, dorm — не только классические номера." },
];

function HeroMetrics() {
  const cards = [
    { label: "Загрузка", value: "78%", sub: "сегодня", color: "#4f8cff", cls: "landing-float top-4 right-0 sm:right-4" },
    { label: "Заезды", value: "6", sub: "ожидают", color: "#d4af6a", cls: "landing-float-d top-32 -left-2 sm:left-0" },
    { label: "RevPAR", value: "3 840 ₽", sub: "за месяц", color: "#34d399", cls: "landing-float-d2 bottom-8 right-8 sm:right-12" },
  ];

  return (
    <div className="relative h-[320px] sm:h-[380px] lg:h-[420px] w-full max-w-lg mx-auto lg:mx-0 lg:ml-auto">
      <div className="absolute inset-0 rounded-3xl landing-bento-highlight landing-card-glow overflow-hidden">
        <div className="absolute inset-0 landing-grid-bg opacity-60" />
        <div className="relative p-6 sm:p-8 h-full flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--lp-gold)] mb-2">Панель управляющего</div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--lp-text)] leading-tight">
              Вся операционка<br />
              <span className="text-[var(--lp-muted)] font-semibold text-lg sm:text-xl">в одном экране</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Заселение", "Касса", "Отчёт смены", "МВД"].map((t) => (
              <span key={t} className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/[0.04] border border-white/[0.08] text-[var(--lp-muted)]">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      {cards.map((c) => (
        <div
          key={c.label}
          className={`absolute ${c.cls} px-4 py-3 rounded-2xl bg-[var(--lp-surface)] border border-[var(--lp-border)] landing-card-glow min-w-[120px]`}
        >
          <div className="text-[10px] text-[var(--lp-muted)] font-medium mb-0.5">{c.label}</div>
          <div className="text-xl font-black" style={{ color: c.color }}>{c.value}</div>
          <div className="text-[9px] text-[var(--lp-muted)]">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing-page min-h-screen text-[var(--lp-text)] overflow-x-hidden landing-mesh">
      {/* Header */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-[var(--lp-bg)]/90 backdrop-blur-xl border-b border-[var(--lp-border)] shadow-lg shadow-black/20" : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--lp-gold)] to-[#a8884a] flex items-center justify-center font-black text-[#0a0a0f] text-sm shadow-lg shadow-[var(--lp-gold)]/20 group-hover:scale-105 transition-transform">
              С
            </div>
            <span className="font-black text-lg tracking-tight">Смена</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[13px] font-medium text-[var(--lp-muted)] hover:text-[var(--lp-text)] transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link href={crmAppUrl("/login")} className="text-[13px] font-semibold text-[var(--lp-muted)] hover:text-white px-3 py-2">
              Войти
            </Link>
            <Link
              href={crmAppUrl("/get-access")}
              className="landing-btn-primary text-[13px] font-bold px-5 py-2.5 rounded-full text-white transition-all"
            >
              Начать сейчас
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden p-2 rounded-lg text-[var(--lp-muted)] hover:bg-white/5"
            aria-label={menuOpen ? "Закрыть" : "Меню"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-[var(--lp-border)] bg-[var(--lp-bg)]/98 backdrop-blur-xl px-4 py-6 space-y-1">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="block py-3 text-base font-medium border-b border-[var(--lp-border)]" onClick={() => setMenuOpen(false)}>
                {item.label}
              </a>
            ))}
            <div className="pt-4 space-y-2">
              <Link href={crmAppUrl("/login")} className="block w-full py-3 text-center rounded-xl border border-[var(--lp-border)] font-semibold" onClick={() => setMenuOpen(false)}>Войти</Link>
              <Link href={crmAppUrl("/get-access")} className="landing-btn-primary block w-full py-3 text-center rounded-xl font-bold text-white" onClick={() => setMenuOpen(false)}>Начать сейчас</Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ── HERO ── */}
        <section className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-20 sm:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--lp-gold)]/25 bg-[var(--lp-gold-dim)] text-[var(--lp-gold)] text-[11px] font-bold uppercase tracking-[0.15em] mb-6">
                <Sparkles size={12} /> CRM для гостиниц и хостелов
              </div>

              <h1 className="text-[2rem] sm:text-5xl lg:text-[3.25rem] font-black leading-[1.08] tracking-tight mb-6">
                Операционная система{" "}
                <span className="landing-shimmer-text">для вашей гостиницы</span>
              </h1>

              <p className="text-base sm:text-lg text-[var(--lp-muted)] leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
                Бронирования, заселение, касса, миграционный учёт и отчёты — без Excel, без десяти сервисов,
                без доплат за каждый новый отель.{" "}
                <strong className="text-[var(--lp-text)] font-semibold">5 000 ₽/мес — вся сеть.</strong>
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-10">
                <Link
                  href={crmAppUrl("/get-access")}
                  className="landing-btn-primary inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold text-[15px] text-white transition-all"
                >
                  Подключить отель <ArrowRight size={18} />
                </Link>
                <a
                  href="#pricing"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-semibold text-[15px] border border-[var(--lp-border)] hover:border-[var(--lp-gold)]/30 hover:bg-white/[0.03] transition-all"
                >
                  Смотреть тарифы
                </a>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center lg:justify-start text-[13px] text-[var(--lp-muted)]">
                {[
                  { icon: Smartphone, t: "Работает на телефоне" },
                  { icon: Shield, t: "Соответствие РФ" },
                  { icon: Clock, t: "Запуск за 15 минут" },
                ].map(({ icon: Icon, t }) => (
                  <span key={t} className="flex items-center gap-2">
                    <Icon size={15} className="text-[var(--lp-gold)] shrink-0" /> {t}
                  </span>
                ))}
              </div>
            </div>

            <HeroMetrics />
          </div>
        </section>

        {/* ── TRUST BAR ── */}
        <section className="border-y border-[var(--lp-border)] bg-[var(--lp-surface)]/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-[12px] sm:text-[13px] text-[var(--lp-muted)] font-medium">
            {["Гостиницы", "Хостелы", "Aparthotel", "Сети от 2 до 50+ объектов", "Номера и койко-места"].map((t) => (
              <span key={t} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[var(--lp-gold)]" /> {t}
              </span>
            ))}
          </div>
        </section>

        {/* ── PAIN ── */}
        <section id="pain" className="landing-section-light scroll-mt-20 py-20 sm:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="max-w-2xl mb-12 sm:mb-16">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a8884a] mb-3">Знакомо?</p>
              <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-black leading-tight text-[#1a1a1f] mb-4">
                Стойка регистрации не должна быть хаосом
              </h2>
              <p className="lp-muted text-base sm:text-lg leading-relaxed">
                Пока вы ищете бронь в чатах — гость уходит недовольным. Пока бухгалтерия ждёт Excel — вы теряете деньги.
              </p>
            </div>

            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
              {PAIN_POINTS.map((p) => (
                <li key={p} className="flex gap-3 p-5 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
                  <Minus size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <span className="text-[14px] sm:text-[15px] font-medium text-[#2a2a32] leading-snug">{p}</span>
                </li>
              ))}
            </ul>

            <div className="grid md:grid-cols-2 gap-6 p-6 sm:p-8 rounded-3xl bg-[#1a1a1f] text-white">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-red-400/80 mb-4">Было</div>
                <ul className="space-y-3">
                  {COMPARE.before.map((t) => (
                    <li key={t} className="flex gap-2 text-[14px] text-zinc-400"><X size={16} className="text-red-400 shrink-0 mt-0.5" />{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-4">Со Сменой</div>
                <ul className="space-y-3">
                  {COMPARE.after.map((t) => (
                    <li key={t} className="flex gap-2 text-[14px] text-zinc-200"><Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── BENTO FEATURES ── */}
        <section id="features" className="scroll-mt-20 py-20 sm:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-20">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--lp-gold)] mb-3">Возможности</p>
              <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-black leading-tight mb-4">
                Всё, что нужно отелю — уже внутри
              </h2>
              <p className="text-[var(--lp-muted)] text-base sm:text-lg">
                Не набор модулей за отдельные деньги. Полноценная операционная система из коробки.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">
              {BENTO.map(({ icon: Icon, title, text, span, highlight, stat }) => (
                <div
                  key={title}
                  className={`group p-6 sm:p-7 rounded-2xl transition-all duration-300 landing-card-glow ${
                    highlight ? "landing-bento-highlight" : "bg-[var(--lp-surface)]"
                  } ${span}`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${highlight ? "bg-[var(--lp-gold-dim)] text-[var(--lp-gold)]" : "bg-white/[0.04] text-[var(--lp-blue)]"}`}>
                    <Icon size={22} />
                  </div>
                  {stat && (
                    <div className="text-3xl sm:text-4xl font-black text-[var(--lp-gold)] mb-2">{stat}</div>
                  )}
                  <h3 className="font-bold text-lg sm:text-xl mb-2">{title}</h3>
                  <p className="text-[14px] text-[var(--lp-muted)] leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── AI PREMIUM ── */}
        <section id="ai" className="scroll-mt-20 relative py-20 sm:py-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--lp-gold-dim)] via-transparent to-transparent pointer-events-none" />
          <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--lp-gold)]/30 bg-[var(--lp-gold-dim)] text-[var(--lp-gold)] text-[11px] font-bold uppercase tracking-[0.15em] mb-6">
                  <Zap size={12} /> AI Premium · +5 000 ₽/мес
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-black leading-tight mb-5">
                  Искусственный интеллект{" "}
                  <span className="text-[var(--lp-gold)]">на стойке</span>
                </h2>
                <p className="text-[var(--lp-muted)] text-base sm:text-lg leading-relaxed mb-8">
                  Экономьте часы ручного ввода. AI Premium — для тех, кто хочет стойку регистрации уровня five-star без найма лишних людей.
                </p>
                <Link
                  href={crmAppUrl("/get-access")}
                  className="landing-btn-gold inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-bold text-[14px] transition-all hover:scale-[1.02]"
                >
                  Подключить с AI <ArrowRight size={16} />
                </Link>
              </div>

              <div className="space-y-4">
                {AI_FEATURES.map(({ icon: Icon, title, text }, i) => (
                  <div
                    key={title}
                    className="flex gap-5 p-6 rounded-2xl bg-[var(--lp-surface)] border border-[var(--lp-border)] landing-card-glow"
                    style={{ marginLeft: i === 1 ? "1.5rem" : 0 }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-[var(--lp-gold-dim)] text-[var(--lp-gold)] flex items-center justify-center shrink-0">
                      <Icon size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{title}</h3>
                      <p className="text-[14px] text-[var(--lp-muted)] leading-relaxed">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ── */}
        <section className="landing-section-light py-20 sm:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid md:grid-cols-2 gap-6">
              {TESTIMONIALS.map(({ quote, role, city }) => (
                <blockquote key={role} className="p-8 sm:p-10 rounded-3xl bg-white border border-black/[0.06] shadow-sm">
                  <p className="text-lg sm:text-xl font-medium text-[#1a1a1f] leading-relaxed mb-6">&ldquo;{quote}&rdquo;</p>
                  <footer>
                    <div className="font-bold text-[#1a1a1f]">{role}</div>
                    <div className="text-[13px] lp-muted">{city}</div>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section id="pricing" className="scroll-mt-20 py-20 sm:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--lp-gold)] mb-3">Тарифы</p>
              <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-black leading-tight mb-4">
                Одна цена. Вся сеть.
              </h2>
              <p className="text-[var(--lp-muted)] text-base sm:text-lg">
                Без доплат за отели, без скрытых модулей, без «позвоните менеджеру».
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="landing-pricing-popular relative p-8 sm:p-10 rounded-3xl">
                <div className="absolute -top-3 left-8 px-4 py-1 rounded-full bg-[var(--lp-blue)] text-[10px] font-black uppercase tracking-wider text-white">
                  Рекомендуем
                </div>
                <h3 className="text-2xl font-black mt-2 mb-1">Смена CRM</h3>
                <p className="text-[var(--lp-muted)] text-sm mb-8">Полный функционал для гостиницы или сети</p>
                <div className="flex items-baseline gap-2 mb-8">
                  <span className="text-5xl sm:text-6xl font-black">5 000</span>
                  <span className="text-[var(--lp-muted)] text-lg">₽/мес</span>
                </div>
                <ul className="space-y-3.5 mb-10">
                  {[
                    "Неограниченное число отелей",
                    "Бронирования, гости, номерной фонд",
                    "Касса, отчёты, зарплаты, инкассация",
                    "Миграционный учёт и печать бланков",
                    "Housekeeping и контроль белья",
                    "Менеджер каналов OTA",
                  ].map((item) => (
                    <li key={item} className="flex gap-3 text-[14px]">
                      <Check size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href={crmAppUrl("/get-access")} className="landing-btn-primary block w-full py-4 rounded-full text-center font-bold text-white transition-all">
                  Подключить отель
                </Link>
              </div>

              <div className="p-8 sm:p-10 rounded-3xl bg-[var(--lp-surface)] border border-[var(--lp-border)] landing-card-glow">
                <div className="flex items-center gap-2 mb-1 mt-2">
                  <Sparkles size={20} className="text-[var(--lp-gold)]" />
                  <h3 className="text-2xl font-black">AI Premium</h3>
                </div>
                <p className="text-[var(--lp-muted)] text-sm mb-8">Дополнение к основному тарифу</p>
                <div className="flex items-baseline gap-2 mb-8">
                  <span className="text-5xl sm:text-6xl font-black text-[var(--lp-gold)]">+5 000</span>
                  <span className="text-[var(--lp-muted)] text-lg">₽/мес</span>
                </div>
                <ul className="space-y-3.5 mb-10">
                  {[
                    "AI-распознавание паспортов",
                    "AI-аналитика и рекомендации",
                    "AI-помощник администратора",
                    "Голосовые и текстовые команды",
                  ].map((item) => (
                    <li key={item} className="flex gap-3 text-[14px]">
                      <Check size={18} className="text-[var(--lp-gold)] shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href={crmAppUrl("/get-access")} className="block w-full py-4 rounded-full text-center font-bold border border-[var(--lp-gold)]/40 text-[var(--lp-gold)] hover:bg-[var(--lp-gold-dim)] transition-colors">
                  CRM + AI = 10 000 ₽/мес
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── COMPLIANCE ── */}
        <section className="border-t border-[var(--lp-border)] py-16 sm:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid sm:grid-cols-2 gap-10 items-center p-8 sm:p-12 rounded-3xl landing-bento-highlight landing-card-glow">
              <div>
                <Shield size={28} className="text-emerald-400 mb-4" />
                <h3 className="text-2xl sm:text-3xl font-black mb-3">Соответствие законодательству РФ</h3>
                <p className="text-[var(--lp-muted)] text-[15px] leading-relaxed">
                  Миграционный учёт, контроль просрочек, печать согласия на ПДн, правил проживания, договора и формы №5 — из карточки гостя, без Word.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: BedDouble, l: "Номерной фонд" },
                  { icon: Layers, l: "Контроль белья" },
                  { icon: Users, l: "Организации" },
                  { icon: Shield, l: "Форма №5" },
                ].map(({ icon: Icon, l }) => (
                  <div key={l} className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-[var(--lp-border)]">
                    <Icon size={18} className="text-[var(--lp-blue)] shrink-0" />
                    <span className="text-[13px] font-semibold">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-black text-center mb-10">Вопросы и ответы</h2>
          <div className="space-y-3">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group rounded-2xl bg-[var(--lp-surface)] border border-[var(--lp-border)] landing-card-glow open:border-[var(--lp-gold)]/20">
                <summary className="p-5 sm:p-6 font-bold text-[15px] cursor-pointer list-none flex items-center justify-between gap-4">
                  {q}
                  <ChevronRight size={18} className="text-[var(--lp-muted)] group-open:rotate-90 transition-transform shrink-0" />
                </summary>
                <p className="px-5 sm:px-6 pb-5 sm:pb-6 text-[14px] text-[var(--lp-muted)] leading-relaxed -mt-1">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28">
          <div className="relative text-center px-6 sm:px-16 py-16 sm:py-24 rounded-[2rem] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a5f] via-[#0f1118] to-[#1a1510]" />
            <div className="absolute inset-0 landing-grid-bg opacity-40" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[var(--lp-gold)]/10 rounded-full blur-[100px]" style={{ animation: "lp-glow-pulse 4s ease-in-out infinite" }} />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-5 leading-tight">
                Пора навести порядок<br />
                <span className="landing-shimmer-text">на стойке регистрации</span>
              </h2>
              <p className="text-[var(--lp-muted)] text-base sm:text-lg mb-10 max-w-lg mx-auto">
                5 000 ₽ в месяц — вся сеть отелей. Подключение за 15 минут. Без установки.
              </p>
              <Link
                href={crmAppUrl("/get-access")}
                className="landing-btn-gold inline-flex items-center gap-2 px-10 py-4 rounded-full font-black text-[16px] transition-all hover:scale-[1.03]"
              >
                Начать работу в Смене <ArrowRight size={20} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--lp-border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-[var(--lp-muted)]">
          <div>© {new Date().getFullYear()} Смена — CRM для гостиниц</div>
          <div className="flex gap-6">
            <Link href={crmAppUrl("/login")} className="hover:text-white transition-colors">Войти в CRM</Link>
            <Link href={platformUrl("/platform/login")} className="hover:text-white transition-colors">Панель разработчика</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
