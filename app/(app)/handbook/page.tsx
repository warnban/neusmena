"use client";

import { useMemo, useState } from "react";
import {
  Printer,
  Download,
  FileText,
  Scale,
  ExternalLink,
  ShieldAlert,
  ListChecks,
  Ban,
  ChevronDown,
  Quote,
  MapPin,
  FolderCheck,
} from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { Icon } from "@/components/icon";
import { Select } from "@/components/ui/select";
import { useApp } from "@/components/providers/app-data";
import { toneColor, toneBg, toneBorder } from "@/lib/constants";
import {
  INCIDENT_FORM_TEMPLATES,
  INCIDENT_FORM_IDS,
  buildIncidentFormsPrintUrl,
  type IncidentFormId,
} from "@/lib/incident-forms";
import {
  HANDBOOK_LEGAL_REFERENCES,
  HANDBOOK_ESCALATION,
  HANDBOOK_ALGORITHM,
  HANDBOOK_SITUATIONS,
  HANDBOOK_QUICK_PHRASES,
  HANDBOOK_DONT_SAY,
  HANDBOOK_DONT_SAY_REASON,
  HANDBOOK_DOC_PACKAGE,
  HANDBOOK_MOSCOW_NOTE,
  HANDBOOK_FINAL_FORMULA,
  type HandbookTone,
} from "@/lib/handbook-content";

function toneStyle(tone: HandbookTone) {
  return {
    color: toneColor(tone),
    background: toneBg(tone),
    borderColor: toneBorder(tone),
  };
}

