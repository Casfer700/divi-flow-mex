import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Account { id: string; name: string; currency: string; }
interface Movement {
  id: string;
  account_id: string | null;
  movement_type: "income" | "expense";
  source: string;
  currency: string;
  amount: number;
  reference: string | null;
  movement_date: string;
}

const CURRENCIES = ["all", "MXN", "USD", "EUR", "CUP"];

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function lastOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export function MonthlyAccountReport() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(lastOfMonth());
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");

  const loadAccounts = async () => {
    const { data } = await supabase.from("accounts").select("id,name,currency").eq("is_active", true).order("name");
    setAccounts((data as Account[]) || []);
  };
  useEffect(() => { loadAccounts(); }, []);

  const generate = async () => {
    let q = supabase.from("financial_movements")
      .select("id,account_id,movement_type,source,currency,amount,reference,movement_date")
      .gte("movement_date", new Date(startDate).toISOString())
      .lte("movement_date", new Date(endDate + "T23:59:59").toISOString());
    if (accountFilter !== "all") q = q.eq("account_id", accountFilter);
    if (currencyFilter !== "all") q = q.eq("currency", currencyFilter);
    const { data } = await q;
    setMovements((data as Movement[]) || []);
  };

  useEffect(() => { generate(); }, [startDate, endDate, accountFilter, currencyFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, {
      account: Account | null;
      currency: string;
      income: number;
      expense: number;
      purchases: number;
      exchangeIncome: number;
      invoices: Movement[];
    }>();
    for (const m of movements) {
      const accId = m.account_id ?? "_no_account";
      const key = `${accId}::${m.currency}`;
      if (!map.has(key)) {
        map.set(key, {
          account: accounts.find((a) => a.id === accId) || null,
          currency: m.currency,
          income: 0,
          expense: 0,
          purchases: 0,
          exchangeIncome: 0,
          invoices: [],
        });
      }
      const row = map.get(key)!;
      const amt = Number(m.amount);
      if (m.movement_type === "income") row.income += amt;
      else row.expense += amt;
      if (m.source === "purchase_invoice") {
        row.purchases += amt;
        row.invoices.push(m);
      }
      if (m.source === "currency_exchange" && m.movement_type === "income") {
        row.exchangeIncome += amt;
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const an = a.account?.name ?? "—";
      const bn = b.account?.name ?? "—";
      return an.localeCompare(bn);
    });
  }, [movements, accounts]);

  const totals = useMemo(() => {
    return grouped.reduce(
      (acc, g) => {
        if (g.currency === "MXN") {
          acc.incomeMxn += g.income;
          acc.expenseMxn += g.expense;
        }
        return acc;
      },
      { incomeMxn: 0, expenseMxn: 0 },
    );
  }, [grouped]);

  return (
    <div className="bg-card rounded-2xl shadow-fintech-sm p-4 space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <BarChart3 className="h-4 w-4" /> Reporte mensual por cuenta
      </h2>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Inicio</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10" />
        </div>
        <div>
          <Label className="text-xs">Fin</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">Todas las cuentas</SelectItem>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover">
            {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c === "all" ? "Todas las divisas" : c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-success/10 rounded-lg p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Ingresos MXN</p>
          <p className="text-base font-bold tabular-nums text-success">${totals.incomeMxn.toFixed(2)}</p>
        </div>
        <div className="bg-destructive/10 rounded-lg p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Egresos MXN</p>
          <p className="text-base font-bold tabular-nums text-destructive">${totals.expenseMxn.toFixed(2)}</p>
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Sin movimientos en el rango.</p>
      ) : (
        <div className="space-y-2">
          {grouped.map((g, idx) => {
            const net = g.income - g.expense;
            return (
              <div key={idx} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm">{g.account?.name ?? "Sin cuenta"} <span className="text-xs text-muted-foreground">· {g.currency}</span></p>
                  <span className={cn(
                    "text-xs font-bold tabular-nums",
                    net >= 0 ? "text-success" : "text-destructive",
                  )}>
                    {net >= 0 ? "+" : ""}{net.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-muted-foreground">Ingresos</p>
                    <p className="font-bold tabular-nums">{g.income.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Egresos</p>
                    <p className="font-bold tabular-nums">{g.expense.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Compras (facturas)</p>
                    <p className="font-bold tabular-nums">{g.purchases.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ingreso por cambio</p>
                    <p className="font-bold tabular-nums">{g.exchangeIncome.toFixed(2)}</p>
                  </div>
                </div>
                {g.invoices.length > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-[10px] uppercase text-muted-foreground mb-1">Facturas</p>
                    <ul className="text-[11px] space-y-0.5">
                      {g.invoices.slice(0, 5).map((inv) => (
                        <li key={inv.id} className="flex justify-between">
                          <span className="truncate">{inv.reference ?? "—"}</span>
                          <span className="tabular-nums">{Number(inv.amount).toFixed(2)}</span>
                        </li>
                      ))}
                      {g.invoices.length > 5 && (
                        <li className="text-muted-foreground">+{g.invoices.length - 5} más</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
