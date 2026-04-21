import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  TrendingUp, TrendingDown, DollarSign, Package, Users, AlertTriangle,
  Wallet, Coins, Banknote, Activity, ShoppingBag, AlertCircle, Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { NotificationCenter, AppAlert } from "@/components/NotificationCenter";

// Reuse alert scanning logic by re-implementing a hook-friendly version
// (NotificationCenter component shows the bell; here we render a verbose detail list)

interface DailySummary {
  totalSalesMxn: number;
  profit: number;
  orderCount: number;
  posCount: number;
  cogs: number;
}

interface CashRow {
  account_name: string;
  currency: string;
  opening: number;
  expected: number;
  actual: number | null;
  difference: number | null;
}

interface CurrencyAgg { currency: string; revenueMxn: number; cogsMxn: number; profitMxn: number; }

interface AgentRow {
  agent: string;
  sales: number;
  revenueMxn: number;
  cogsMxn: number;
  profitMxn: number;
  commission: number;
}

interface LossBreakdown { commissions: number; fxLoss: number; expenses: number; }

interface StockAlertRow { product_name: string; stock: number; severity: "critical" | "warning"; }

interface VerboseAlert extends AppAlert { explanation: string; }

const COMMISSION_RATE = 0.05; // 5% default; adjust if you store per-agent rates

