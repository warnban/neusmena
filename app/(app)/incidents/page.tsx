"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Lock, Siren, Paperclip } from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/primitives";
import { Icon } from "@/components/icon";
import { useApp } from "@/components/providers/app-data";
import { fmtDate } from "@/lib/format";
import { toneColor, toneBg } from "@/lib/constants";
import { INCIDENT_TYPE_META, INCIDENT_STATUS_META } from "@/lib/incidents";
import { IncidentModal } from "@/components/incidents/incident-modal";
import type { Incident } from "@/lib/types";

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${fmtDate(d, false)}, ${time}`;
}

export default function IncidentsPage() {
  const { hotels, hotelId, loading, canWriteHotelOps } = useApp();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Incident | null>(null);

  const hotelName = (hid: string) => hotels.find((h) => h.id === hid)?.name ?? "—";
  const defaultHotelId = hotelId === "all" ? (hotels[0]?.id ?? "") : hotelId;

  const load = useMemo(
    () => async () => {
      if (!canWriteHotelOps) return;
      setDataLoading(true);
      setLoadError(null);
      try {
        const q = hotelId && hotelId !== "all" ? `?hotelId=${hotelId}` : "";
        const res = await fetch(`/api/incidents${q}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Ошибка загрузки");
        setIncidents(data.incidents ?? []);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        setDataLoading(false);
      }
    },
    [hotelId, canWriteHotelOps]
  );

  useEffect(() => {
    if (loading) return;
    load();
  }, [loading, load]);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(inc: Incident) {
    setEditing(inc);
    setModalOpen(true);
  }

  function onSaved(saved: Incident) {
    setIncidents((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      const next = exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [saved, ...prev];
      return next.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    });
    setEditing(saved);
  }
  function onDeleted(id: string) {
    setIncidents((prev) => prev.filter((i) => i.id !== id));
    setModalOpen(false);
    setEditing(null);
  }

  const openCount = incidents.filter((i) => i.status === "open").length;

  if (loading) {
    return (
      <>
        <TopBar title="Журнал происшествий" />
        <div className="flex-1 p-4 md:p-6">
          <TableSkeleton rows={6} cols={4} />
        </div>
      </>
    );
  }

  if (!canWriteHotelOps) {
    return (
      <>
        <TopBar title="Журнал происшествий" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="rounded-2xl border border-border bg-card p-8 text-center max-w-sm">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Lock size={20} className="text-muted-foreground" />
            </div>
            <p className="text-[15px] font-bold text-foreground">Раздел недоступен</p>
            <p className="text-[12px] text-muted-foreground mt-1.5">
              Журнал происшествий доступен администраторам, управляющим и владельцу.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        title="Журнал происшествий"
        subtitle={incidents.length ? `${incidents.length} записей · ${openCount} открытых` : "Фиксация нарушений и происшествий"}
      >
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-xl text-white bg-primary hover:opacity-90 transition-opacity"
        >
          <Plus size={14} /> Новая запись
        </button>
      </TopBar>

      <div className="flex-1 overflow-auto custom-scrollbar p-4 md:p-6">
        {dataLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : loadError ? (
          <ErrorState description={loadError} onRetry={load} />
        ) : incidents.length === 0 ? (
          <EmptyState
            icon={<Siren size={22} />}
            title="Записей пока нет"
            description="Фиксируйте происшествия, нарушения правил проживания и порядка. К записи можно приложить акт о нарушении, акт о повреждении и объяснение гостя."
            action={
              <button
                type="button"
                onClick={openNew}
                className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold rounded-xl text-white bg-primary hover:opacity-90"
              >
                <Plus size={14} /> Новая запись
              </button>
            }
          />
        ) : (
          <div className="space-y-2.5 max-w-[1000px]">
            {incidents.map((inc) => {
              const meta = INCIDENT_TYPE_META[inc.type];
              const st = INCIDENT_STATUS_META[inc.status];
              return (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => openEdit(inc)}
                  className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ color: toneColor(meta.tone), background: toneBg(meta.tone) }}
                    >
                      <Icon name={meta.icon} size={17} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-bold text-foreground">{meta.label}</span>
                        <span
                          className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                          style={{ color: toneColor(st.tone), background: toneBg(st.tone) }}
                        >
                          {st.label}
                        </span>
                        {inc.policeCalled && (
                          <span
                            className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                            style={{ color: toneColor("danger"), background: toneBg("danger") }}
                          >
                            Полиция
                          </span>
                        )}
                      </div>
                      <p className="text-[12.5px] text-muted-foreground mt-1 line-clamp-2">
                        {inc.description || "—"}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                        <span>{fmtDateTime(inc.occurredAt)}</span>
                        <span>· {hotelName(inc.hotelId)}</span>
                        {inc.guestName && <span>· {inc.guestName}</span>}
                        {inc.roomNumber && <span>· №{inc.roomNumber}</span>}
                        {inc.attachments.length > 0 && (
                          <span className="flex items-center gap-1">
                            · <Paperclip size={11} /> {inc.attachments.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <IncidentModal
          incident={editing}
          hotels={hotels.map((h) => ({ id: h.id, name: h.name }))}
          defaultHotelId={defaultHotelId}
          onClose={() => setModalOpen(false)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </>
  );
}
