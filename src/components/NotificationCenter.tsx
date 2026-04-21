import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Package,
  Wallet,
  TrendingDown,
  Coins,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertCategory =
  | "cash_diff"
  | "payment"
  | "low_stock"
  | "inventory_mismatch"
  | "fx_loss";

export interface AppAlert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  amount?: string;
  timestamp?: string;
}

const LOW_STOCK_THRESHOLD = 5;

const categoryIcon = (cat: AlertCategory) => {
  switch (cat) {
    case "cash_diff":
      return Wallet;
    case "payment":
      return Coins;
    case "low_stock":
      return Package;
    case "inventory_mismatch":
      return AlertTriangle;
    case "fx_loss":
      return TrendingDown;
  }
};

const severityClasses = (s: AlertSeverity) => {
  switch (s) {
    case "critical":
      return {
        ring: "border-destructive/30 bg-destructive/5",
        icon: "text-destructive",
        Icon: AlertCircle,
      };
    case "warning":
      return {
        ring: "border-warning/30 bg-warning/5",
        icon: "text-warning",
        Icon: AlertTriangle,
      };
    case "info":
      return {
        ring: "border-success/30 bg-success/5",
        icon: "text-success",
        Icon: Info,
      };
  }
};

export function NotificationCenter() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<AppAlert[]>([]);
  const [loading, setLoading] = useState(false);

  const isAuthorized = profile?.role === "admin" || profile?.role === "local";

  const scan = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    const collected: AppAlert[] = [];

    // 1) Cash session differences (closed sessions, last 7 days)
    const { data: closedSessions } = await supabase
      .from("cash_sessions")
      .select("id, session_date, closed_at")
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(5);

    if (closedSessions && closedSessions.length > 0) {
      const ids = closedSessions.map((s) => s.id);
      const { data: bals } = await supabase
        .from("cash_session_balances")
        .select("*, account:accounts(name)")
        .in("session_id", ids);
      bals?.forEach((b: any) => {
        const diff = Number(b.difference || 0);
        if (Math.abs(diff) >= 0.01) {
          const sess = closedSessions.find((s) => s.id === b.session_id);
          collected.push({
            id: `cash-${b.id}`,
            severity: diff < 0 ? "critical" : "warning",
            category: "cash_diff",
            title: diff < 0 ? "Faltante en caja" : "Sobrante en caja",
            description: `${b.account?.name || "Cuenta"} (${b.currency}) — ${
              sess ? format(new Date(sess.session_date), "d MMM", { locale: es }) : ""
            }`,
            amount: `${diff >= 0 ? "+" : ""}${diff.toFixed(2)} ${b.currency}`,
            timestamp: sess?.closed_at,
          });
        }
      });
    }

    // 2) Payment issues — orders pending payment for >2 days
    const { data: pendingOrders } = await supabase
      .from("orders")
      .select("id, total_mxn, payment_status, created_at, customer:customers(name)")
      .eq("payment_status", "pending")
      .order("created_at", { ascending: true })
      .limit(20);
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    pendingOrders?.forEach((o: any) => {
      if (new Date(o.created_at).getTime() < twoDaysAgo) {
        collected.push({
          id: `pay-${o.id}`,
          severity: "warning",
          category: "payment",
          title: "Pago pendiente vencido",
          description: `${o.customer?.name || "Cliente"} — orden sin pagar >2 días`,
          amount: `$${Number(o.total_mxn).toFixed(0)} MXN`,
          timestamp: o.created_at,
        });
      }
    });

    // 3) POS sales with insufficient batch consumption (overpayment vs received check)
    const { data: posPayments } = await supabase
      .from("pos_sale_payments")
      .select("sale_id, amount_mxn, sale:pos_sales(total_amount, currency, product_name, sale_date)")
      .order("created_at", { ascending: false })
      .limit(50);
    const paymentsBySale: Record<string, { paid: number; sale: any }> = {};
    posPayments?.forEach((p: any) => {
      if (!p.sale) return;
      if (!paymentsBySale[p.sale_id])
        paymentsBySale[p.sale_id] = { paid: 0, sale: p.sale };
      paymentsBySale[p.sale_id].paid += Number(p.amount_mxn || 0);
    });
    Object.entries(paymentsBySale).forEach(([sid, info]) => {
      const expected = Number(info.sale.total_amount || 0);
      const paid = info.paid;
      const diff = paid - expected;
      if (Math.abs(diff) < 0.5) return;
      if (diff > 0.5) {
        collected.push({
          id: `over-${sid}`,
          severity: "warning",
          category: "payment",
          title: "Sobrepago en venta POS",
          description: `${info.sale.product_name}`,
          amount: `+$${diff.toFixed(2)} MXN`,
          timestamp: info.sale.sale_date,
        });
      } else if (diff < -0.5) {
        collected.push({
          id: `under-${sid}`,
          severity: "critical",
          category: "payment",
          title: "Pago incompleto en venta POS",
          description: `${info.sale.product_name}`,
          amount: `${diff.toFixed(2)} MXN`,
          timestamp: info.sale.sale_date,
        });
      }
    });

    // 4) Low stock + inventory mismatch
    const { data: stock } = await supabase
      .from("product_stock")
      .select("product_id, product_name, stock");
    stock?.forEach((s: any) => {
      const qty = Number(s.stock || 0);
      if (qty < 0) {
        collected.push({
          id: `mismatch-${s.product_id}`,
          severity: "critical",
          category: "inventory_mismatch",
          title: "Inventario negativo",
          description: `${s.product_name} — stock < 0`,
          amount: `${qty}`,
        });
      } else if (qty <= LOW_STOCK_THRESHOLD) {
        collected.push({
          id: `low-${s.product_id}`,
          severity: qty === 0 ? "critical" : "warning",
          category: "low_stock",
          title: qty === 0 ? "Sin stock" : "Stock bajo",
          description: `${s.product_name}`,
          amount: `${qty} u`,
        });
      }
    });

    // 5) Currency conversion losses — POS payments where exchange_rate deviates
    // significantly from current sell rate (>5% loss)
    const { data: rates } = await supabase
      .from("exchange_rates")
      .select("currency, sell_rate, buy_rate")
      .order("updated_at", { ascending: false });
    const currentSell: Record<string, number> = {};
    rates?.forEach((r: any) => {
      if (!(r.currency in currentSell)) currentSell[r.currency] = Number(r.sell_rate);
    });

    const { data: recentPayments } = await supabase
      .from("pos_sale_payments")
      .select("id, currency, amount, exchange_rate, amount_mxn, created_at")
      .neq("currency", "MXN")
      .order("created_at", { ascending: false })
      .limit(30);
    recentPayments?.forEach((p: any) => {
      const cur = p.currency as string;
      const market = currentSell[cur];
      if (!market || !p.exchange_rate) return;
      const used = Number(p.exchange_rate);
      // Loss = received less MXN per unit than market would give
      if (used < market * 0.95) {
        const lossPerUnit = market - used;
        const totalLoss = lossPerUnit * Number(p.amount || 0);
        collected.push({
          id: `fx-${p.id}`,
          severity: totalLoss > 100 ? "critical" : "warning",
          category: "fx_loss",
          title: "Pérdida por conversión",
          description: `Pago en ${cur} con tasa ${used.toFixed(2)} vs mercado ${market.toFixed(2)}`,
          amount: `-$${totalLoss.toFixed(2)} MXN`,
          timestamp: p.created_at,
        });
      }
    });

    // Sort: critical → warning → info, then most recent first
    const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    collected.sort((a, b) => {
      const so = order[a.severity] - order[b.severity];
      if (so !== 0) return so;
      return (b.timestamp || "").localeCompare(a.timestamp || "");
    });

    setAlerts(collected);
    setLoading(false);
  }, [isAuthorized]);

  useEffect(() => {
    scan();
    const interval = setInterval(scan, 60_000);
    return () => clearInterval(interval);
  }, [scan]);

  if (!isAuthorized) return null;

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const total = alerts.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative">
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <span
              className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                criticalCount > 0
                  ? "bg-destructive text-destructive-foreground"
                  : warningCount > 0
                    ? "bg-warning text-warning-foreground"
                    : "bg-success text-success-foreground"
              }`}
            >
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] max-w-[calc(100vw-1rem)] p-0 rounded-2xl overflow-hidden"
      >
        <div className="p-3 border-b flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Centro de alertas</h3>
            <p className="text-[11px] text-muted-foreground">
              {total === 0 ? "Sin alertas activas" : `${total} alerta${total > 1 ? "s" : ""}`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={scan}
            disabled={loading}
            className="h-7 text-[11px] rounded-lg"
          >
            {loading ? "..." : "Refrescar"}
          </Button>
        </div>

        {/* Severity summary */}
        {total > 0 && (
          <div className="px-3 pt-3 flex gap-2">
            {criticalCount > 0 && (
              <Badge className="text-[10px] h-5 rounded-full bg-destructive text-destructive-foreground">
                {criticalCount} crítica{criticalCount > 1 ? "s" : ""}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge className="text-[10px] h-5 rounded-full bg-warning text-warning-foreground">
                {warningCount} aviso{warningCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}

        <div className="max-h-[400px] overflow-y-auto p-3 space-y-2">
          {total === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="text-sm font-medium">Todo en orden</p>
              <p className="text-xs text-muted-foreground">No se detectaron problemas</p>
            </div>
          ) : (
            alerts.map((a) => {
              const cls = severityClasses(a.severity);
              const CatIcon = categoryIcon(a.category);
              return (
                <div
                  key={a.id}
                  className={`rounded-xl border p-2.5 ${cls.ring} animate-fade-in`}
                >
                  <div className="flex items-start gap-2">
                    <cls.Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cls.icon}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold truncate">{a.title}</p>
                        <CatIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{a.description}</p>
                      <div className="flex items-center justify-between mt-1">
                        {a.amount && (
                          <span className={`text-[11px] font-bold ${cls.icon}`}>{a.amount}</span>
                        )}
                        {a.timestamp && (
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {format(new Date(a.timestamp), "d MMM HH:mm", { locale: es })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
