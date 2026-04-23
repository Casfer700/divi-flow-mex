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
import { Search, ShoppingCart, Check, Receipt, X, Plus, Trash2, AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  base_price: number;
  currency: string;
  category: string | null;
  is_invoice_tracked: boolean;
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
  status?: string;
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

interface Agent {
  id: string;
  name: string;
  default_commission_mxn: number;
}

interface AvailableInvoice {
  id: string;
  invoice_number: string;
  product_id: string;
}

const LS_AGENT = "pos_last_agent_id";
const LS_ACCOUNT = "pos_last_account_id";
const LS_COMM_CCY = "pos_last_commission_currency";

const CURRENCIES = ["MXN", "USD", "EUR", "CUP"];
const COMMISSION_CURRENCIES = ["USD", "MXN"];

// Convert any amount in `from` currency to `to` currency, via MXN.
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
  const [agents, setAgents] = useState<Agent[]>([]);
  const [availableInvoices, setAvailableInvoices] = useState<AvailableInvoice[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [salesAgentId, setSalesAgentId] = useState<string>(() => localStorage.getItem(LS_AGENT) || "");
  const [commission, setCommission] = useState("0");
  const [commissionCurrency, setCommissionCurrency] = useState<string>(
    () => localStorage.getItem(LS_COMM_CCY) || "USD",
  );
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [payments, setPayments] = useState<DraftPayment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile && profile.role !== "admin" && profile.role !== "local") {
      navigate("/");
    }
  }, [profile, navigate]);

  const load = async () => {
    const [{ data: prods }, { data: accs }, { data: sales }, { data: ex }, { data: stockRows }, { data: ags }, { data: invs }] = await Promise.all([
      supabase.from("products").select("id,name,base_price,currency,category,is_invoice_tracked").eq("is_active", true).order("name"),
      supabase.from("accounts").select("id,name,currency").eq("is_active", true).order("name"),
      supabase
        .from("pos_sales")
        .select("id,product_name,total_amount,currency,sales_agent,sale_date,status")
        .order("sale_date", { ascending: false })
        .limit(8),
      supabase.from("exchange_rates").select("currency,rate_type,sell_rate"),
      supabase.from("product_stock").select("product_id,stock"),
      supabase.from("sales_agents").select("id,name,default_commission_mxn").eq("is_active", true).order("name"),
      supabase.from("batch_invoices").select("id,invoice_number,product_id").eq("status", "available").order("created_at"),
    ]);
    setProducts((prods as Product[]) || []);
    setAccounts(accs || []);
    setRecent((sales as RecentSale[]) || []);
    setAgents((ags as Agent[]) || []);
    setAvailableInvoices((invs as AvailableInvoice[]) || []);
    const sm: Record<string, number> = {};
    (stockRows as { product_id: string; stock: number }[] | null)?.forEach((r) => {
      sm[r.product_id] = Number(r.stock);
    });
    setStockMap(sm);

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

  // Suggest agent's default commission when commission is empty/0
  useEffect(() => {
    if (!salesAgentId) return;
    const a = agents.find((x) => x.id === salesAgentId);
    if (a && (commission === "" || commission === "0")) {
      setCommission(String(a.default_commission_mxn || 0));
    }
    localStorage.setItem(LS_AGENT, salesAgentId);
  }, [salesAgentId, agents]);

  useEffect(() => {
    localStorage.setItem(LS_COMM_CCY, commissionCurrency);
  }, [commissionCurrency]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  // unit_price * quantity
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

  const [flashKey, setFlashKey] = useState(0);
  const lastPaidRef = useRef(paidInSaleCurrency);
  useEffect(() => {
    if (Math.abs(paidInSaleCurrency - lastPaidRef.current) > 0.001) {
      lastPaidRef.current = paidInSaleCurrency;
      setFlashKey((k) => k + 1);
    }
  }, [paidInSaleCurrency]);

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

  const pickProduct = (p: Product) => {
    setSelected(p);
    setPrice(String(p.base_price));
    setQuantity("1");
    setPayments([]);
    setSelectedInvoiceId("");
    setInvoiceSearch("");
  };

  const clear = () => {
    setSelected(null);
    setPrice("");
    setQuantity("1");
    setNotes("");
    setPayments([]);
    setSelectedInvoiceId("");
    setInvoiceSearch("");
  };

  const productInvoices = useMemo(
    () => availableInvoices.filter((i) => selected && i.product_id === selected.id),
    [availableInvoices, selected],
  );

  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    if (!q) return productInvoices;
    return productInvoices.filter((i) => i.invoice_number.toLowerCase().includes(q));
  }, [productInvoices, invoiceSearch]);

  const addPayment = (currency: string) => {
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
    if (!selected) return toast.error("Selecciona un producto");
    const unit = parseFloat(price);
    const qty = parseFloat(quantity);
    if (!unit || unit <= 0) return toast.error("Precio inválido");
    if (!qty || qty <= 0) return toast.error("Cantidad inválida");
    if (payments.length === 0) return toast.error("Agrega al menos un pago");
    if (!salesAgentId) return toast.error("Selecciona un agente de ventas");
    if (overpaid) return toast.error("El total pagado excede el total de la venta");
    if (!fullyPaid) return toast.error("La venta no está completamente pagada");
    if (selected.is_invoice_tracked && !selectedInvoiceId) {
      return toast.error("Selecciona una factura disponible");
    }

    for (const p of payments) {
      const a = parseFloat(p.amount);
      if (!a || a <= 0) return toast.error("Todos los pagos deben tener monto válido");
      if (p.payment_method === "transfer" && !p.account_id) {
        return toast.error("Las transferencias requieren cuenta");
      }
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const agentName = agents.find((a) => a.id === salesAgentId)?.name ?? null;

    // 1) Create the sale header — total = unit_price * quantity
    const { data: saleRow, error: saleErr } = await supabase
      .from("pos_sales")
      .insert({
        product_id: selected.id,
        product_name: selected.name,
        unit_price: unit,
        quantity: qty,
        total_amount: unit * qty,
        currency: selected.currency,
        payment_method: payments[0].payment_method,
        account_id: payments[0].account_id || null,
        sales_agent: agentName,
        sales_agent_id: salesAgentId,
        commission_mxn: parseFloat(commission) || 0,
        commission_currency: commissionCurrency,
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

    const paymentRows = payments.map((p) => {
      const amt = parseFloat(p.amount);
      const mxnEq = toMXN(amt, p.currency, rates);
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

    if (payErr) {
      await supabase.from("pos_sales").delete().eq("id", saleRow.id);
      setSubmitting(false);
      toast.error("Error al registrar pagos: " + payErr.message);
      return;
    }

    if (selected.is_invoice_tracked && selectedInvoiceId) {
      await supabase.from("batch_invoices")
        .update({ status: "sold", sale_id: saleRow.id })
        .eq("id", selectedInvoiceId);
    }

    if (payments[0].account_id) localStorage.setItem(LS_ACCOUNT, payments[0].account_id);

    setSubmitting(false);
    toast.success("Venta registrada");
    clear();
    load();
  };

  if (profile && profile.role !== "admin" && profile.role !== "local") return null;

  return (
    <Layout>
      <div className="space-y-5 animate-fade-in">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> POS
          </h1>
          <p className="text-sm text-muted-foreground">Ventas con pagos multi-divisa</p>
        </div>

        {/* Sale form */}
        {selected && (
          <Card className="rounded-xl border-primary/40 bg-primary/5 shadow-md">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs uppercase text-muted-foreground tracking-wide">Producto</p>
                  <p className="font-bold truncate text-base">{selected.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Base: {selected.base_price.toFixed(2)} {selected.currency} · Stock:{" "}
                    <span className={cn(
                      "font-bold tabular-nums",
                      (stockMap[selected.id] ?? 0) <= 0 ? "text-destructive" : "text-foreground",
                    )}>{(stockMap[selected.id] ?? 0).toFixed(0)}</span>
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="h-9 w-9 transition-all duration-200" onClick={clear}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {(stockMap[selected.id] ?? 0) < (parseFloat(quantity) || 1) && (
                <div className="flex items-start gap-2 rounded-lg p-3 text-sm bg-warning/10 animate-fade-in" style={{ color: "hsl(var(--warning))" }}>
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Stock insuficiente: hay <strong>{(stockMap[selected.id] ?? 0).toFixed(0)}</strong> disponibles. La venta procederá igualmente.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Precio unidad</Label>
                  <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="h-11 rounded-lg" />
                </div>
                <div>
                  <Label className="text-sm">Cantidad</Label>
                  <Input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-11 rounded-lg" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Agente *</Label>
                  <Select value={salesAgentId} onValueChange={setSalesAgentId}>
                    <SelectTrigger className="h-11 rounded-lg"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      {agents.length === 0 && <SelectItem value="__none" disabled>Sin agentes</SelectItem>}
                      {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Comisión</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={commission}
                      onChange={(e) => setCommission(e.target.value)}
                      className="h-11 rounded-lg flex-1"
                      placeholder="0.00"
                    />
                    <Select value={commissionCurrency} onValueChange={setCommissionCurrency}>
                      <SelectTrigger className="h-11 rounded-lg w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {COMMISSION_CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {selected.is_invoice_tracked && (
                <div className="space-y-2">
                  <Label className="text-sm">Factura disponible *</Label>
                  <Input value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)}
                    placeholder="Buscar # factura..." className="h-10 rounded-lg" />
                  {filteredInvoices.length === 0 ? (
                    <p className="text-sm text-warning">Sin facturas disponibles para este producto.</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1.5">
                      {filteredInvoices.map((inv) => (
                        <button key={inv.id} type="button"
                          onClick={() => setSelectedInvoiceId(inv.id)}
                          className={cn(
                            "w-full text-left rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200",
                            selectedInvoiceId === inv.id
                              ? "border-primary bg-primary/10 font-bold"
                              : "border-border bg-card hover:border-primary/40",
                          )}>
                          #{inv.invoice_number}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label className="text-sm">Notas</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11 rounded-lg" />
              </div>

              {/* Totals summary with progress — original currency only */}
              <div className="bg-card rounded-xl p-4 space-y-3 shadow-sm">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Total</p>
                    <p className="text-base font-bold tabular-nums">
                      {total.toFixed(2)} <span className="text-xs text-muted-foreground">{saleCurrency}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Pagado</p>
                    <p
                      key={`paid-${flashKey}`}
                      className="text-base font-bold text-success tabular-nums origin-left animate-flash"
                    >
                      {paidInSaleCurrency.toFixed(2)} <span className="text-xs text-muted-foreground">{saleCurrency}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">
                      {overpaid ? "Sobrepago" : "Restante"}
                    </p>
                    <p
                      key={`rem-${flashKey}`}
                      className={cn(
                        "text-base font-bold tabular-nums origin-left animate-flash",
                        overpaid ? "text-destructive" : remaining > 0 ? "text-warning" : "text-success",
                      )}
                    >
                      {(overpaid ? paidInSaleCurrency - total : remaining).toFixed(2)}
                      <span className="text-xs text-muted-foreground"> {saleCurrency}</span>
                    </p>
                  </div>
                </div>

                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300 ease-out",
                      overpaid ? "bg-destructive" : fullyPaid ? "bg-success" : "bg-primary",
                    )}
                    style={{ width: `${overpaid ? 100 : progressPct}%` }}
                  />
                </div>
              </div>

              {/* Payments */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Pagos</Label>
                  <div className="flex gap-1">
                    {CURRENCIES.map((c) => (
                      <Button
                        key={c}
                        size="sm"
                        variant="outline"
                        className="h-9 px-2 text-xs rounded-lg active:scale-95 transition-all duration-200"
                        onClick={() => addPayment(c)}
                      >
                        <Plus className="h-3 w-3 mr-0.5" />
                        {c}
                      </Button>
                    ))}
                  </div>
                </div>

                {payments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Agrega un pago en la divisa que prefieras
                  </p>
                )}

                {payments.map((p) => {
                  const matchingAccounts = accounts.filter((a) => a.currency === p.currency);
                  const amt = parseFloat(p.amount) || 0;
                  const isEmpty = !amt || amt <= 0;
                  return (
                    <div
                      key={p.key}
                      className={cn(
                        "rounded-lg border bg-card p-3 space-y-2 animate-slide-down origin-top transition-all duration-200",
                        isEmpty && "border-warning/60",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-1 rounded bg-muted">{p.currency}</span>
                        <Input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={p.amount}
                          onChange={(e) => updatePayment(p.key, { amount: e.target.value })}
                          className={cn("h-10 flex-1 tabular-nums rounded-lg", isEmpty && "border-warning/60")}
                          placeholder="0.00"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-destructive active:scale-90 transition-all duration-200"
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
                          <SelectTrigger className="h-10 text-sm rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Efectivo</SelectItem>
                            <SelectItem value="transfer">Transferencia</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={p.account_id}
                          onValueChange={(v) => updatePayment(p.key, { account_id: v })}
                        >
                          <SelectTrigger className="h-10 text-sm rounded-lg"><SelectValue placeholder="Cuenta" /></SelectTrigger>
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
                      {isEmpty && (
                        <p className="text-xs text-warning flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Ingresa un monto
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {validationMessage && (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg p-3 text-sm font-medium animate-fade-in",
                    overpaid
                      ? "bg-destructive/10 text-destructive"
                      : "bg-warning/10",
                  )}
                  style={{ color: overpaid ? undefined : "hsl(var(--warning))" }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{validationMessage}</span>
                </div>
              )}

              <Button
                className="w-full h-12 gap-2 rounded-lg bg-primary hover:bg-primary/90 transition-all duration-200"
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
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto..."
              className="h-11 pl-10 rounded-lg"
            />
          </div>

          {filtered.length === 0 ? (
            <Card className="rounded-xl shadow-md">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {products.length === 0
                  ? "Sin productos. Crea uno en Admin → Productos."
                  : "Sin resultados"}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 animate-fade-in">
              {filtered.map((p) => {
                const active = selected?.id === p.id;
                const stock = stockMap[p.id] ?? 0;
                const noStock = stock <= 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => pickProduct(p)}
                    className={cn(
                      "text-left rounded-xl border p-4 transition-all duration-200 shadow-sm hover:shadow-md min-h-[44px]",
                      active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-semibold text-sm truncate flex-1">{p.name}</p>
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded tabular-nums shrink-0",
                        noStock ? "bg-destructive/10 text-destructive" : stock < 5 ? "bg-warning/10" : "bg-success/10 text-success",
                      )} style={{ color: noStock ? undefined : stock < 5 ? "hsl(var(--warning))" : undefined }}>
                        {stock.toFixed(0)}
                      </span>
                    </div>
                    {p.category && <p className="text-xs text-muted-foreground truncate">{p.category}</p>}
                    <p className="text-base font-bold mt-1">
                      {p.base_price.toFixed(2)} <span className="text-xs text-muted-foreground">{p.currency}</span>
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent sales */}
        {recent.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Ventas recientes
            </h2>
            <div className="space-y-2 animate-fade-in">
              {recent.map((s) => {
                const cancelled = s.status === "cancelled";
                return (
                  <Card key={s.id} className="rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className={cn("text-sm font-semibold truncate", cancelled && "line-through text-muted-foreground")}>
                          {s.product_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.sale_date).toLocaleString("es-MX", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                          {s.sales_agent ? ` · ${s.sales_agent}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {cancelled && (
                          <span className="text-xs font-bold px-2 py-1 rounded-lg bg-destructive/10 text-destructive">
                            Cancelada
                          </span>
                        )}
                        <span className={cn("font-bold text-sm", cancelled && "line-through text-muted-foreground")}>
                          {Number(s.total_amount).toFixed(2)} {s.currency}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
