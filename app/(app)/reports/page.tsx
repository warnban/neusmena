"use client";

import { useMemo, useState, useEffect } from "react";
import {
  ComposedChart, Bar, Line, LineChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Eye, EyeOff } from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { TableSkeleton } from "@/components/ui/primitives";
import { KpiCard } from "@/components/ui/kpi-card";
import { Icon } from "@/components/icon";
import { useApp } from "@/components/providers/app-data";
import { money } from "@/lib/format";
import { buildMonthlyReport, calcKpis } from "@/lib/reporting";
import { calcPaymentBalances } from "@/lib/finance";
import { SalariesPanel } from "@/components/reports/salaries-panel";
import { DailyReportPanel } from "@/components/reports/daily-report-panel";
import { ShiftHandoverPanel } from "@/components/reports/shift-handover-panel";
import { MonthComparisonPanel } from "@/components/reports/month-comparison-panel";
import { CategoryBreakdownPanel } from "@/components/reports/category-breakdown-panel";
import { PaymentBalancePanel } from "@/components/reports/payment-balance-panel";
import { TransactionsPanel, type TxFilterState } from "@/components/reports/transactions-panel";
import { monthDateRange, type MonthKey } from "@/lib/month-comparison";
import { MetersPanel } from "@/components/reports/meters-panel";
import { RevenueSlicePanel } from "@/components/reports/revenue-slice-panel";
import { OperationDateField } from "@/components/ui/operation-date-field";
import { Modal } from "@/components/ui/modal";
import { fmtMskDateKey, mskDateKey } from "@/lib/msk-time";

