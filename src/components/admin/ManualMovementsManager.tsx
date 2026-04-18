import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, ArrowDownLeft, ArrowUpRight, Banknote, CreditCard, CalendarIcon, Tag, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { z } from "zod";

const manualMovementSchema = z.object({
  movement_type: z.enum(["income", "expense"]),
  amount: z.number().positive({ message: "El monto debe ser mayor a 0" }).max(99999999, { message: "Monto demasiado grande" }),
  currency: z.enum(["MXN", "USD", "EUR", "CUP"]),
  payment_method: z.enum(["cash", "transfer"]),
  account_id: z.string().uuid({ message: "Selecciona una cuenta" }).nullable(),
  category: z.string().trim().max(50, { message: "Máximo 50 caracteres" }).optional(),
  notes: z.string().trim().max(500, { message: "Máximo 500 caracteres" }).optional(),
  movement_date: z.date(),
});

interface Account {
  id: string;
  name: string;
  currency: string;
}

interface Movement {
  id: string;
  movement_type: "income" | "expense";
  currency: string;
  amount: number;
  payment_method: "cash" | "transfer";
  account_id: string | null;
  category: string | null;
  notes: string | null;
  movement_date: string;
  accounts?: { name: string } | null;
}

const PRESET_CATEGORIES = {
  income: ["Comisión", "Préstamo", "Otro ingreso"],
  expense: ["Gasolina", "Renta", "Sueldos", "Comida", "Servicios", "Compras", "Otro gasto"],
};

interface Props {
  embedded?: boolean;
}

