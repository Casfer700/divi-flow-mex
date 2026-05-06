import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import {
  TrendingUp, TrendingDown, DollarSign, Package, Users, AlertTriangle,
  Wallet, Coins, Banknote, Activity, ShoppingBag, AlertCircle, Info,
  Download, ChevronDown, ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { NotificationCenter } from "@/components/NotificationCenter";

interface DailySummary {
  totalSalesMxn: number;
  productProfit: number;
  fxProfit: number;
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
  agentId: string | null;
  sales: number;
  revenueMxn: number;
  cogsMxn: number;
  profitMxn: number;
  commissionMxn: number;
  commissionUsd: number;
}

interface StockAlertRow { product_name: string; stock: number; severity: "critical" | "warning"; }

interface VerboseAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  description: string;
  amount?: string;
  explanation: string;
}

interface AgentSaleDetail {
  date: string;
  product: string;
  invoice: string;
  salePrice: number;
  cost: number;
  commission: number;
  commissionCurrency: string;
  profit: number;
  currency: string;
}

export function OwnerDashboard() {
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DailySummary>({
    totalSalesMxn: 0, productProfit: 0, fxProfit: 0, orderCount: 0, posCount: 0, cogs: 0,
  });
  const [cashRows, setCashRows] = useState<CashRow[]>([]);
  const [currencyAgg, setCurrencyAgg] = useState<CurrencyAgg[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlertRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [verboseAlerts, setVerboseAlerts] = useState<VerboseAlert[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [agentDetails, setAgentDetails] = useState<AgentSaleDetail[]>([]);
  const [loadingAgent, setLoadingAgent] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const start = startOfDay(date).toISOString();
    const end = endOfDay(date).toISOString();

    const { data: orders } = await supabase
      .from("orders").select("*")
      .gte("created_at", start).lte("created_at", end);

    const { data: posSales } = await supabase
      .from("pos_sales").select("*")
      .gte("sale_date", start).lte("sale_date", end);

    const posIds = (posSales || []).map(s => s.id);
    let consumption: any[] = [];
    if (posIds.length > 0) {
      const { data } = await supabase
        .from("pos_sale_batch_consumption").select("*")
        .in("sale_id", posIds);
      consumption = data || [];
    }

    const { data: movements } = await supabase
      .from("financial_movements").select("*")
      .gte("movement_date", start).lte("movement_date", end);

    const { data: rates } = await supabase
      .from("exchange_rates").select("currency, sell_rate")
      .order("updated_at", { ascending: false });
    const sellRate: Record<string, number> = {};
    rates?.forEach((r: any) => { if (!(r.currency in sellRate)) sellRate[r.currency] = Number(r.sell_rate); });
    sellRate["MXN"] = 1;

    // FX profit from currency_lot_consumption
    const { data: fxConsumption } = await supabase
      .from("currency_lot_consumption").select("fx_profit")
      .gte("created_at", start).lte("created_at", end);
    const fxProfit = (fxConsumption || []).reduce((s, c: any) => s + Number(c.fx_profit || 0), 0);

    // DAILY SUMMARY
    const ordersRevenue = (orders || []).reduce((s, o: any) => s + Number(o.total_mxn || 0), 0);
    const posRevenue = (posSales || []).reduce((s, p: any) => {
      const rate = sellRate[p.currency] || 1;
      return s + Number(p.total_amount || 0) * (p.currency === "MXN" ? 1 : rate);
    }, 0);
    const totalSalesMxn = ordersRevenue + posRevenue;
    const cogs = consumption.reduce((s, c) => s + Number(c.total_cost_mxn || 0), 0);

    // Real commissions from pos_sales (not estimated)
    const realCommissions = (posSales || []).reduce((s, p: any) => {
      return s + Number(p.commission_mxn || 0);
    }, 0);

    const productProfit = totalSalesMxn - cogs - realCommissions;

    setSummary({ totalSalesMxn, productProfit, fxProfit, cogs, orderCount: (orders || []).length, posCount: (posSales || []).length });

    // CASH ANALYSIS
    const { data: sessions } = await supabase
      .from("cash_sessions").select("*")
      .order("opened_at", { ascending: false }).limit(1);
    const session = sessions?.[0];
    let cashList: CashRow[] = [];
    if (session) {
      const { data: balances } = await supabase
        .from("cash_session_balances").select("*, accounts(name)")
        .eq("session_id", session.id);
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
          currency: b.currency, opening: Number(b.opening_balance || 0),
          expected, actual,
          difference: actual != null ? actual - expected : null,
        } as CashRow;
      }));
      cashList = rows;
    }
    setCashRows(cashList);

    // EXPENSES
    const expensesTotal = (movements || [])
      .filter((m: any) => m.movement_type === "expense")
      .reduce((s, m: any) => {
        const rate = sellRate[m.currency] || 1;
        return s + Number(m.amount || 0) * (m.currency === "MXN" ? 1 : rate);
      }, 0);

    // CURRENCY ANALYSIS
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
    if (ordersRevenue > 0) {
      if (!byCur["MXN"]) byCur["MXN"] = { currency: "MXN", revenueMxn: 0, cogsMxn: 0, profitMxn: 0 };
      byCur["MXN"].revenueMxn += ordersRevenue;
      byCur["MXN"].profitMxn += ordersRevenue;
    }
    setCurrencyAgg(Object.values(byCur).sort((a, b) => b.revenueMxn - a.revenueMxn));

    // INVENTORY STATUS
    const { data: stock } = await supabase.from("product_stock").select("product_name, stock");
    const stockList: StockAlertRow[] = [];
    stock?.forEach((s: any) => {
      const qty = Number(s.stock || 0);
      if (qty <= 0) stockList.push({ product_name: s.product_name, stock: qty, severity: "critical" });
      else if (qty <= 5) stockList.push({ product_name: s.product_name, stock: qty, severity: "warning" });
    });
    setStockAlerts(stockList.sort((a, b) => a.stock - b.stock).slice(0, 12));

    // AGENT PERFORMANCE — use REAL commissions
    const agentMap: Record<string, AgentRow> = {};
    (posSales || []).forEach((p: any) => {
      const name = (p.sales_agent || "Sin agente").trim() || "Sin agente";
      const rate = sellRate[p.currency] || 1;
      const rev = Number(p.total_amount || 0) * (p.currency === "MXN" ? 1 : rate);
      const c = consBySale[p.id] || 0;
      const commMxn = Number(p.commission_mxn || 0);
      // If commission_currency is USD, show separately
      const commCurrency = p.commission_currency || "MXN";
      if (!agentMap[name]) agentMap[name] = { agent: name, agentId: p.sales_agent_id || null, sales: 0, revenueMxn: 0, cogsMxn: 0, profitMxn: 0, commissionMxn: 0, commissionUsd: 0 };
      agentMap[name].sales += 1;
      agentMap[name].revenueMxn += rev;
      agentMap[name].cogsMxn += c;
      if (commCurrency === "USD") {
        agentMap[name].commissionUsd += commMxn;
      } else {
        agentMap[name].commissionMxn += commMxn;
      }
      agentMap[name].profitMxn += rev - c - commMxn;
    });
    setAgents(Object.values(agentMap).sort((a, b) => b.revenueMxn - a.revenueMxn));

    // ALERTS
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
            ? `Se esperaba ${c.expected.toFixed(2)} ${c.currency} pero se contó ${c.actual?.toFixed(2)}.`
            : `Se contó ${c.actual?.toFixed(2)} ${c.currency} pero se esperaba ${c.expected.toFixed(2)}.`,
        });
      }
    });
    stockList.slice(0, 5).forEach((s) => {
      v.push({
        id: `stock-${s.product_name}`,
        severity: s.severity,
        category: s.stock <= 0 ? "inventory_mismatch" : "low_stock",
        title: s.stock <= 0 ? "Producto sin stock" : "Stock bajo",
        description: s.product_name,
        amount: `${s.stock} u`,
        explanation: s.stock <= 0
          ? "Este producto no tiene unidades disponibles."
          : "Quedan pocas unidades. Considera reabastecer.",
      });
    });
    if (realCommissions > 0) {
      v.push({
        id: "commissions",
        severity: "info",
        category: "commissions",
        title: "Comisiones del día",
        description: "Comisiones reales registradas en ventas POS",
        amount: `-$${realCommissions.toFixed(2)}`,
        explanation: "Monto real de comisiones pagadas a agentes.",
      });
    }
    if (expensesTotal > 0) {
      v.push({
        id: "expenses",
        severity: "info",
        category: "expenses",
        title: "Gastos del día",
        description: "Suma de movimientos tipo gasto",
        amount: `-$${expensesTotal.toFixed(2)} MXN`,
        explanation: "Gastos registrados hoy.",
      });
    }
    setVerboseAlerts(v);
    setLoading(false);
  }, [date]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const loadAgentDetails = async (agentName: string) => {
    if (expandedAgent === agentName) { setExpandedAgent(null); return; }
    setExpandedAgent(agentName);
    setLoadingAgent(true);
    const monthStart = startOfMonth(date).toISOString();
    const monthEnd = endOfMonth(date).toISOString();

    const { data: sales } = await supabase
      .from("pos_sales")
      .select("id, product_name, total_amount, currency, commission_mxn, commission_currency, sale_date, sales_agent")
      .eq("sales_agent", agentName)
      .gte("sale_date", monthStart).lte("sale_date", monthEnd)
      .order("sale_date", { ascending: false });

    const saleIds = (sales || []).map(s => s.id);
    let consBysale: Record<string, number> = {};
    if (saleIds.length > 0) {
      const { data: cons } = await supabase
        .from("pos_sale_batch_consumption").select("sale_id, total_cost_mxn")
        .in("sale_id", saleIds);
      (cons || []).forEach(c => {
        consBysale[c.sale_id] = (consByale[c.sale_id] || 0) + Number(c.total_cost_mxn || 0);
      });
    }

    const details: AgentSaleDetail[] = (sales || []).map((s: any) => ({
      date: s.sale_date,
      product: s.product_name,
      invoice: "",
      salePrice: Number(s.total_amount),
      cost: consByale[s.id] || 0,
      commission: Number(s.commission_mxn || 0),
      commissionCurrency: s.commission_currency || "MXN",
      profit: Number(s.total_amount) - (consByale[s.id] || 0) - Number(s.commission_mxn || 0),
      currency: s.currency,
    }));
    setAgentDetails(details);
    setLoadingAgent(false);
  };

  const exportAgentReport = () => {
    if (agentDetails.length === 0) return;
    const header = "Fecha,Producto,Precio,Costo,Comisión,Moneda Com.,Utilidad,Divisa";
    const rows = agentDetails.map(d =>
      `${new Date(d.date).toLocaleDateString("es-MX")},${d.product},${d.salePrice.toFixed(2)},${d.cost.toFixed(2)},${d.commission.toFixed(2)},${d.commissionCurrency},${d.profit.toFixed(2)},${d.currency}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agente_${expandedAgent}_${format(date, "yyyy-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalProfit = summary.productProfit + summary.fxProfit;

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
              <div className={`rounded-2xl p-4 border ${totalProfit >= 0 ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}>
                {totalProfit >= 0 ? <TrendingUp className="h-4 w-4 text-success mb-1" /> : <TrendingDown className="h-4 w-4 text-destructive mb-1" />}
                <p className="text-xs text-muted-foreground">Utilidad real</p>
                <p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-success" : "text-destructive"}`}>
                  ${totalProfit.toFixed(0)}
                </p>
                <p className="text-[10px] text-muted-foreground">producto + FX</p>
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

          {/* PROFIT BREAKDOWN */}
          <section className="bg-card rounded-2xl shadow-fintech-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Desglose de utilidad</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground">Producto</p>
                <p className={`text-sm font-bold ${summary.productProfit >= 0 ? "text-success" : "text-destructive"}`}>
                  ${summary.productProfit.toFixed(0)}
                </p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground">Cambio (FX)</p>
                <p className={`text-sm font-bold ${summary.fxProfit >= 0 ? "text-success" : "text-destructive"}`}>
                  ${summary.fxProfit.toFixed(0)}
                </p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground">Total</p>
                <p className={`text-sm font-bold ${totalProfit >= 0 ? "text-success" : "text-destructive"}`}>
                  ${totalProfit.toFixed(0)}
                </p>
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
                  <div key={a.agent} className="space-y-0">
                    <button
                      onClick={() => loadAgentDetails(a.agent)}
                      className="w-full bg-muted/30 rounded-xl p-3 space-y-1 text-left hover:bg-muted/50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{a.agent}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{a.sales} venta{a.sales > 1 ? "s" : ""}</span>
                          {expandedAgent === a.agent ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-[11px]">
                        <div>
                          <p className="text-[9px] text-muted-foreground uppercase">Ventas</p>
                          <p className="font-semibold">${a.revenueMxn.toFixed(0)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground uppercase">Com. MXN</p>
                          <p className="font-semibold text-warning">${a.commissionMxn.toFixed(0)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground uppercase">Com. USD</p>
                          <p className="font-semibold text-warning">${a.commissionUsd.toFixed(0)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground uppercase">Utilidad</p>
                          <p className={`font-semibold ${a.profitMxn >= 0 ? "text-success" : "text-destructive"}`}>${a.profitMxn.toFixed(0)}</p>
                        </div>
                      </div>
                    </button>

                    {expandedAgent === a.agent && (
                      <div className="bg-muted/20 rounded-b-xl p-3 space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                            Detalle mensual ({format(date, "MMMM yyyy", { locale: es })})
                          </p>
                          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={exportAgentReport}>
                            <Download className="h-3 w-3" /> CSV
                          </Button>
                        </div>
                        {loadingAgent ? (
                          <p className="text-xs text-muted-foreground">Cargando...</p>
                        ) : agentDetails.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sin ventas este mes.</p>
                        ) : (
                          <>
                            <div className="max-h-48 overflow-y-auto space-y-1">
                              {agentDetails.map((d, i) => (
                                <div key={i} className="grid grid-cols-5 gap-1 text-[10px] items-center bg-card rounded-lg p-2">
                                  <span>{new Date(d.date).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>
                                  <span className="truncate">{d.product}</span>
                                  <span className="text-right">{d.salePrice.toFixed(0)} {d.currency}</span>
                                  <span className="text-right text-warning">{d.commission.toFixed(0)} {d.commissionCurrency}</span>
                                  <span className={`text-right font-bold ${d.profit >= 0 ? "text-success" : "text-destructive"}`}>
                                    {d.profit >= 0 ? "🟢" : "🔴"} {d.profit.toFixed(0)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-4 gap-1 text-[10px] border-t pt-2 font-bold">
                              <span>Total</span>
                              <span className="text-right">${agentDetails.reduce((s, d) => s + d.salePrice, 0).toFixed(0)}</span>
                              <span className="text-right text-warning">${agentDetails.reduce((s, d) => s + d.commission, 0).toFixed(0)}</span>
                              <span className={`text-right ${agentDetails.reduce((s, d) => s + d.profit, 0) >= 0 ? "text-success" : "text-destructive"}`}>
                                ${agentDetails.reduce((s, d) => s + d.profit, 0).toFixed(0)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
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