export default function ReportsPage() {
  const { transactions, hotelId, setHotelId, bookings, rooms, beds, hotels, organizationStays, pmConfig, transactionCategories, refresh, loading, canManageSettings, canWriteHotelOps } = useApp();
  const [tab, setTab] = useState<"analytics" | "revenue" | "finance" | "shift" | "daily" | "salaries" | "transactions" | "meters">("analytics");
  const [analyticsView, setAnalyticsView] = useState<"overview" | "comparison">("comparison");
  const [pmVis, setPmVis] = useState<Record<string, boolean>>({});
  const [txPreset, setTxPreset] = useState<Partial<TxFilterState> | null>(null);
  const [encModal, setEncModal] = useState<string | null>(null);
  const [encAmount, setEncAmount] = useState("");
  const [encOperationDate, setEncOperationDate] = useState(() => mskDateKey());

  const activeHotelId = hotelId === "all" ? (hotels[0]?.id ?? "") : hotelId;
  const activeHotelName = hotels.find((h) => h.id === activeHotelId)?.name ?? "";

  function openTransactions(preset: Partial<TxFilterState>) {
    setTab("transactions");
    setTxPreset(preset);
  }

  function openTransactionsByCategory(direction: "income" | "expense", category: string, month: MonthKey) {
    const range = monthDateRange(month);
    openTransactions({ direction, category, dateFrom: range.from, dateTo: range.to, excludeOta: true });
  }

  useEffect(() => {
    if (tab !== "transactions") setTxPreset(null);
  }, [tab]);

  const pmEntries = Object.entries(pmConfig);
  const pmCodes = pmEntries.map(([k]) => k);

  useEffect(() => {
    setPmVis((prev) => {
      const next = { ...prev };
      pmCodes.forEach((c) => { if (next[c] === undefined) next[c] = true; });
      return next;
    });
  }, [pmCodes.join(",")]);

  const htxns = useMemo(
    () => transactions.filter((t) => hotelId === "all" || t.hotelId === hotelId),
    [transactions, hotelId]
  );

  const scopedBookings = useMemo(
    () => (hotelId === "all" ? bookings : bookings.filter((b) => b.hotelId === hotelId)),
    [bookings, hotelId]
  );

  const scopedRooms = useMemo(
    () => (hotelId === "all" ? rooms : rooms.filter((r) => r.hotelId === hotelId)),
    [rooms, hotelId]
  );

  const scopedBeds = useMemo(
    () => (hotelId === "all" ? beds : beds.filter((b) => b.hotelId === hotelId)),
    [beds, hotelId]
  );

  const scopedOrgStays = useMemo(
    () => (hotelId === "all" ? organizationStays : organizationStays.filter((s) => s.hotelId === hotelId)),
    [organizationStays, hotelId]
  );

  const revMonthlyData = useMemo(
    () => buildMonthlyReport(htxns, scopedBookings, scopedRooms, pmCodes, 6, scopedBeds, scopedOrgStays),
    [htxns, scopedBookings, scopedRooms, scopedBeds, scopedOrgStays, pmCodes.join(",")]
  );

  const kpis = useMemo(
    () => calcKpis(htxns, scopedBookings, scopedRooms, pmCodes, scopedBeds, scopedOrgStays),
    [htxns, scopedBookings, scopedRooms, scopedBeds, scopedOrgStays, pmCodes.join(",")]
  );

  const balances = useMemo(
    () => calcPaymentBalances(htxns, scopedBookings, pmCodes),
    [htxns, scopedBookings, pmCodes.join(",")]
  );

  const todayKey = mskDateKey();
  const monthToDateLabel = `с 1 по ${fmtMskDateKey(todayKey, true)}`;

  async function submitEncashment() {
    if (!encModal) return;
    const amount = Math.round(Number(encAmount));
    if (!amount || amount <= 0) return;
    const hid = hotelId === "all" ? (hotels[0]?.id ?? "") : hotelId;
    await fetch("/api/encashment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotelId: hid,
        paymentMethod: encModal,
        amount,
        note: "Инкассация",
        operationDate: canManageSettings ? encOperationDate : undefined,
      }),
    });
    setEncModal(null);
    setEncAmount("");
    await refresh();
  }

  if (loading) {
    return (
      <>
        <TopBar title="Отчёты и аналитика" />
        <div className="flex-1 p-4 md:p-6"><TableSkeleton rows={8} cols={5} /></div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Отчёты и аналитика" />
      <div className="bg-card px-6 flex gap-1 border-b border-border flex-wrap">
        {[["analytics", "Аналитика"], ["revenue", "Срез по выручке"], ["finance", "Финансы"], ["shift", "Пересменка"], ["daily", "Ежедневный"], ["salaries", "Зарплаты"], ["transactions", "Транзакции"], ["meters", "Счётчики"]].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t as typeof tab)} className={`px-4 py-3 text-[13px] font-semibold transition-all ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5 min-w-0">
        {tab === "analytics" && (
          <>
            <div className="flex flex-wrap gap-2">
              {([["comparison", "Сравнение"], ["overview", "Обзор"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAnalyticsView(key)}
                  className={`px-4 py-2 rounded-full text-[12px] font-bold transition-colors ${
                    analyticsView === key
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {analyticsView === "comparison" ? (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase mr-1">Отель</span>
                  {hotels.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setHotelId(h.id)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-colors ${
                        hotelId === h.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {h.name}
                    </button>
                  ))}
                </div>
                {hotelId === "all" ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <p className="text-[14px] font-bold text-foreground">Выберите отель</p>
                    <p className="text-[12px] text-muted-foreground mt-2 max-w-md mx-auto">
                      Месяцы сравниваются по каждому отелю отдельно.
                    </p>
                  </div>
                ) : (
                  <MonthComparisonPanel
                    hotelId={hotelId}
                    hotelName={hotels.find((h) => h.id === hotelId)?.name ?? ""}
                    transactions={transactions}
                    bookings={bookings}
                    pmConfig={pmConfig}
                    transactionCategories={transactionCategories}
                    onOpenTransactions={openTransactions}
                  />
                )}
              </>
            ) : (
              <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Выручка" value={money(kpis.monthRevenue)} sub={`${monthToDateLabel} · к тем же дням прошлого мес.`} trend={kpis.revenueTrend ? `${kpis.revenueTrend > 0 ? "+" : ""}${kpis.revenueTrend}%` : undefined} trendDir={kpis.revenueTrend >= 0 ? "up" : "down"} accent="#F59E0B" />
              <KpiCard label="Загрузка" value={`${kpis.occupancy}%`} sub={`${monthToDateLabel} · фактически прожитые ночи`} trend={kpis.occupancyTrend ? `${kpis.occupancyTrend > 0 ? "+" : ""}${kpis.occupancyTrend}%` : undefined} trendDir={kpis.occupancyTrend >= 0 ? "up" : "down"} spark={kpis.spark} accent="hsl(var(--primary))" />
              <KpiCard label="ADR" value={kpis.roomRevenueMonth ? money(kpis.adr) : "—"} sub={`${money(kpis.roomRevenueMonth)} за проживание / ${kpis.soldNightsMonth} ноч.`} accent="#10B981" />
              <KpiCard label="RevPAR" value={kpis.roomRevenueMonth ? money(kpis.revpar) : "—"} sub="проживание / доступное место·ночь" accent="hsl(var(--primary))" />
            </div>
            <PaymentBalancePanel
              transactions={htxns}
              bookings={scopedBookings}
              pmConfig={pmConfig}
              transactionCategories={transactionCategories}
              onOpenTransactions={openTransactions}
            />
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 bg-card rounded-xl p-5 border border-border">
                <h3 className="text-[13px] font-bold text-foreground mb-4">Выручка и загрузка · 6 месяцев</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={revMonthlyData} margin={{ left: -10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="m" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="rev" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                    <YAxis yAxisId="occ" orientation="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => v + "%"} />
                    <Tooltip formatter={(v, name) => [name === "Загрузка %" ? `${v}%` : money(Number(v)), name]} />
                    <Bar yAxisId="rev" dataKey="rev" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={32} name="Выручка" />
                    <Line yAxisId="occ" type="monotone" dataKey="occ" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: "#10B981" }} name="Загрузка %" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="lg:col-span-2">
                <CategoryBreakdownPanel
                  transactions={htxns}
                  bookings={scopedBookings}
                  transactionCategories={transactionCategories}
                  onCategoryClick={openTransactionsByCategory}
                />
              </div>
            </div>
              </>
            )}
          </>
        )}

        {tab === "revenue" && (
          <RevenueSlicePanel transactions={transactions} hotels={hotels} />
        )}

        {tab === "finance" && (
          <>
            <div>
              <h3 className="text-[13px] font-bold text-foreground mb-3">Остатки по способам оплаты</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                {pmEntries.map(([k, cfg]) => {
                  const bal = balances[k] ?? 0;
                  return (
                    <div
                      key={k}
                      role="button"
                      tabIndex={0}
                      onClick={() => openTransactions({ method: k })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openTransactions({ method: k });
                        }
                      }}
                      className="bg-card rounded-xl p-4 border border-border text-left w-full hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: cfg.bg }}><Icon name={cfg.icon} size={14} style={{ color: cfg.color }} /></div>
                        {bal > 0 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEncModal(k); setEncAmount(String(bal)); }}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg text-white hover:opacity-90"
                            style={{ background: "#EF4444" }}
                          >
                            Инкасс.
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">{cfg.label}</div>
                      <div className="text-[22px] font-black leading-none" style={{ color: bal < 0 ? "#DC2626" : cfg.color }}>{money(bal)}</div>
                      <div className="text-[10px] text-muted-foreground mt-2">Нажмите для транзакций</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-card rounded-xl p-5 border border-border">
              <h3 className="text-[13px] font-bold text-foreground mb-4">Поступления по способам оплаты · по месяцам</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={revMonthlyData} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="m" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v / 1000 + "k"} />
                  <Tooltip formatter={(v) => [money(Number(v)), ""]} />
                  {pmEntries.map(([k, cfg]) =>
                    pmVis[k] ? <Line key={k} type="monotone" dataKey={k} stroke={cfg.color} strokeWidth={2.5} dot={{ r: 3, fill: cfg.color }} name={cfg.label} /> : null
                  )}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {pmEntries.map(([k, cfg]) => (
                  <button key={k} onClick={() => setPmVis((v) => ({ ...v, [k]: !v[k] }))} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all border" style={{ background: pmVis[k] ? cfg.bg : undefined, color: pmVis[k] ? cfg.color : undefined, borderColor: pmVis[k] ? cfg.color + "60" : undefined }}>
                    {pmVis[k] ? <Eye size={10} /> : <EyeOff size={10} />} {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "shift" && (
          activeHotelId ? (
            <ShiftHandoverPanel hotelId={activeHotelId} hotelName={activeHotelName} pmConfig={pmConfig} />
          ) : (
            <p className="text-sm text-muted-foreground">Выберите отель для пересменки</p>
          )
        )}

        {tab === "daily" && (
          activeHotelId ? (
            <DailyReportPanel
              hotelId={activeHotelId}
              hotelName={activeHotelName}
              pmConfig={pmConfig}
              canReopenReport={canManageSettings}
              onClosed={refresh}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Выберите отель для ежедневного отчёта</p>
          )
        )}

        {tab === "salaries" && <SalariesPanel />}

        {tab === "transactions" && (
          <TransactionsPanel
            transactions={htxns}
            hotels={hotels}
            hotelId={hotelId}
            pmConfig={pmConfig}
            transactionCategories={transactionCategories}
            canManageSettings={canManageSettings}
            canCancelTransactions={canWriteHotelOps}
            onRefresh={refresh}
            preset={txPreset}
          />
        )}

        {tab === "meters" && (
          activeHotelId ? (
            <MetersPanel
              hotelId={activeHotelId}
              hotelName={activeHotelName}
              canManageZones={canManageSettings}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Выберите отель для учёта счётчиков</p>
          )
        )}
      </div>

      {encModal && (
        <Modal onClose={() => setEncModal(null)} className="max-w-[380px]" layerClassName="z-[60]">
            <div className="px-6 py-4 border-b border-border"><h2 className="text-[15px] font-bold text-foreground">Инкассация</h2><p className="text-[12px] text-muted-foreground">{encModal && pmConfig[encModal]?.label}</p></div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl p-4 text-center border" style={{ background: encModal ? pmConfig[encModal]?.bg : undefined, borderColor: encModal ? pmConfig[encModal]?.color + "40" : undefined }}>
                <div className="text-[11px] font-bold uppercase text-muted-foreground mb-1">Текущий остаток</div>
                <div className="text-[28px] font-black" style={{ color: encModal ? pmConfig[encModal]?.color : undefined }}>{money(encModal ? balances[encModal] ?? 0 : 0)}</div>
              </div>
              <input type="number" value={encAmount} onChange={(e) => setEncAmount(e.target.value)} className="w-full px-3 py-2.5 text-[15px] font-bold rounded-xl outline-none focus:ring-2 focus:ring-ring border border-border bg-muted text-foreground" />
              <OperationDateField
                enabled={canManageSettings}
                value={encOperationDate}
                onChange={setEncOperationDate}
              />
            </div>
            <div className="px-6 py-4 flex gap-2 border-t border-border">
              <button onClick={submitEncashment} className="flex-1 py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90" style={{ background: "linear-gradient(135deg,#EF4444,#DC2626)" }}>Провести</button>
              <button onClick={() => setEncModal(null)} className="px-4 py-2.5 text-[13px] font-semibold rounded-xl bg-muted text-muted-foreground">Отмена</button>
            </div>
        </Modal>
      )}
    </>
  );
}
