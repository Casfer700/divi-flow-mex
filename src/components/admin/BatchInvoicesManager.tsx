import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Plus, Trash2, CheckCircle2, Circle, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface Batch { id: string; product_id: string; quantity: number; supplier_invoice: string | null; purchase_date: string; }
interface Product { id: string; name: string; is_invoice_tracked: boolean; }
interface Account { id: string; name: string; currency: string; }
interface Invoice {
  id: string;
  batch_id: string;
  product_id: string;
  invoice_number: string;
  cost_usd: number;
  cost_mxn: number;
  payment_method: "cash" | "transfer";
  payment_currency: string;
  payment_amount: number;
  account_id: string | null;
  payment_date: string;
  status: "available" | "sold";
  sale_id: string | null;
}

const CURRENCIES = ["MXN", "USD", "EUR", "CUP"];

export function BatchInvoicesManager() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "sold">("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    batch_id: "",
    invoice_number: "",
    cost_usd: "",
    cost_mxn: "",
    payment_method: "cash" as "cash" | "transfer",
    payment_currency: "MXN",
    payment_amount: "",
    account_id: "",
    payment_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const load = async () => {
    const [{ data: b }, { data: p }, { data: a }, { data: inv }] = await Promise.all([
      supabase.from("product_batches").select("id,product_id,quantity,supplier_invoice,purchase_date").order("purchase_date", { ascending: false }),
      supabase.from("products").select("id,name,is_invoice_tracked").order("name"),
      supabase.from("accounts").select("id,name,currency").eq("is_active", true).order("name"),
      supabase.from("batch_invoices").select("*").order("created_at", { ascending: false }),
    ]);
    setBatches((b as Batch[]) || []);
    setProducts((p as Product[]) || []);
    setAccounts((a as Account[]) || []);
    setInvoices((inv as Invoice[]) || []);
  };
  useEffect(() => { load(); }, []);

  const productById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const batchById = useMemo(() => Object.fromEntries(batches.map((b) => [b.id, b])), [batches]);

  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (batchFilter !== "all" && i.batch_id !== batchFilter) return false;
      return true;
    });
  }, [invoices, statusFilter, batchFilter]);

  const totals = useMemo(() => {
    return invoices.reduce(
      (acc, i) => {
        acc.usd += Number(i.cost_usd);
        acc.mxn += Number(i.cost_mxn);
        return acc;
      },
      { usd: 0, mxn: 0 },
    );
  }, [invoices]);

  const reset = () => setForm({
    batch_id: "", invoice_number: "", cost_usd: "", cost_mxn: "",
    payment_method: "cash", payment_currency: "MXN", payment_amount: "",
    account_id: "", payment_date: new Date().toISOString().slice(0, 10), notes: "",
  });

  const submit = async () => {
    if (!form.batch_id) return toast.error("Selecciona un lote");
    if (!form.invoice_number.trim()) return toast.error("Número de factura requerido");
    if (form.payment_method === "transfer" && !form.account_id) {
      return toast.error("Cuenta requerida para transferencias");
    }
    const batch = batchById[form.batch_id];
    if (!batch) return toast.error("Lote inválido");

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("batch_invoices").insert({
      batch_id: form.batch_id,
      product_id: batch.product_id,
      invoice_number: form.invoice_number.trim(),
      cost_usd: parseFloat(form.cost_usd) || 0,
      cost_mxn: parseFloat(form.cost_mxn) || 0,
      payment_method: form.payment_method,
      payment_currency: form.payment_currency,
      payment_amount: parseFloat(form.payment_amount) || 0,
      account_id: form.account_id || null,
      payment_date: form.payment_date,
      notes: form.notes.trim() || null,
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Factura agregada");
    setOpen(false); reset(); load();
  };

  const remove = async (id: string, status: string) => {
    if (status === "sold") return toast.error("No se puede eliminar una factura ya vendida");
    if (!confirm("¿Eliminar factura? Se revertirán los movimientos asociados.")) return;
    const { error } = await supabase.from("batch_invoices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Factura eliminada"); load();
  };

  const filteredAccounts = accounts.filter((a) => a.currency === form.payment_currency);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Facturas por lote
          </CardTitle>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Nueva</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Nueva factura</DialogTitle></DialogHeader>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                <div>
                  <Label>Lote *</Label>
                  <Select value={form.batch_id} onValueChange={(v) => setForm({ ...form, batch_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona lote" /></SelectTrigger>
                    <SelectContent className="bg-popover">
                      {batches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {productById[b.product_id]?.name ?? "—"} · {new Date(b.purchase_date).toLocaleDateString("es-MX")}
                          {b.supplier_invoice ? ` · ${b.supplier_invoice}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Número de factura *</Label>
                  <Input value={form.invoice_number}
                    onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                    placeholder="F-001" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Costo USD</Label>
                    <Input type="number" step="0.01" value={form.cost_usd}
                      onChange={(e) => setForm({ ...form, cost_usd: e.target.value })} />
                  </div>
                  <div>
                    <Label>Costo MXN</Label>
                    <Input type="number" step="0.01" value={form.cost_mxn}
                      onChange={(e) => setForm({ ...form, cost_mxn: e.target.value })} />
                  </div>
                </div>

                <div className="border-t pt-3 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Pago de la factura</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Método</Label>
                      <Select value={form.payment_method} onValueChange={(v: "cash" | "transfer") => setForm({ ...form, payment_method: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="cash">Efectivo</SelectItem>
                          <SelectItem value="transfer">Transferencia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Divisa</Label>
                      <Select value={form.payment_currency} onValueChange={(v) => setForm({ ...form, payment_currency: v, account_id: "" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Monto</Label>
                      <Input type="number" step="0.01" value={form.payment_amount}
                        onChange={(e) => setForm({ ...form, payment_amount: e.target.value })} />
                    </div>
                    <div>
                      <Label>Fecha</Label>
                      <Input type="date" value={form.payment_date}
                        onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Cuenta {form.payment_method === "transfer" && <span className="text-destructive">*</span>}</Label>
                    <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Cuenta" /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        {filteredAccounts.length === 0 && (
                          <SelectItem value="__none" disabled>Sin cuentas {form.payment_currency}</SelectItem>
                        )}
                        {filteredAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Notas</Label>
                    <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={submit}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Totals */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-[10px] uppercase text-muted-foreground">Facturas</p>
            <p className="text-base font-bold">{invoices.length}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-[10px] uppercase text-muted-foreground">Total USD</p>
            <p className="text-base font-bold tabular-nums">${totals.usd.toFixed(2)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-[10px] uppercase text-muted-foreground">Total MXN</p>
            <p className="text-base font-bold tabular-nums">${totals.mxn.toFixed(2)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 items-center">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="h-9 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="available">Disponibles</SelectItem>
              <SelectItem value="sold">Vendidas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={batchFilter} onValueChange={setBatchFilter}>
            <SelectTrigger className="h-9 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todos los lotes</SelectItem>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {productById[b.product_id]?.name ?? "—"} · {new Date(b.purchase_date).toLocaleDateString("es-MX")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Sin facturas.</p>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((i) => (
              <div key={i.id} className={cn(
                "rounded-lg border p-2.5 bg-card flex items-start justify-between gap-2",
                i.status === "sold" && "opacity-70",
              )}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {i.status === "sold"
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      : <Circle className="h-3.5 w-3.5 text-primary shrink-0" />}
                    <p className="font-semibold text-sm truncate">
                      {productById[i.product_id]?.name ?? "—"} · #{i.invoice_number}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(i.payment_date).toLocaleDateString("es-MX")} ·
                    {" "}USD {Number(i.cost_usd).toFixed(2)} · MXN {Number(i.cost_mxn).toFixed(2)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Pago: {Number(i.payment_amount).toFixed(2)} {i.payment_currency} ({i.payment_method === "cash" ? "efectivo" : "transf."})
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0"
                  disabled={i.status === "sold"}
                  onClick={() => remove(i.id, i.status)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