export function ManualMovementsManager({ embedded = false }: Props) {
  const { user, profile } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    movement_type: "expense" as "income" | "expense",
    amount: "",
    currency: "MXN",
    payment_method: "cash" as "cash" | "transfer",
    account_id: "",
    category: "",
    notes: "",
    movement_date: new Date(),
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [accRes, movRes] = await Promise.all([
      supabase.from("accounts").select("id, name, currency").eq("is_active", true).order("name"),
      supabase
        .from("financial_movements")
        .select("*, accounts(name)")
        .eq("source", "manual")
        .order("movement_date", { ascending: false })
        .limit(100),
    ]);
    if (accRes.error) toast.error("Error al cargar cuentas");
    if (movRes.error) toast.error("Error al cargar movimientos");
    setAccounts((accRes.data || []) as Account[]);
    setMovements((movRes.data || []) as any);
  };

  const totals = useMemo(() => {
    const t = { income: 0, expense: 0 };
    movements.forEach((m) => {
      if (m.currency === "MXN") t[m.movement_type] += Number(m.amount);
    });
    return t;
  }, [movements]);

  const filtered = filter === "all" ? movements : movements.filter((m) => m.movement_type === filter);
  const filteredAccounts = accounts.filter((a) => a.currency === form.currency);

  const resetForm = () => {
    setForm({
      movement_type: "expense",
      amount: "",
      currency: "MXN",
      payment_method: "cash",
      account_id: "",
      category: "",
      notes: "",
      movement_date: new Date(),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const parsed = manualMovementSchema.safeParse({
      movement_type: form.movement_type,
      amount: parseFloat(form.amount),
      currency: form.currency,
      payment_method: form.payment_method,
      account_id: form.account_id || null,
      category: form.category || undefined,
      notes: form.notes || undefined,
      movement_date: form.movement_date,
    });

    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      setSubmitting(false);
      return;
    }

    const data = parsed.data;
    const { error } = await supabase.from("financial_movements").insert([{
      movement_type: data.movement_type,
      source: "manual",
      currency: data.currency,
      amount: data.amount,
      payment_method: data.payment_method,
      account_id: data.account_id,
      category: data.category || null,
      notes: data.notes || null,
      movement_date: data.movement_date.toISOString(),
      created_by: user?.id,
    }]);

    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }
    toast.success("Movimiento registrado");
    setIsOpen(false);
    resetForm();
    setSubmitting(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este movimiento?")) return;
    const { error } = await supabase.from("financial_movements").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Movimiento eliminado");
    fetchAll();
  };

  const isAdmin = profile?.role === "admin";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {embedded ? "Movimientos manuales" : "Manuales"}
        </h2>
        <Button size="sm" onClick={() => setIsOpen(true)} className="h-9 rounded-xl gap-1 text-xs font-semibold">
          <Plus className="h-3.5 w-3.5" />
          Nuevo
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gradient-to-br from-success to-success/80 rounded-2xl p-3 text-success-foreground shadow-fintech-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium opacity-90">Ingresos MXN</span>
            <ArrowDownLeft className="h-4 w-4 opacity-70" />
          </div>
          <p className="text-xl font-bold">${totals.income.toFixed(0)}</p>
        </div>
        <div className="bg-gradient-to-br from-destructive to-destructive/80 rounded-2xl p-3 text-destructive-foreground shadow-fintech-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium opacity-90">Egresos MXN</span>
            <ArrowUpRight className="h-4 w-4 opacity-70" />
          </div>
          <p className="text-xl font-bold">${totals.expense.toFixed(0)}</p>
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
                    {m.category || (isIncome ? "Ingreso manual" : "Gasto manual")}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {m.payment_method === "cash"
                      ? <Banknote className="h-3 w-3" />
                      : <CreditCard className="h-3 w-3" />}
                    <span>{m.accounts?.name || "Sin cuenta"}</span>
                    <span>·</span>
                    <span>{format(new Date(m.movement_date), "d MMM", { locale: es })}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${isIncome ? "text-success" : "text-destructive"}`}>
                    {isIncome ? "+" : "-"}{Number(m.amount).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{m.currency}</p>
                </div>
                {isAdmin && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive flex-shrink-0"
                    onClick={() => handleDelete(m.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">Sin movimientos manuales</div>
          )}
        </div>
      </div>

      {/* Form dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Nuevo movimiento manual</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type */}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm({ ...form, movement_type: "income", category: "" })}
                className={`h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition ${
                  form.movement_type === "income"
                    ? "bg-success text-success-foreground shadow-fintech-sm"
                    : "bg-muted text-muted-foreground"
                }`}>
                <ArrowDownLeft className="h-4 w-4" />
                Ingreso
              </button>
              <button type="button" onClick={() => setForm({ ...form, movement_type: "expense", category: "" })}
                className={`h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition ${
                  form.movement_type === "expense"
                    ? "bg-destructive text-destructive-foreground shadow-fintech-sm"
                    : "bg-muted text-muted-foreground"
                }`}>
                <ArrowUpRight className="h-4 w-4" />
                Egreso
              </button>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monto</Label>
              <Input type="number" step="0.01" min="0.01" required value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="h-14 rounded-xl text-center text-2xl font-bold" placeholder="0.00" />
            </div>

            {/* Currency + Method */}
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Método</Label>
                <Select value={form.payment_method} onValueChange={(v: "cash" | "transfer") => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Account */}
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

            {/* Category */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoría</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PRESET_CATEGORIES[form.movement_type].map((cat) => (
                  <button key={cat} type="button"
                    onClick={() => setForm({ ...form, category: cat })}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      form.category === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/50"
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={form.category} maxLength={50}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Categoría personalizada" className="h-12 rounded-xl pl-10" />
              </div>
            </div>

            {/* Date */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline"
                    className={cn("w-full h-12 rounded-xl justify-start text-left font-normal",
                      !form.movement_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.movement_date
                      ? format(form.movement_date, "PPP", { locale: es })
                      : "Seleccionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <Calendar mode="single" selected={form.movement_date}
                    onSelect={(d) => d && setForm({ ...form, movement_date: d })}
                    initialFocus locale={es}
                    className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notas</Label>
              <Textarea value={form.notes} maxLength={500}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Detalles..." className="rounded-xl" />
            </div>

            <Button type="submit" disabled={submitting} className="w-full h-12 rounded-xl font-semibold">
              {submitting ? "Registrando..." : "Registrar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