export function OwnerDashboard() {
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DailySummary>({
    totalSalesMxn: 0, profit: 0, orderCount: 0, posCount: 0, cogs: 0,
  });
  const [cashRows, setCashRows] = useState<CashRow[]>([]);
  const [losses, setLosses] = useState<LossBreakdown>({ commissions: 0, fxLoss: 0, expenses: 0 });
  const [currencyAgg, setCurrencyAgg] = useState<CurrencyAgg[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlertRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [verboseAlerts, setVerboseAlerts] = useState<VerboseAlert[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const start = startOfDay(date).toISOString();
    const end = endOfDay(date).toISOString();

    // ---- Orders for the day
    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", start).lte("created_at", end);

    // ---- POS sales for the day
    const { data: posSales } = await supabase
      .from("pos_sales")
      .select("*")
      .gte("sale_date", start).lte("sale_date", end);

    // ---- Batch consumption joined to those POS sales (for COGS/profit)
    const posIds = (posSales || []).map(s => s.id);
    let consumption: any[] = [];
    if (posIds.length > 0) {
      const { data } = await supabase
        .from("pos_sale_batch_consumption")
        .select("*")
        .in("sale_id", posIds);
      consumption = data || [];
    }

    // ---- Financial movements for the day
    const { data: movements } = await supabase
      .from("financial_movements")
      .select("*")
      .gte("movement_date", start).lte("movement_date", end);

    // ---- Exchange rates (current sell)
    const { data: rates } = await supabase
      .from("exchange_rates")
      .select("currency, sell_rate")
      .order("updated_at", { ascending: false });
    const sellRate: Record<string, number> = {};
    rates?.forEach((r: any) => { if (!(r.currency in sellRate)) sellRate[r.currency] = Number(r.sell_rate); });
    sellRate["MXN"] = 1;

    // ---- DAILY SUMMARY
    const ordersRevenue = (orders || []).reduce((s, o: any) => s + Number(o.total_mxn || 0), 0);
    const posRevenue = (posSales || []).reduce((s, p: any) => {
      const rate = sellRate[p.currency] || 1;
      return s + Number(p.total_amount || 0) * (p.currency === "MXN" ? 1 : rate);
    }, 0);
    const totalSalesMxn = ordersRevenue + posRevenue;
    const cogs = consumption.reduce((s, c) => s + Number(c.total_cost_mxn || 0), 0);
    const profit = totalSalesMxn - cogs;

    setSummary({
      totalSalesMxn,
      profit,
      cogs,
      orderCount: (orders || []).length,
      posCount: (posSales || []).length,
    });

    // ---- CASH ANALYSIS — open or most recent closed session
    const { data: sessions } = await supabase
      .from("cash_sessions")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(1);
    const session = sessions?.[0];
    let cashList: CashRow[] = [];
    if (session) {
      const { data: balances } = await supabase
        .from("cash_session_balances")
        .select("*, accounts(name)")
        .eq("session_id", session.id);
      // Recompute expected for open sessions in real time
      const rows = await Promise.all((balances || []).map(async (b: any) => {
        let expected = Number(b.expected_closing || 0);
        if (session.status === "open") {
          const { data: exp } = await supabase.rpc("compute_expected_closing", {
            _session_id: session.id, _account_id: b.account_id,
          });
          if (typeof exp === "number") expected = exp;
        }
        const actual = b.actual_closing != null ? Number(b.actual_closing) : null;
        return {
          account_name: b.accounts?.name || "Cuenta",
          currency: b.currency,
          opening: Number(b.opening_balance || 0),
          expected,
          actual,
          difference: actual != null ? actual - expected : null,
        } as CashRow;
      }));
      cashList = rows;
    }
    setCashRows(cashList);

    // ---- LOSS DETECTION
    // Commissions = COMMISSION_RATE * sum of POS sales by agent (assumes paid out as expense later)
    const commissionsTotal = (posSales || []).reduce((s, p: any) => {
      if (!p.sales_agent) return s;
      const rate = sellRate[p.currency] || 1;
      const inMxn = Number(p.total_amount || 0) * (p.currency === "MXN" ? 1 : rate);
      return s + inMxn * COMMISSION_RATE;
    }, 0);

    // Expenses from financial movements
    const expensesTotal = (movements || [])
      .filter((m: any) => m.movement_type === "expense")
      .reduce((s, m: any) => {
        const rate = sellRate[m.currency] || 1;
        return s + Number(m.amount || 0) * (m.currency === "MXN" ? 1 : rate);
      }, 0);

    // FX losses: POS payments where exchange_rate < market * 0.95
    const { data: posPayments } = await supabase
      .from("pos_sale_payments")
      .select("currency, amount, exchange_rate, created_at")
      .neq("currency", "MXN")
      .gte("created_at", start).lte("created_at", end);
    let fxLossTotal = 0;
    posPayments?.forEach((p: any) => {
      const market = sellRate[p.currency];
      if (!market) return;
      const used = Number(p.exchange_rate || 0);
      if (used < market * 0.95) fxLossTotal += (market - used) * Number(p.amount || 0);
    });

    setLosses({ commissions: commissionsTotal, fxLoss: fxLossTotal, expenses: expensesTotal });

    // ---- CURRENCY ANALYSIS — group POS sales by currency, compute revenue / COGS / profit in MXN
    const consBySale: Record<string, number> = {};
    consumption.forEach(c => {
      consBySale[c.sale_id] = (consBySale[c.sale_id] || 0) + Number(c.total_cost_mxn || 0);
    });
    const byCur: Record<string, CurrencyAgg> = {};
    (posSales || []).forEach((p: any) => {
      const rate = sellRate[p.currency] || 1;
      const rev = Number(p.total_amount || 0) * (p.currency === "MXN" ? 1 : rate);
      const c = consBySale[p.id] || 0;
      if (!byCur[p.currency]) byCur[p.currency] = { currency: p.currency, revenueMxn: 0, cogsMxn: 0, profitMxn: 0 };
      byCur[p.currency].revenueMxn += rev;
      byCur[p.currency].cogsMxn += c;
      byCur[p.currency].profitMxn += rev - c;
    });
    // Add orders as MXN revenue (orders settled in MXN)
    if (ordersRevenue > 0) {
      if (!byCur["MXN"]) byCur["MXN"] = { currency: "MXN", revenueMxn: 0, cogsMxn: 0, profitMxn: 0 };
      byCur["MXN"].revenueMxn += ordersRevenue;
      byCur["MXN"].profitMxn += ordersRevenue;
    }
    setCurrencyAgg(Object.values(byCur).sort((a, b) => b.revenueMxn - a.revenueMxn));

    // ---- INVENTORY STATUS — low or missing stock
    const { data: stock } = await supabase
      .from("product_stock")
      .select("product_name, stock");
    const stockList: StockAlertRow[] = [];
    stock?.forEach((s: any) => {
      const qty = Number(s.stock || 0);
      if (qty <= 0) stockList.push({ product_name: s.product_name, stock: qty, severity: "critical" });
      else if (qty <= 5) stockList.push({ product_name: s.product_name, stock: qty, severity: "warning" });
    });
    setStockAlerts(stockList.sort((a, b) => a.stock - b.stock).slice(0, 12));

    // ---- AGENT PERFORMANCE
    const agentMap: Record<string, AgentRow> = {};
    (posSales || []).forEach((p: any) => {
      const name = (p.sales_agent || "Sin agente").trim() || "Sin agente";
      const rate = sellRate[p.currency] || 1;
      const rev = Number(p.total_amount || 0) * (p.currency === "MXN" ? 1 : rate);
      const c = consBySale[p.id] || 0;
      if (!agentMap[name]) agentMap[name] = { agent: name, sales: 0, revenueMxn: 0, cogsMxn: 0, profitMxn: 0, commission: 0 };
      agentMap[name].sales += 1;
      agentMap[name].revenueMxn += rev;
      agentMap[name].cogsMxn += c;
      agentMap[name].profitMxn += rev - c;
      agentMap[name].commission += rev * COMMISSION_RATE;
    });
    setAgents(Object.values(agentMap).sort((a, b) => b.revenueMxn - a.revenueMxn));

    // ---- ALERT DETAILS (verbose) — reuse logic patterns
    const v: VerboseAlert[] = [];
    cashList.forEach((c) => {
      if (c.difference != null && Math.abs(c.difference) > 0.01) {
        const isMissing = c.difference < 0;
        v.push({
          id: `cash-${c.account_name}-${c.currency}`,
          severity: isMissing ? "critical" : "warning",
          category: "cash_diff",
          title: isMissing ? "Faltante de efectivo" : "Sobrante de efectivo",
          description: `${c.account_name} (${c.currency})`,
          amount: `${c.difference >= 0 ? "+" : ""}${c.difference.toFixed(2)} ${c.currency}`,
          explanation: isMissing
            ? `Se esperaba ${c.expected.toFixed(2)} ${c.currency} pero se contó ${c.actual?.toFixed(2)}. Esto suele indicar pagos no registrados, retiros sin documentar o errores de conteo.`
            : `Se contó ${c.actual?.toFixed(2)} ${c.currency} pero se esperaba ${c.expected.toFixed(2)}. Suele deberse a depósitos olvidados de registrar o cobros en exceso.`,
        });
      }
    });
    if (losses.fxLoss > 0 || fxLossTotal > 0) {
      v.push({
        id: "fx-summary",
        severity: fxLossTotal > 100 ? "critical" : "warning",
        category: "fx_loss",
        title: "Pérdida por conversión de divisas",
        description: "Pagos POS en moneda extranjera",
        amount: `-$${fxLossTotal.toFixed(2)} MXN`,
        explanation: "Algunos pagos se aceptaron a una tasa más baja que el mercado actual. Revisa las tasas de cambio en Admin.",
      });
    }
    stockList.slice(0, 5).forEach((s) => {
      v.push({
        id: `stock-${s.product_name}`,
        severity: s.severity,
        category: s.stock <= 0 ? "inventory_mismatch" : "low_stock",
        title: s.stock <= 0 ? "Producto sin stock" : "Stock bajo",
        description: s.product_name,
        amount: `${s.stock} u`,
        explanation: s.stock <= 0
          ? "Este producto no tiene unidades disponibles y bloqueará nuevas ventas. Registra un nuevo lote en Lotes."
          : `Quedan pocas unidades. Considera reabastecer pronto para evitar quiebres.`,
      });
    });
    if (commissionsTotal > 0) {
      v.push({
        id: "commissions",
        severity: "info",
        category: "fx_loss",
        title: "Comisiones del día",
        description: `Estimado ${(COMMISSION_RATE * 100).toFixed(0)}% sobre ventas con agente`,
        amount: `-$${commissionsTotal.toFixed(2)} MXN`,
        explanation: "Monto que se pagará a agentes. Asegúrate de registrarlo como gasto cuando se liquide.",
      });
    }
    if (expensesTotal > 0) {
      v.push({
        id: "expenses",
        severity: "info",
        category: "fx_loss",
        title: "Gastos del día",
        description: "Suma de movimientos tipo gasto",
        amount: `-$${expensesTotal.toFixed(2)} MXN`,
        explanation: "Gastos registrados hoy. Compara con tu presupuesto operativo.",
      });
    }
    setVerboseAlerts(v);

    setLoading(false);
  }, [date]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totalLosses = losses.commissions + losses.fxLoss + losses.expenses;
  const netProfit = summary.profit - totalLosses;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Vista Owner
          </h2>
          <p className="text-xs text-muted-foreground">Resumen ejecutivo del negocio</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 rounded-lg gap-1 text-xs">
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(date, "d MMM", { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-muted-foreground">Cargando dashboard...</div>
      ) : (
        <>
          {/* DAILY SUMMARY */}
          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Resumen del día</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-4 border border-primary/10">
                <DollarSign className="h-4 w-4 text-primary mb-1" />
                <p className="text-xs text-muted-foreground">Ventas totales</p>
                <p className="text-2xl font-bold">${summary.totalSalesMxn.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">MXN</p>
              </div>
              <div className={`rounded-2xl p-4 border ${netProfit >= 0 ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}>
                {netProfit >= 0 ? <TrendingUp className="h-4 w-4 text-success mb-1" /> : <TrendingDown className="h-4 w-4 text-destructive mb-1" />}
                <p className="text-xs text-muted-foreground">Utilidad neta</p>
                <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-success" : "text-destructive"}`}>
                  ${netProfit.toFixed(0)}
                </p>
                <p className="text-[10px] text-muted-foreground">tras pérdidas</p>
              </div>
              <div className="bg-card rounded-2xl p-3 shadow-fintech-sm">
                <ShoppingBag className="h-4 w-4 text-muted-foreground mb-1" />
                <p className="text-lg font-bold">{summary.orderCount + summary.posCount}</p>
                <p className="text-[10px] text-muted-foreground">{summary.orderCount} órdenes · {summary.posCount} POS</p>
              </div>
              <div className="bg-card rounded-2xl p-3 shadow-fintech-sm">
                <Package className="h-4 w-4 text-muted-foreground mb-1" />
                <p className="text-lg font-bold">${summary.cogs.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">Costo mercancía (COGS)</p>
              </div>
            </div>
          </section>

          {/* CASH ANALYSIS */}
          <section className="bg-card rounded-2xl shadow-fintech-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Análisis de caja</h3>
            </div>
            {cashRows.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Sin sesión de caja activa.</p>
            ) : (
              <div className="space-y-2">
                {cashRows.map((c, i) => (
                  <div key={i} className="bg-muted/30 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold">{c.account_name}</span>
                      <Badge variant="outline" className="text-[10px] h-5">{c.currency}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Apertura</p>
                        <p className="font-semibold">{c.opening.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Esperado</p>
                        <p className="font-semibold">{c.expected.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Real</p>
                        <p className="font-semibold">{c.actual != null ? c.actual.toFixed(2) : "—"}</p>
                      </div>
                    </div>
                    {c.difference != null && Math.abs(c.difference) > 0.01 && (
                      <div className={`mt-2 flex items-center justify-between text-xs font-bold ${c.difference < 0 ? "text-destructive" : "text-warning"}`}>
                        <span>Diferencia</span>
                        <span>{c.difference >= 0 ? "+" : ""}{c.difference.toFixed(2)} {c.currency}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* LOSS DETECTION */}
          <section className="bg-card rounded-2xl shadow-fintech-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold">Detección de pérdidas</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <LossCard label="Comisiones" value={losses.commissions} />
              <LossCard label="Conversión" value={losses.fxLoss} />
              <LossCard label="Gastos" value={losses.expenses} />
            </div>
            <div className="pt-2 border-t flex items-center justify-between">
              <span className="text-xs font-semibold">Total pérdidas</span>
              <span className="text-sm font-bold text-destructive">-${totalLosses.toFixed(2)} MXN</span>
            </div>
          </section>

          {/* CURRENCY ANALYSIS */}
          <section className="bg-card rounded-2xl shadow-fintech-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Análisis por divisa</h3>
            </div>
            {currencyAgg.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin ventas hoy.</p>
            ) : (
              <div className="space-y-2">
                {currencyAgg.map((c) => (
                  <div key={c.currency} className="bg-muted/30 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge className="text-[10px] h-5 rounded-full">{c.currency}</Badge>
                      <span className={`text-xs font-bold ${c.profitMxn >= 0 ? "text-success" : "text-destructive"}`}>
                        {c.profitMxn >= 0 ? "+" : ""}${c.profitMxn.toFixed(2)} MXN
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Ingreso ${c.revenueMxn.toFixed(0)}</span>
                      <span>COGS ${c.cogsMxn.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* AGENT PERFORMANCE */}
          <section className="bg-card rounded-2xl shadow-fintech-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Desempeño de agentes</h3>
            </div>
            {agents.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin ventas con agente hoy.</p>
            ) : (
              <div className="space-y-2">
                {agents.map((a) => (
                  <div key={a.agent} className="bg-muted/30 rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{a.agent}</span>
                      <span className="text-[10px] text-muted-foreground">{a.sales} venta{a.sales > 1 ? "s" : ""}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[11px]">
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase">Ventas</p>
                        <p className="font-semibold">${a.revenueMxn.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase">Comisión</p>
                        <p className="font-semibold text-warning">${a.commission.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase">Utilidad</p>
                        <p className={`font-semibold ${a.profitMxn >= 0 ? "text-success" : "text-destructive"}`}>${a.profitMxn.toFixed(0)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* INVENTORY STATUS */}
          <section className="bg-card rounded-2xl shadow-fintech-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold">Estado de inventario</h3>
            </div>
            {stockAlerts.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todo el inventario en niveles saludables.</p>
            ) : (
              <div className="space-y-1.5">
                {stockAlerts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                    <span className="text-xs truncate">{s.product_name}</span>
                    <Badge className={`text-[10px] h-5 rounded-full ${s.severity === "critical" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}`}>
                      {s.stock} u
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ALERT DETAILS */}
          <section className="bg-card rounded-2xl shadow-fintech-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-semibold">Detalle de alertas</h3>
            </div>
            {verboseAlerts.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin alertas relevantes hoy.</p>
            ) : (
              <div className="space-y-2">
                {verboseAlerts.map((a) => {
                  const Icon = a.severity === "critical" ? AlertCircle : a.severity === "warning" ? AlertTriangle : Info;
                  const cls = a.severity === "critical"
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : a.severity === "warning"
                      ? "border-warning/30 bg-warning/5 text-warning"
                      : "border-success/30 bg-success/5 text-success";
                  return (
                    <div key={a.id} className={`rounded-xl border p-3 ${cls.split(" ").slice(0,2).join(" ")}`}>
                      <div className="flex items-start gap-2">
                        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cls.split(" ")[2]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold">{a.title}</p>
                            {a.amount && <span className={`text-[11px] font-bold ${cls.split(" ")[2]}`}>{a.amount}</span>}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{a.description}</p>
                          <p className="text-[11px] mt-1 text-foreground/80">{a.explanation}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function LossCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/30 rounded-xl p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-destructive">-${value.toFixed(0)}</p>
    </div>
  );
}
