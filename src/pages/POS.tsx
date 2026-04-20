import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, ShoppingCart, Check, Receipt, X, Plus, Trash2, AlertTriangle, AlertCircle, Zap, Banknote, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NumericKeypad } from "@/components/pos/NumericKeypad";

interface Product {
  id: string;
  name: string;
  base_price: number;
  currency: string;
  category: string | null;
}

interface Account {
  id: string;
  name: string;
  currency: string;
}

interface RecentSale {
  id: string;
  product_name: string;
  total_amount: number;
  currency: string;
  sales_agent: string | null;
  sale_date: string;
}

interface ExchangeRate {
  currency: string;
  rate_type: string;
  sell_rate: number;
}

interface DraftPayment {
  key: string;
  amount: string;
  currency: string;
  payment_method: "cash" | "transfer";
  account_id: string;
}

const CURRENCIES = ["MXN", "USD", "EUR", "CUP"];

// Convert any amount in `from` currency to `to` currency, via MXN.
// USD/EUR/MXN use multiplication: amountMXN = amount * rate.
// CUP uses division: amountMXN = amount / rate.
function toMXN(amount: number, currency: string, rates: Record<string, number>): number {
  if (currency === "MXN") return amount;
  const rate = rates[currency];
  if (!rate || rate <= 0) return 0;
  if (currency === "CUP") return amount / rate;
  return amount * rate;
}

function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  if (from === to) return amount;
  const mxn = toMXN(amount, from, rates);
  if (to === "MXN") return mxn;
  const rate = rates[to];
  if (!rate || rate <= 0) return 0;
  if (to === "CUP") return mxn * rate;
  return mxn / rate;
}