export default function HandbookPage() {
  const { hotels, hotelId, loading } = useApp();

  const printHotelId = hotelId === "all" ? (hotels[0]?.id ?? "") : hotelId;
  const [selectedHotel, setSelectedHotel] = useState<string>(printHotelId);
  const activeHotelId = selectedHotel || printHotelId;
  const activeHotel = hotels.find((h) => h.id === activeHotelId) ?? null;

  const openPrint = (formIds: IncidentFormId[]) => {
    if (!activeHotelId) return;
    window.open(
      buildIncidentFormsPrintUrl({ hotelId: activeHotelId, formIds }),
      "_blank",
      "noopener,noreferrer"
    );
  };

  if (loading) {
    return (
      <>
        <TopBar title="Памятка администратора" />
        <div className="flex-1 p-4 md:p-6 text-[13px] text-muted-foreground">Загрузка…</div>
      </>
    );
  }

  return (
    <>
      <TopBar
        title="Памятка администратора"
        subtitle="Действия при нарушении правил проживания, порядка и пропускного режима"
      />

      <div className="flex-1 overflow-auto custom-scrollbar p-4 md:p-6 space-y-8 max-w-[1100px]">
        {/* ─── Документы для печати ─── */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-primary" />
              <h2 className="font-display text-[16px] font-semibold text-foreground">
                Документы для печати
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {hotels.length > 1 && (
                <Select
                  size="sm"
                  value={activeHotelId}
                  onChange={setSelectedHotel}
                  options={hotels.map((h) => ({ value: h.id, label: h.name }))}
                  className="w-52"
                />
              )}
              <button
                type="button"
                onClick={() => openPrint(INCIDENT_FORM_IDS)}
                disabled={!activeHotelId}
                className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-xl text-white bg-primary hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Printer size={14} /> Распечатать все
              </button>
            </div>
          </div>

          <p className="text-[12px] text-muted-foreground mb-3">
            Бланки формируются с реквизитами{" "}
            <span className="font-semibold text-foreground">
              {activeHotel?.name ?? "гостиницы"}
            </span>
            {activeHotel?.legalName ? ` (${activeHotel.legalName})` : ""}. Остальные поля
            заполняются от руки при оформлении происшествия.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INCIDENT_FORM_IDS.map((formId) => {
              const meta = INCIDENT_FORM_TEMPLATES[formId];
              return (
                <div
                  key={formId}
                  className="rounded-2xl border border-border bg-card p-4 flex flex-col"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <FileText size={16} className="text-primary" />
                  </div>
                  <h3 className="text-[13px] font-bold text-foreground leading-snug">
                    {meta.label}
                  </h3>
                  <p className="text-[11.5px] text-muted-foreground mt-1 flex-1">
                    {meta.description}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => openPrint([formId])}
                      disabled={!activeHotelId}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] font-semibold rounded-lg text-white bg-primary hover:opacity-90 disabled:opacity-50"
                    >
                      <Printer size={13} /> Печать
                    </button>
                    <a
                      href={
                        activeHotelId
                          ? `/api/hotels/${activeHotelId}/incident-forms/${formId}?format=docx`
                          : undefined
                      }
                      aria-disabled={!activeHotelId}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-lg border border-border hover:bg-muted ${
                        activeHotelId ? "" : "pointer-events-none opacity-50"
                      }`}
                    >
                      <Download size={13} /> Word
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Ссылки на законодательство ─── */}
        <section>
          <SectionHeading icon={<Scale size={16} />} title="Основания и законодательство" />
          <div className="grid gap-2 sm:grid-cols-2">
            {HANDBOOK_LEGAL_REFERENCES.map((ref) => (
              <a
                key={ref.title}
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12.5px] font-bold text-foreground leading-snug">
                    {ref.title}
                  </span>
                  <ExternalLink
                    size={13}
                    className="text-muted-foreground group-hover:text-primary flex-shrink-0 mt-0.5"
                  />
                </div>
                <p className="text-[11.5px] text-muted-foreground mt-1.5">{ref.note}</p>
              </a>
            ))}
          </div>
        </section>

        {/* ─── Эскалация ─── */}
        <section>
          <SectionHeading
            icon={<ShieldAlert size={16} />}
            title="Порядок действий по мере обострения ситуации"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {HANDBOOK_ESCALATION.map((s) => (
              <div
                key={s.step}
                className="rounded-2xl border bg-card p-4 flex flex-col"
                style={{ borderColor: toneBorder(s.tone) }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold mb-2"
                  style={toneStyle(s.tone)}
                >
                  {s.step}
                </div>
                <h3 className="text-[13px] font-bold text-foreground">{s.title}</h3>
                <p className="text-[11.5px] text-muted-foreground mt-1 flex-1">{s.summary}</p>
                <p className="text-[11.5px] text-foreground mt-2 italic leading-snug">
                  {s.phrase}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Общий алгоритм ─── */}
        <section>
          <SectionHeading icon={<ListChecks size={16} />} title="Общий алгоритм при нарушении" />
          <ol className="rounded-2xl border border-border bg-card divide-y divide-border">
            {HANDBOOK_ALGORITHM.map((a, i) => (
              <li key={a.title} className="flex gap-3 p-3.5">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[12px] font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div>
                  <div className="text-[13px] font-semibold text-foreground">{a.title}</div>
                  <div className="text-[12px] text-muted-foreground mt-0.5">{a.text}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ─── Ситуации ─── */}
        <section>
          <SectionHeading icon={<Quote size={16} />} title="Шаблоны фраз по ситуациям" />
          <div className="space-y-2.5">
            {HANDBOOK_SITUATIONS.map((s) => (
              <SituationCard key={s.id} situation={s} />
            ))}
          </div>
        </section>

        {/* ─── Короткие фразы ─── */}
        <section>
          <SectionHeading icon={<Quote size={16} />} title="Короткие готовые фразы" />
          <div className="grid gap-2 sm:grid-cols-2">
            {HANDBOOK_QUICK_PHRASES.map((p) => (
              <div
                key={p.label}
                className="rounded-xl border border-border bg-card p-3"
              >
                <span
                  className="inline-block text-[10.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1.5"
                  style={toneStyle(p.tone)}
                >
                  {p.label}
                </span>
                <p className="text-[12.5px] text-foreground leading-snug">{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Чего не говорить ─── */}
        <section>
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: toneBorder("danger"), background: toneBg("danger", 0.06) }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Ban size={16} style={{ color: toneColor("danger") }} />
              <h2 className="font-display text-[15px] font-semibold text-foreground">
                Чего говорить нельзя
              </h2>
            </div>
            <ul className="space-y-1.5">
              {HANDBOOK_DONT_SAY.map((d) => (
                <li key={d} className="flex items-start gap-2 text-[12.5px] text-foreground">
                  <span style={{ color: toneColor("danger") }} className="mt-0.5">
                    ✕
                  </span>
                  {d}
                </li>
              ))}
            </ul>
            <p className="text-[11.5px] text-muted-foreground mt-3">{HANDBOOK_DONT_SAY_REASON}</p>
          </div>
        </section>

        {/* ─── Москва + пакет документов ─── */}
        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={15} className="text-primary" />
              <h2 className="text-[14px] font-bold text-foreground">Блок по Москве</h2>
            </div>
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              {HANDBOOK_MOSCOW_NOTE}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <FolderCheck size={15} className="text-primary" />
              <h2 className="text-[14px] font-bold text-foreground">
                Минимальный пакет документов
              </h2>
            </div>
            <ul className="space-y-1.5">
              {HANDBOOK_DOC_PACKAGE.map((d) => (
                <li key={d} className="flex items-start gap-2 text-[12.5px] text-foreground">
                  <span className="text-primary mt-0.5">•</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ─── Финальная формула ─── */}
        <section>
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: toneBorder("info"), background: toneBg("info", 0.07) }}
          >
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert size={16} className="text-primary" />
              <h2 className="font-display text-[15px] font-semibold text-foreground">
                Финальная формула для сложных случаев
              </h2>
            </div>
            <p className="text-[13px] text-foreground italic leading-relaxed">
              {HANDBOOK_FINAL_FORMULA}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-primary">{icon}</span>
      <h2 className="font-display text-[16px] font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function SituationCard({
  situation,
}: {
  situation: (typeof HANDBOOK_SITUATIONS)[number];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-muted/40 transition-colors"
      >
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={toneStyle(situation.tone)}
        >
          <Icon name={situation.icon} size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-[10.5px] font-bold text-muted-foreground">{situation.code}</span>
          <h3 className="text-[13px] font-bold text-foreground leading-snug">{situation.title}</h3>
        </div>
        <ChevronDown
          size={16}
          className={`text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-2.5 border-t border-border pt-3">
          {situation.phrases.map((p, i) => (
            <div key={i}>
              <span
                className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1"
                style={toneStyle(p.tone)}
              >
                {p.stage}
              </span>
              <p className="text-[12.5px] text-foreground leading-snug">{p.text}</p>
            </div>
          ))}

          {situation.basis && (
            <div className="rounded-xl bg-muted/50 border border-border p-3 mt-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                Основание
              </div>
              <p className="text-[11.5px] text-muted-foreground leading-snug">{situation.basis}</p>
            </div>
          )}

          {situation.checklist && (
            <div className="mt-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">
                Что оформить
              </div>
              <ul className="space-y-1">
                {situation.checklist.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-[11.5px] text-foreground">
                    <span className="text-primary mt-0.5">•</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
