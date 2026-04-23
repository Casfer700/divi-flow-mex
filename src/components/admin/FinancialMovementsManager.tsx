import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, ArrowDownLeft, ArrowUpRight, Banknote, CreditCard, Filter } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Account {
  id: string;
  name: string;
  currency: string;
}

interface Movement {
  id: string;
  movement_type: "income" | "expense";
  source: string;
  currency: string;
  amount: number;
  payment_method: "cash" | "transfer";
  account_id: string | null;
  reference: string | null;
  reference_id: string | null;
  reference_type: string | null;
  movement_date: string;
  notes: string | null;
  accounts?: { name: string } | null;
}

const SOURCE_LABEL: Record<string, string> = {
  sale: "Venta",
  manual: "Manual",
  commission: "Comisión",
  purchase: "Compra",
  currency_exchange: "Cambio divisa",
};

interface Props {
  embedded?: boolean;
}

export function FinancialMovementsManager({ embedded = false }: Props) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [orderCustomers, setOrderCustomers] = useState<Record<string, string>>({});
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [form, setForm] = useState({
    movement_type: "income",
    source: "manual",
    currency: "MXN",
    amount: "",
    payment_method: "cash",
    account_id: "",
    reference: "",
    notes: "",
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [accRes, movRes] = await Promise.all([
      supabase.from("accounts").select("id, name, currency").eq("is_active", true).order("name"),
      supabase.from("financial_movements").select("*, accounts(name)").order("movement_date", { ascending: false }).limit(100),
    ]);
    if (accRes.error) toast.error("Error al cargar cuentas");
    if (movRes.error) toast.error("Error al cargar movimientos");
    setAccounts((accRes.data || []) as Account[]);
    const movs = (movRes.data || []) as Movement[];
    setMovements(movs);

    // Enrich: for movements linked to orders, fetch customer names
    const orderIds = Array.from(new Set(
      movs.filter((m) => m.reference_type === "order" && m.reference_id).map((m) => m.reference_id as string),
    ));
    if (orderIds.length > 0) {
      const { data: ords } = await supabase
        .from("orders")
        .select("id, customer:customers(name)")
        .in("id", orderIds);
      const map: Record<string, string> = {};
      (ords as any[] | null)?.forEach((o) => {
        if (o?.customer?.name) map[o.id] = o.customer.name;
      });
      setOrderCustomers(map);
    } else {
      setOrderCustomers({});
    }
  };

  const totals = useMemo(() => {
    const t = { income: { MXN: 0, USD: 0, EUR: 0, CUP: 0 }, expense: { MXN: 0, USD: 0, EUR: 0, CUP: 0 } };
    movements.forEach((m) => {
      const cur = m.currency as keyof typeof t.income;
      if (t[m.movement_type] && t[m.movement_type][cur] !== undefined) {
        t[m.movement_type][cur] += Number(m.amount);
      }
    });
    return t;
  }, [movements]);

  const filtered = filter === "all" ? movements : movements.filter((m) => m.movement_type === filter);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("financial_movements").insert([{
      movement_type: form.movement_type as "income" | "expense",
      source: form.source as any,
      currency: form.currency,
      amount: parseFloat(form.amount),
      payment_method: form.payment_method as "cash" | "transfer",
      account_id: form.account_id || null,
      reference: form.reference || null,
      notes: form.notes || null,
      created_by: user?.id,
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success("Movimiento registrado");
    setIsOpen(false);
    setForm({ movement_type: "income", source: "manual", currency: "MXN", amount: "", payment_method: "cash", account_id: "", reference: "", notes: "" });
    fetchAll();
  };

  const filteredAccounts = accounts.filter((a) => a.currency === form.currency);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {embedded ? "Movimientos financieros" : "Movimientos"}
        </h2>
        <Button size="sm" onClick={() => setIsOpen(true)} className="h-9 rounded-xl gap-1 text-xs font-semibold">
          <Plus className="h-3.5 w-3.5" />
          Movimiento
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gradient-to-br from-success to-success/80 rounded-2xl p-3 text-success-foreground shadow-fintech-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium opacity-90">Ingresos MXN</span>
            <ArrowDownLeft className="h-4 w-4 opacity-70" />
          </div>
          <p className="text-xl font-bold">${totals.income.MXN.toFixed(0)}</p>
          {(totals.income.USD > 0 || totals.income.EUR > 0 || totals.income.CUP > 0) && (
            <p className="text-[10px] opacity-80 mt-1">
              {totals.income.USD > 0 && `$${totals.income.USD.toFixed(0)} USD `}
              {totals.income.EUR > 0 && `€${totals.income.EUR.toFixed(0)} `}
              {totals.income.CUP > 0 && `${totals.income.CUP.toFixed(0)} CUP`}
            </p>
          )}
        </div>
        <div className="bg-gradient-to-br from-destructive to-destructive/80 rounded-2xl p-3 text-destructive-foreground shadow-fintech-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium opacity-90">Egresos MXN</span>
            <ArrowUpRight className="h-4 w-4 opacity-70" />
          </div>
          <p className="text-xl font-bold">${totals.expense.MXN.toFixed(0)}</p>
          {(totals.expense.USD > 0 || totals.expense.EUR > 0 || totals.expense.CUP > 0) && (
            <p className="text-[10px] opacity-80 mt-1">
              {totals.expense.USD > 0 && `$${totals.expense.USD.toFixed(0)} USD `}
              {totals.expense.EUR > 0 && `€${totals.expense.EUR.toFixed(0)} `}
              {totals.expense.CUP > 0 && `${totals.expense.CUP.toFixed(0)} CUP`}
            </p>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-muted rounded-xl p-1">
        {[
          { v: "all", l: "Todos" },
          { v: "income", l: "Ingresos" },
          { v: "expense", l: "Egresos" },
        ].map((opt) => (
          <button
            key={opt.v}
            onClick={() => setFilter(opt.v as any)}
            className={`flex-1 h-9 rounded-lg text-xs font-semibold transition ${
              filter === opt.v ? "bg-card shadow-fintech-sm text-foreground" : "text-muted-foreground"
            }`}
          >
            {opt.l}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-card rounded-2xl shadow-fintech-sm overflow-hidden">
        <div className="divide-y">
          {filtered.map((m) => {
            const isIncome = m.movement_type === "income";
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isIncome ? "bg-success/10" : "bg-destructive/10"
                }`}>
                  {isIncome
                    ? <ArrowDownLeft className="h-4 w-4 text-success" />
                    : <ArrowUpRight className="h-4 w-4 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {SOURCE_LABEL[m.source] || m.source}
                    {m.reference && <span className="text-muted-foreground font-normal"> · {m.reference}</span>}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {m.payment_method === "cash"
                      ? <Banknote className="h-3 w-3" />
                      : <CreditCard className="h-3 w-3" />}
                    <span>{m.accounts?.name || "Sin cuenta"}</span>
                    <span>·</span>
                    <span>{new Date(m.movement_date).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${isIncome ? "text-success" : "text-destructive"}`}>
                    {isIncome ? "+" : "-"}{Number(m.amount).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{m.currency}</p>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">Sin movimientos</div>
          )}
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Nuevo movimiento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm({ ...form, movement_type: "income" })}
                className={`h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition ${
                  form.movement_type === "income"
                    ? "bg-success text-success-foreground shadow-fintech-sm"
                    : "bg-muted text-muted-foreground"
                }`}>
                <ArrowDownLeft className="h-4 w-4" />
                Ingreso
              </button>
              <button type="button" onClick={() => setForm({ ...form, movement_type: "expense" })}
                className={`h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition ${
                  form.movement_type === "expense"
                    ? "bg-destructive text-destructive-foreground shadow-fintech-sm"
                    : "bg-muted text-muted-foreground"
                }`}>
                <ArrowUpRight className="h-4 w-4" />
                Egreso
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Origen</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="sale">Venta</SelectItem>
                    <SelectItem value="commission">Comisión</SelectItem>
                    <SelectItem value="purchase">Compra</SelectItem>
                    <SelectItem value="currency_exchange">Cambio divisa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Divisa</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v, account_id: "" })}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="MXN">MXN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="CUP">CUP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monto</Label>
              <Input type="number" step="0.01" min="0" required value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="h-14 rounded-xl text-center text-2xl font-bold" placeholder="0.00" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Método</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cuenta</Label>
                <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {filteredAccounts.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Sin cuentas en {form.currency}</div>
                    )}
                    {filteredAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Referencia</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="Ej. Folio, cliente..." className="h-12 rounded-xl" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Detalles..." className="rounded-xl" />
            </div>

            <Button type="submit" className="w-full h-12 rounded-xl font-semibold">Registrar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