export default function POS() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recent, setRecent] = useState<RecentSale[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [salesAgent, setSalesAgent] = useState("");
  const [notes, setNotes] = useState("");
  const [payments, setPayments] = useState<DraftPayment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [quickMode, setQuickMode] = useState(true);
  const [quickMethod, setQuickMethod] = useState<"cash" | "transfer">("cash");

  useEffect(() => {
    if (profile && profile.role !== "admin" && profile.role !== "local") {
      navigate("/");
    }
  }, [profile, navigate]);

  const load = async () => {
    const [{ data: prods }, { data: accs }, { data: sales }, { data: ex }] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true).order("name"),
      supabase.from("accounts").select("id,name,currency").eq("is_active", true).order("name"),
      supabase
        .from("pos_sales")
        .select("id,product_name,total_amount,currency,sales_agent,sale_date")
        .order("sale_date", { ascending: false })
        .limit(8),
      supabase.from("exchange_rates").select("currency,rate_type,sell_rate"),
    ]);
    setProducts(prods || []);
    setAccounts(accs || []);
    setRecent(sales || []);

    // Build a simple rate map: prefer 'retail' rate per currency
    const map: Record<string, number> = {};
    (ex as ExchangeRate[] | null)?.forEach((r) => {
      if (!map[r.currency] || r.rate_type === "retail") {
        map[r.currency] = Number(r.sell_rate);
      }
    });
    setRates(map);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const total = useMemo(() => {
    const p = parseFloat(price) || 0;
    const q = parseFloat(quantity) || 0;
    return p * q;
  }, [price, quantity]);

  const saleCurrency = selected?.currency ?? "MXN";

  // Sum of payments converted into the sale currency
  const paidInSaleCurrency = useMemo(() => {
    return payments.reduce((sum, p) => {
      const a = parseFloat(p.amount) || 0;
      if (a <= 0) return sum;
      return sum + convert(a, p.currency, saleCurrency, rates);
    }, 0);
  }, [payments, saleCurrency, rates]);

  const remaining = Math.max(0, total - paidInSaleCurrency);
  const overpaid = paidInSaleCurrency > total + 0.001;
  const fullyPaid = total > 0 && Math.abs(paidInSaleCurrency - total) < 0.01;
  const progressPct = total > 0 ? Math.min(100, (paidInSaleCurrency / total) * 100) : 0;

  // Flash animation when paid amount or remaining changes
  const [flashKey, setFlashKey] = useState(0);
  const lastPaidRef = useRef(paidInSaleCurrency);
  useEffect(() => {
    if (Math.abs(paidInSaleCurrency - lastPaidRef.current) > 0.001) {
      lastPaidRef.current = paidInSaleCurrency;
      setFlashKey((k) => k + 1);
    }
  }, [paidInSaleCurrency]);

  // Inline validation message for the confirm button
  const validationMessage = useMemo(() => {
    if (!selected) return null;
    if (total <= 0) return "Define un precio y cantidad válidos";
    if (payments.length === 0) return "Agrega al menos un pago";
    const hasEmpty = payments.some((p) => !parseFloat(p.amount) || parseFloat(p.amount) <= 0);
    if (hasEmpty) return "Hay pagos vacíos o con monto inválido";
    if (overpaid) return `Sobrepago de ${(paidInSaleCurrency - total).toFixed(2)} ${saleCurrency}`;
    if (!fullyPaid) return `Falta pagar ${remaining.toFixed(2)} ${saleCurrency}`;
    return null;
  }, [selected, total, payments, overpaid, fullyPaid, paidInSaleCurrency, remaining, saleCurrency]);

  const totalMXN = useMemo(() => toMXN(total, saleCurrency, rates), [total, saleCurrency, rates]);
  const paidMXN = useMemo(
    () =>
      payments.reduce((sum, p) => {
        const a = parseFloat(p.amount) || 0;
        return sum + toMXN(a, p.currency, rates);
      }, 0),
    [payments, rates],
  );

  const pickProduct = (p: Product) => {
    setSelected(p);
    setPrice(String(p.base_price));
    setQuantity("1");
    setPayments([]);
  };

  const clear = () => {
    setSelected(null);
    setPrice("");
    setQuantity("1");
    setNotes("");
    setPayments([]);
  };

  const addPayment = (currency: string) => {
    // Pre-fill with remaining amount converted to chosen currency
    const remainingInCurrency = convert(remaining, saleCurrency, currency, rates);
    setPayments((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        amount: remainingInCurrency > 0 ? remainingInCurrency.toFixed(2) : "",
        currency,
        payment_method: "cash",
        account_id: "",
      },
    ]);
  };

  const updatePayment = (key: string, patch: Partial<DraftPayment>) => {
    setPayments((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  };

  const removePayment = (key: string) => {
    setPayments((prev) => prev.filter((p) => p.key !== key));
  };

  const confirm = async () => {
    if (!selected) {
      toast.error("Selecciona un producto");
      return;
    }
    const unit = parseFloat(price);
    const qty = parseFloat(quantity);
    if (!unit || unit <= 0) return toast.error("Precio inválido");
    if (!qty || qty <= 0) return toast.error("Cantidad inválida");
    if (payments.length === 0) return toast.error("Agrega al menos un pago");
    if (overpaid) return toast.error("El total pagado excede el total de la venta");
    if (!fullyPaid) return toast.error("La venta no está completamente pagada");

    for (const p of payments) {
      const a = parseFloat(p.amount);
      if (!a || a <= 0) return toast.error("Todos los pagos deben tener monto válido");
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    // 1) Create the sale header
    const { data: saleRow, error: saleErr } = await supabase
      .from("pos_sales")
      .insert({
        product_id: selected.id,
        product_name: selected.name,
        unit_price: unit,
        quantity: qty,
        total_amount: unit * qty,
        currency: selected.currency,
        // Header keeps a representative method/account (first payment)
        payment_method: payments[0].payment_method,
        account_id: payments[0].account_id || null,
        sales_agent: salesAgent.trim() || null,
        notes: notes.trim() || null,
        created_by: user?.id,
      })
      .select("id")
      .single();

    if (saleErr || !saleRow) {
      setSubmitting(false);
      toast.error(saleErr?.message ?? "Error al crear la venta");
      return;
    }

    // 2) Insert each payment row → trigger creates financial movements
    const paymentRows = payments.map((p) => {
      const amt = parseFloat(p.amount);
      const mxnEq = toMXN(amt, p.currency, rates);
      // Stored exchange_rate is the rate vs MXN used for this payment
      const rate = p.currency === "MXN" ? 1 : rates[p.currency] ?? 1;
      return {
        sale_id: saleRow.id,
        amount: amt,
        currency: p.currency,
        exchange_rate: rate,
        amount_mxn: mxnEq,
        payment_method: p.payment_method,
        account_id: p.account_id || null,
        created_by: user?.id,
      };
    });

    const { error: payErr } = await supabase.from("pos_sale_payments").insert(paymentRows);

    setSubmitting(false);
    if (payErr) {
      // Roll back the sale to keep things consistent
      await supabase.from("pos_sales").delete().eq("id", saleRow.id);
      toast.error("Error al registrar pagos: " + payErr.message);
      return;
    }

    toast.success("Venta registrada");
    clear();
    load();
  };

  // Quick confirm: one-tap sale paid in full with chosen method, in sale currency.
  const quickConfirm = async () => {
    if (!selected) return toast.error("Selecciona un producto");
    const unit = parseFloat(price);
    if (!unit || unit <= 0) return toast.error("Precio inválido");
    const qty = parseFloat(quantity) || 1;

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    // Auto-pick a matching account for the sale currency + method (optional)
    const matching = accounts.find(
      (a) => a.currency === selected.currency && (quickMethod === "cash" ? /efect|caja|cash/i.test(a.name) : /banco|trans|bank/i.test(a.name)),
    ) ?? accounts.find((a) => a.currency === selected.currency);

    const totalAmount = unit * qty;

    const { data: saleRow, error: saleErr } = await supabase
      .from("pos_sales")
      .insert({
        product_id: selected.id,
        product_name: selected.name,
        unit_price: unit,
        quantity: qty,
        total_amount: totalAmount,
        currency: selected.currency,
        payment_method: quickMethod,
        account_id: matching?.id ?? null,
        sales_agent: salesAgent.trim() || null,
        notes: notes.trim() || null,
        created_by: user?.id,
      })
      .select("id")
      .single();

    if (saleErr || !saleRow) {
      setSubmitting(false);
      return toast.error(saleErr?.message ?? "Error al crear la venta");
    }

    const rate = selected.currency === "MXN" ? 1 : rates[selected.currency] ?? 1;
    const { error: payErr } = await supabase.from("pos_sale_payments").insert([{
      sale_id: saleRow.id,
      amount: totalAmount,
      currency: selected.currency,
      exchange_rate: rate,
      amount_mxn: toMXN(totalAmount, selected.currency, rates),
      payment_method: quickMethod,
      account_id: matching?.id ?? null,
      created_by: user?.id,
    }]);

    setSubmitting(false);
    if (payErr) {
      await supabase.from("pos_sales").delete().eq("id", saleRow.id);
      return toast.error("Error al registrar pago: " + payErr.message);
    }

    toast.success(`Venta rápida · ${totalAmount.toFixed(2)} ${selected.currency}`);
    clear();
    load();
  };

  if (profile && profile.role !== "admin" && profile.role !== "local") return null;

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> POS
            </h1>
            <p className="text-xs text-muted-foreground">
              {quickMode ? "Modo rápido · venta en 10 segundos" : "Ventas con pagos multi-divisa"}
            </p>
          </div>
          <Button
            size="sm"
            variant={quickMode ? "default" : "outline"}
            onClick={() => { setQuickMode((q) => !q); setPayments([]); }}
            className="gap-1.5 h-9"
          >
            <Zap className={cn("h-4 w-4", quickMode && "fill-current")} />
            {quickMode ? "Rápido" : "Detallado"}
          </Button>
        </div>

        {/* Quick Sale Mode */}
        {quickMode && selected && (
          <Card className="border-primary/40 bg-primary/5 animate-fade-in">
            <CardContent className="p-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Producto</p>
                  <p className="font-bold truncate">{selected.name}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={clear}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Big price display */}
              <div className="bg-card rounded-xl p-4 text-center">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Total a cobrar</p>
                <p
                  key={`qprice-${price}`}
                  className="text-4xl font-bold tabular-nums animate-flash origin-center"
                >
                  {(parseFloat(price) || 0).toFixed(2)}
                  <span className="text-sm text-muted-foreground ml-2">{saleCurrency}</span>
                </p>
              </div>

              {/* Quick add buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                {[10, 50, 100, 500].map((amt) => (
                  <Button
                    key={amt}
                    variant="outline"
                    className="h-10 text-xs font-bold active:scale-95 transition-transform"
                    onClick={() => setPrice(String(((parseFloat(price) || 0) + amt).toFixed(2)))}
                  >
                    +{amt}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[1000, 5000].map((amt) => (
                  <Button
                    key={amt}
                    variant="outline"
                    className="h-10 text-xs font-bold active:scale-95 transition-transform"
                    onClick={() => setPrice(String(((parseFloat(price) || 0) + amt).toFixed(2)))}
                  >
                    +{amt}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  className="h-10 text-xs font-bold text-destructive active:scale-95 transition-transform"
                  onClick={() => setPrice("")}
                >
                  Limpiar
                </Button>
              </div>

              {/* Numeric keypad */}
              <NumericKeypad value={price} onChange={setPrice} />

              {/* Payment method shortcuts */}
              <div>
                <Label className="text-xs">Método de pago</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Button
                    variant={quickMethod === "cash" ? "default" : "outline"}
                    className="h-12 gap-2 active:scale-95 transition-transform"
                    onClick={() => setQuickMethod("cash")}
                  >
                    <Banknote className="h-4 w-4" /> Efectivo
                  </Button>
                  <Button
                    variant={quickMethod === "transfer" ? "default" : "outline"}
                    className="h-12 gap-2 active:scale-95 transition-transform"
                    onClick={() => setQuickMethod("transfer")}
                  >
                    <Building2 className="h-4 w-4" /> Transferencia
                  </Button>
                </div>
              </div>

              {/* One-tap confirm */}
              <Button
                className="w-full h-14 gap-2 text-base font-bold active:scale-95 transition-transform"
                onClick={quickConfirm}
                disabled={submitting || !(parseFloat(price) > 0)}
              >
                <Check className="h-5 w-5" />
                {submitting ? "Procesando..." : `Cobrar ${(parseFloat(price) || 0).toFixed(2)} ${saleCurrency}`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Detailed sale form (multi-currency split payments) */}
        {!quickMode && selected && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Producto</p>
                  <p className="font-bold truncate">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Base: {selected.base_price.toFixed(2)} {selected.currency}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={clear}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Precio unidad</Label>
                  <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="h-11" />
                </div>
                <div>
                  <Label className="text-xs">Cantidad</Label>
                  <Input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-11" />
                </div>
              </div>

              <div>
                <Label className="text-xs">Agente de ventas</Label>
                <Input value={salesAgent} onChange={(e) => setSalesAgent(e.target.value)} placeholder="Nombre" className="h-11" />
              </div>

              <div>
                <Label className="text-xs">Notas</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11" />
              </div>

              {/* Totals summary with animated progress */}
              <div className="bg-card rounded-lg p-3 space-y-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Total</p>
                    <p className="text-sm font-bold tabular-nums">
                      {total.toFixed(2)} <span className="text-[10px] text-muted-foreground">{saleCurrency}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Pagado</p>
                    <p
                      key={`paid-${flashKey}`}
                      className="text-sm font-bold text-success tabular-nums origin-left animate-flash"
                    >
                      {paidInSaleCurrency.toFixed(2)} <span className="text-[10px] text-muted-foreground">{saleCurrency}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">
                      {overpaid ? "Sobrepago" : "Restante"}
                    </p>
                    <p
                      key={`rem-${flashKey}`}
                      className={cn(
                        "text-sm font-bold tabular-nums origin-left animate-flash",
                        overpaid ? "text-destructive" : remaining > 0 ? "text-warning" : "text-success",
                      )}
                    >
                      {(overpaid ? paidInSaleCurrency - total : remaining).toFixed(2)}
                      <span className="text-[10px] text-muted-foreground"> {saleCurrency}</span>
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300 ease-out",
                      overpaid ? "bg-destructive" : fullyPaid ? "bg-success" : "bg-primary",
                    )}
                    style={{ width: `${overpaid ? 100 : progressPct}%` }}
                  />
                </div>

                {saleCurrency !== "MXN" && total > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    ≈ {totalMXN.toFixed(2)} MXN · pagado {paidMXN.toFixed(2)} MXN
                  </p>
                )}
              </div>

              {/* Payments */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Pagos</Label>
                  <div className="flex gap-1">
                    {CURRENCIES.map((c) => (
                      <Button
                        key={c}
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-[11px] active:scale-95 transition-transform"
                        onClick={() => addPayment(c)}
                      >
                        <Plus className="h-3 w-3 mr-0.5" />
                        {c}
                      </Button>
                    ))}
                  </div>
                </div>

                {payments.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-2">
                    Agrega un pago en la divisa que prefieras
                  </p>
                )}

                {payments.map((p) => {
                  const matchingAccounts = accounts.filter((a) => a.currency === p.currency);
                  const amt = parseFloat(p.amount) || 0;
                  const eq = convert(amt, p.currency, saleCurrency, rates);
                  const isEmpty = !amt || amt <= 0;
                  return (
                    <div
                      key={p.key}
                      className={cn(
                        "rounded-lg border bg-card p-2.5 space-y-2 animate-slide-down origin-top",
                        isEmpty && "border-warning/60",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-muted">{p.currency}</span>
                        <Input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={p.amount}
                          onChange={(e) => updatePayment(p.key, { amount: e.target.value })}
                          className={cn("h-9 flex-1 tabular-nums", isEmpty && "border-warning/60")}
                          placeholder="0.00"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive active:scale-90 transition-transform"
                          onClick={() => removePayment(p.key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={p.payment_method}
                          onValueChange={(v: "cash" | "transfer") => updatePayment(p.key, { payment_method: v })}
                        >
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Efectivo</SelectItem>
                            <SelectItem value="transfer">Transferencia</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={p.account_id}
                          onValueChange={(v) => updatePayment(p.key, { account_id: v })}
                        >
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Cuenta" /></SelectTrigger>
                          <SelectContent>
                            {matchingAccounts.length === 0 && (
                              <SelectItem value="__none" disabled>Sin cuentas {p.currency}</SelectItem>
                            )}
                            {matchingAccounts.map((a) => (
                              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {p.currency !== saleCurrency && amt > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          ≈ {eq.toFixed(2)} {saleCurrency}
                        </p>
                      )}
                      {isEmpty && (
                        <p className="text-[10px] text-warning flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Ingresa un monto
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Inline validation banner */}
              {validationMessage && (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg p-2.5 text-xs font-medium animate-fade-in",
                    overpaid
                      ? "bg-destructive/10 text-destructive"
                      : "bg-warning/10 text-warning-foreground",
                  )}
                  style={{ color: overpaid ? undefined : "hsl(var(--warning))" }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{validationMessage}</span>
                </div>
              )}

              <Button
                className="w-full h-12 gap-2 transition-all"
                onClick={confirm}
                disabled={submitting || !!validationMessage}
              >
                <Check className="h-5 w-5" />
                {submitting ? "Procesando..." : fullyPaid ? "Confirmar venta" : "Completar pago"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Product picker */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="h-11 pl-10"
            />
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {products.length === 0
                  ? "Sin productos. Crea uno en Admin → Productos."
                  : "Sin resultados"}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((p) => {
                const active = selected?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => pickProduct(p)}
                    className={`text-left rounded-xl border p-3 transition ${
                      active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                    {p.category && <p className="text-[10px] text-muted-foreground truncate">{p.category}</p>}
                    <p className="text-sm font-bold mt-1">
                      {p.base_price.toFixed(2)} <span className="text-[10px] text-muted-foreground">{p.currency}</span>
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent sales */}
        {recent.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Ventas recientes
            </h2>
            <div className="space-y-1.5">
              {recent.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{s.product_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(s.sale_date).toLocaleString("es-MX", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                        {s.sales_agent ? ` · ${s.sales_agent}` : ""}
                      </p>
                    </div>
                    <span className="font-bold text-sm">
                      {Number(s.total_amount).toFixed(2)} {s.currency}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
