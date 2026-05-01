import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowRightLeft, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { cn } from "@/lib/utils";

interface Account { id: string; name: string; currency: string; }
interface Exchange {
  id: string;
  operation: "buy" | "sell";
  currency: string;
  amount: number;
  exchange_rate: number;
  mxn_equivalent: number;
  operation_date: string;
  notes: string | null;
  customer_name: string | null;
}

const FOREIGN = ["USD", "EUR", "CUP"];

export function CurrencyExchangeManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [history, setHistory] = useState<Exchange[]>([]);

  const [operation, setOperation] = useState<"sell" | "buy">("sell");
  const [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [currencyAccount, setCurrencyAccount] = useState("");
  const [mxnAccount, setMxnAccount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [{ data: a }, { data: h }] = await Promise.all([
      supabase.from("accounts").select("id,name,currency").eq("is_active", true).order("name"),
      supabase.from("currency_exchanges").select("*").order("operation_date", { ascending: false }).limit(20),
    ]);
    setAccounts((a as Account[]) || []);
    setHistory((h as Exchange[]) || []);
  };
  useEffect(() => { load(); }, []);

  const currencyAccounts = useMemo(() => accounts.filter((a) => a.currency === currency), [accounts, currency]);
  const mxnAccounts = useMemo(() => accounts.filter((a) => a.currency === "MXN"), [accounts]);

  const mxnEquivalent = useMemo(() => {
    const a = parseFloat(amount) || 0;
    const r = parseFloat(rate) || 0;
    if (currency === "CUP") return r > 0 ? a / r : 0;
    return a * r;
  }, [amount, rate, currency]);

  const submit = async () => {
    const a = parseFloat(amount);
    const r = parseFloat(rate);
    if (!a || a <= 0) return toast.error("Monto inválido");
    if (!r || r <= 0) return toast.error("Tasa inválida");
    if (!currencyAccount) return toast.error(`Selecciona cuenta ${currency}`);
    if (!mxnAccount) return toast.error("Selecciona cuenta MXN");

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("currency_exchanges").insert({
      operation,
      currency,
      amount: a,
      exchange_rate: r,
      mxn_equivalent: mxnEquivalent,
      currency_account_id: currencyAccount,
      mxn_account_id: mxnAccount,
      customer_name: customerName.trim() || null,
      notes: notes.trim() || null,
      created_by: user?.id,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`${operation === "sell" ? "Venta" : "Compra"} de divisa registrada`);
    setAmount(""); setRate(""); setNotes(""); setCustomerName("");
    load();
  };

  return (
    <div className="bg-card rounded-2xl shadow-fintech-sm p-4 space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4" /> Compra / Venta de divisas
      </h2>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setOperation("sell")}
          className={cn(
            "rounded-xl p-3 text-sm font-semibold flex items-center justify-center gap-2 transition",
            operation === "sell" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          <ArrowUpFromLine className="h-4 w-4" /> Vender divisa
        </button>
        <button
          onClick={() => setOperation("buy")}
          className={cn(
            "rounded-xl p-3 text-sm font-semibold flex items-center justify-center gap-2 transition",
            operation === "buy" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          <ArrowDownToLine className="h-4 w-4" /> Comprar divisa
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {operation === "sell"
          ? `Salen ${currency} de tu cuenta y entra MXN.`
          : `Sale MXN y entran ${currency} a tu cuenta.`}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Divisa</Label>
          <Select value={currency} onValueChange={(v) => { setCurrency(v); setCurrencyAccount(""); }}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              {FOREIGN.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Monto ({currency})</Label>
          <Input type="number" step="0.01" inputMode="decimal" value={amount}
            onChange={(e) => setAmount(e.target.value)} className="h-10" />
        </div>
      </div>

      <div>
        <Label className="text-xs">
          Tasa {currency === "CUP" ? `(CUP por 1 MXN)` : `(MXN por 1 ${currency})`}
        </Label>
        <Input type="number" step="0.0001" inputMode="decimal" value={rate}
          onChange={(e) => setRate(e.target.value)} className="h-10" />
      </div>

      <div className="bg-muted/30 rounded-lg p-3 text-center">
        <p className="text-[10px] uppercase text-muted-foreground">Equivalente MXN</p>
        <p className="text-xl font-bold tabular-nums">${mxnEquivalent.toFixed(2)}</p>
      </div>

      <div>
        <Label className="text-xs">Cuenta {currency}</Label>
        <Select value={currencyAccount} onValueChange={setCurrencyAccount}>
          <SelectTrigger className="h-10"><SelectValue placeholder={`Cuenta ${currency}`} /></SelectTrigger>
          <SelectContent className="bg-popover">
            {currencyAccounts.length === 0 && (
              <SelectItem value="__none" disabled>Sin cuentas {currency}</SelectItem>
            )}
            {currencyAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Cuenta MXN</Label>
        <Select value={mxnAccount} onValueChange={setMxnAccount}>
          <SelectTrigger className="h-10"><SelectValue placeholder="Cuenta MXN" /></SelectTrigger>
          <SelectContent className="bg-popover">
            {mxnAccounts.length === 0 && (
              <SelectItem value="__none" disabled>Sin cuentas MXN</SelectItem>
            )}
            {mxnAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Cliente / Contacto</Label>
        <Input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder={operation === "sell" ? "Quien recibe la divisa" : "Quien provee la divisa"}
          className="h-10"
        />
      </div>

      <div>
        <Label className="text-xs">Notas</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-10" />
      </div>

      <Button onClick={submit} disabled={submitting} className="w-full h-11 rounded-xl font-semibold">
        {submitting ? "Procesando..." : `Registrar ${operation === "sell" ? "venta" : "compra"} de ${currency}`}
      </Button>

      {history.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Historial reciente</p>
          <div className="space-y-1">
            {history.map((h) => (
              <div key={h.id} className="rounded-lg border bg-card p-2 text-xs flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className={cn(
                    "font-bold",
                    h.operation === "sell" ? "text-success" : "text-warning",
                  )}>
                    {h.operation === "sell" ? "Venta" : "Compra"}
                  </span>{" "}
                  {Number(h.amount).toFixed(2)} {h.currency} @ {Number(h.exchange_rate).toFixed(4)}
                  {h.customer_name && (
                    <p className="text-[11px] font-medium truncate">👤 {h.customer_name}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(h.operation_date).toLocaleString("es-MX")}
                  </p>
                </div>
                <span className="font-bold tabular-nums shrink-0">${Number(h.mxn_equivalent).toFixed(2)} MXN</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
