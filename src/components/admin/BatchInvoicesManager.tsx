import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText, Plus, Trash2, CheckCircle2, Circle, Filter, Edit3, Layers } from "lucide-react";
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
  due_date: string | null;
  status: string;
  notes: string | null;
  sale_id: string | null;
}

const CURRENCIES = ["MXN", "USD", "EUR", "CUP"];

export function BatchInvoicesManager() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "sold" | "cancelled">("all");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const [bulkForm, setBulkForm] = useState({
    status: "" as "" | "available" | "sold" | "cancelled",
    due_date: "",
    notes: "",
  });

  const [genForm, setGenForm] = useState({
    mode: "manual" as "manual" | "auto",
    batch_id: "",
    invoice_list: "",
    prefix: "F-",
    start: 1,
    count: 1,
    cost_usd: "",
    cost_mxn: "",
    payment_method: "cash" as "cash" | "transfer",
    payment_currency: "MXN",
    payment_amount: "",
    account_id: "",
    payment_date: new Date().toISOString().slice(0, 10),
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
    setSelected(new Set());
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
        if (i.status === "cancelled") return acc;
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

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((i) => i.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const applyBulk = async () => {
    if (selected.size === 0) return toast.error("Sin facturas seleccionadas");
    const patch: Record<string, unknown> = {};
    if (bulkForm.status) patch.status = bulkForm.status;
    if (bulkForm.due_date) patch.due_date = bulkForm.due_date;
    if (bulkForm.notes) patch.notes = bulkForm.notes;
    if (Object.keys(patch).length === 0) return toast.error("Define al menos un campo");

    const ids = Array.from(selected);
    const { error } = await supabase.from("batch_invoices").update(patch).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} factura(s) actualizadas`);
    setBulkOpen(false);
    setBulkForm({ status: "", due_date: "", notes: "" });
    load();
  };

  const generateBatch = async () => {
    if (!genForm.batch_id) return toast.error("Selecciona un lote");
    const batch = batchById[genForm.batch_id];
    if (!batch) return toast.error("Lote inválido");

    let numbers: string[] = [];
    if (genForm.mode === "manual") {
      numbers = genForm.invoice_list
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      const count = Math.max(1, Math.floor(genForm.count));
      const start = Math.max(0, Math.floor(genForm.start));
      for (let i = 0; i < count; i++) {
        numbers.push(`${genForm.prefix}${String(start + i).padStart(3, "0")}`);
      }
    }
    if (numbers.length === 0) return toast.error("Sin números de factura");
    if (genForm.payment_method === "transfer" && !genForm.account_id) {
      return toast.error("Cuenta requerida para transferencias");
    }

    const { data: { user } } = await supabase.auth.getUser();
    const rows = numbers.map((n) => ({
      batch_id: genForm.batch_id,
      product_id: batch.product_id,
      invoice_number: n,
      cost_usd: parseFloat(genForm.cost_usd) || 0,
      cost_mxn: parseFloat(genForm.cost_mxn) || 0,
      payment_method: genForm.payment_method,
      payment_currency: genForm.payment_currency,
      payment_amount: parseFloat(genForm.payment_amount) || 0,
      account_id: genForm.account_id || null,
      payment_date: genForm.payment_date,
      created_by: user?.id,
    }));

    const { error } = await supabase.from("batch_invoices").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} factura(s) creada(s)`);
    setGenOpen(false);
    load();
  };

  const filteredAccounts = accounts.filter((a) => a.currency === form.payment_currency);
  const genFilteredAccounts = accounts.filter((a) => a.currency === genForm.payment_currency);

  return (
    <Card className="rounded-xl shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Facturas por lote
          </CardTitle>
          <div className="flex gap-2">
            <Dialog open={genOpen} onOpenChange={setGenOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 rounded-lg h-9">
                  <Layers className="h-4 w-4" /> Generar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Generar facturas en lote</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-1 bg-muted rounded-lg p-1">
                    <button
                      onClick={() => setGenForm({ ...genForm, mode: "manual" })}
                      className={cn(
                        "h-9 rounded-md text-sm font-semibold transition-all",
                        genForm.mode === "manual" ? "bg-card shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      Lista manual
                    </button>
                    <button
                      onClick={() => setGenForm({ ...genForm, mode: "auto" })}
                      className={cn(
                        "h-9 rounded-md text-sm font-semibold transition-all",
                        genForm.mode === "auto" ? "bg-card shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      Auto-numeradas
                    </button>
                  </div>

                  <div>
                    <Label>Lote *</Label>
                    <Select value={genForm.batch_id} onValueChange={(v) => setGenForm({ ...genForm, batch_id: v })}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecciona lote" /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        {batches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {productById[b.product_id]?.name ?? "—"} · {new Date(b.purchase_date).toLocaleDateString("es-MX")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {genForm.mode === "manual" ? (
                    <div>
                      <Label>Números de factura (uno por línea o coma)</Label>
                      <Textarea
                        rows={4}
                        placeholder="F-001&#10;F-002&#10;F-003"
                        value={genForm.invoice_list}
                        onChange={(e) => setGenForm({ ...genForm, invoice_list: e.target.value })}
                        className="rounded-lg font-mono text-sm"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>Prefijo</Label>
                        <Input value={genForm.prefix} onChange={(e) => setGenForm({ ...genForm, prefix: e.target.value })} className="rounded-lg" />
                      </div>
                      <div>
                        <Label>Inicio</Label>
                        <Input type="number" value={genForm.start} onChange={(e) => setGenForm({ ...genForm, start: parseInt(e.target.value) || 1 })} className="rounded-lg" />
                      </div>
                      <div>
                        <Label>Cantidad</Label>
                        <Input type="number" value={genForm.count} onChange={(e) => setGenForm({ ...genForm, count: parseInt(e.target.value) || 1 })} className="rounded-lg" />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Costo USD c/u</Label>
                      <Input type="number" step="0.01" value={genForm.cost_usd}
                        onChange={(e) => setGenForm({ ...genForm, cost_usd: e.target.value })} className="rounded-lg" />
                    </div>
                    <div>
                      <Label>Costo MXN c/u</Label>
                      <Input type="number" step="0.01" value={genForm.cost_mxn}
                        onChange={(e) => setGenForm({ ...genForm, cost_mxn: e.target.value })} className="rounded-lg" />
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground uppercase">Pago por factura</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={genForm.payment_method} onValueChange={(v: "cash" | "transfer") => setGenForm({ ...genForm, payment_method: v })}>
                        <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          <SelectItem value="cash">Efectivo</SelectItem>
                          <SelectItem value="transfer">Transferencia</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={genForm.payment_currency} onValueChange={(v) => setGenForm({ ...genForm, payment_currency: v, account_id: "" })}>
                        <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Monto c/u</Label>
                        <Input type="number" step="0.01" value={genForm.payment_amount}
                          onChange={(e) => setGenForm({ ...genForm, payment_amount: e.target.value })} className="rounded-lg" />
                      </div>
                      <div>
                        <Label>Fecha</Label>
                        <Input type="date" value={genForm.payment_date}
                          onChange={(e) => setGenForm({ ...genForm, payment_date: e.target.value })} className="rounded-lg" />
                      </div>
                    </div>
                    <div>
                      <Label>Cuenta</Label>
                      <Select value={genForm.account_id} onValueChange={(v) => setGenForm({ ...genForm, account_id: v })}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Cuenta" /></SelectTrigger>
                        <SelectContent className="bg-popover">
                          {genFilteredAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setGenOpen(false)}>Cancelar</Button>
                  <Button onClick={generateBatch} className="bg-primary">Generar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 rounded-lg h-9 bg-primary"><Plus className="h-4 w-4" /> Nueva</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Nueva factura</DialogTitle></DialogHeader>
                <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                  <div>
                    <Label>Lote *</Label>
                    <Select value={form.batch_id} onValueChange={(v) => setForm({ ...form, batch_id: v })}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="Selecciona lote" /></SelectTrigger>
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
                      placeholder="F-001" className="rounded-lg" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Costo USD</Label>
                      <Input type="number" step="0.01" value={form.cost_usd}
                        onChange={(e) => setForm({ ...form, cost_usd: e.target.value })} className="rounded-lg" />
                    </div>
                    <div>
                      <Label>Costo MXN</Label>
                      <Input type="number" step="0.01" value={form.cost_mxn}
                        onChange={(e) => setForm({ ...form, cost_mxn: e.target.value })} className="rounded-lg" />
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-3">
                    <p className="text-sm font-semibold text-muted-foreground uppercase">Pago de la factura</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Método</Label>
                        <Select value={form.payment_method} onValueChange={(v: "cash" | "transfer") => setForm({ ...form, payment_method: v })}>
                          <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-popover">
                            <SelectItem value="cash">Efectivo</SelectItem>
                            <SelectItem value="transfer">Transferencia</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Divisa</Label>
                        <Select value={form.payment_currency} onValueChange={(v) => setForm({ ...form, payment_currency: v, account_id: "" })}>
                          <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
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
                          onChange={(e) => setForm({ ...form, payment_amount: e.target.value })} className="rounded-lg" />
                      </div>
                      <div>
                        <Label>Fecha</Label>
                        <Input type="date" value={form.payment_date}
                          onChange={(e) => setForm({ ...form, payment_date: e.target.value })} className="rounded-lg" />
                      </div>
                    </div>
                    <div>
                      <Label>Cuenta {form.payment_method === "transfer" && <span className="text-destructive">*</span>}</Label>
                      <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Cuenta" /></SelectTrigger>
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
                      <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-lg" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={submit} className="bg-primary">Guardar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Totals */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs uppercase text-muted-foreground">Facturas</p>
            <p className="text-base font-bold">{invoices.length}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs uppercase text-muted-foreground">Total USD</p>
            <p className="text-base font-bold tabular-nums">${totals.usd.toFixed(2)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs uppercase text-muted-foreground">Total MXN</p>
            <p className="text-base font-bold tabular-nums">${totals.mxn.toFixed(2)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 items-center">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="h-9 text-sm flex-1 rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="available">Disponibles</SelectItem>
              <SelectItem value="sold">Vendidas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={batchFilter} onValueChange={setBatchFilter}>
            <SelectTrigger className="h-9 text-sm flex-1 rounded-lg"><SelectValue /></SelectTrigger>
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

        {/* Bulk action bar */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-2 px-2">
            <Checkbox
              checked={selected.size > 0 && selected.size === filtered.length}
              onCheckedChange={toggleAll}
              aria-label="Seleccionar todo"
            />
            <span className="text-sm text-muted-foreground flex-1">
              {selected.size > 0 ? `${selected.size} seleccionada(s)` : "Seleccionar todo"}
            </span>
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg h-9 gap-1"
                  disabled={selected.size === 0}
                >
                  <Edit3 className="h-3.5 w-3.5" /> Editar selección
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Editar {selected.size} factura(s)</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Estado</Label>
                    <Select value={bulkForm.status} onValueChange={(v: any) => setBulkForm({ ...bulkForm, status: v })}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="Sin cambio" /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="available">Disponible</SelectItem>
                        <SelectItem value="sold">Vendida</SelectItem>
                        <SelectItem value="cancelled">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fecha de vencimiento</Label>
                    <Input
                      type="date"
                      value={bulkForm.due_date}
                      onChange={(e) => setBulkForm({ ...bulkForm, due_date: e.target.value })}
                      className="rounded-lg"
                    />
                  </div>
                  <div>
                    <Label>Notas</Label>
                    <Textarea
                      rows={2}
                      value={bulkForm.notes}
                      onChange={(e) => setBulkForm({ ...bulkForm, notes: e.target.value })}
                      className="rounded-lg"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancelar</Button>
                  <Button onClick={applyBulk} className="bg-primary">Aplicar a selección</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin facturas.</p>
        ) : (
          <div className="space-y-2 animate-fade-in">
            {filtered.map((i) => {
              const isSel = selected.has(i.id);
              const cancelled = i.status === "cancelled";
              return (
                <div key={i.id} className={cn(
                  "rounded-xl border p-3 bg-card flex items-start gap-2 shadow-sm transition-all duration-200",
                  isSel && "border-primary/50 bg-primary/5",
                  i.status === "sold" && !isSel && "opacity-70",
                  cancelled && "opacity-60",
                )}>
                  <Checkbox
                    checked={isSel}
                    onCheckedChange={() => toggleOne(i.id)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {cancelled
                        ? <Trash2 className="h-3.5 w-3.5 text-destructive shrink-0" />
                        : i.status === "sold"
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                          : <Circle className="h-3.5 w-3.5 text-primary shrink-0" />}
                      <p className={cn("font-semibold text-sm truncate", cancelled && "line-through")}>
                        {productById[i.product_id]?.name ?? "—"} · #{i.invoice_number}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(i.payment_date).toLocaleDateString("es-MX")} ·
                      {" "}USD {Number(i.cost_usd).toFixed(2)} · MXN {Number(i.cost_mxn).toFixed(2)}
                      {i.due_date ? ` · vence ${new Date(i.due_date).toLocaleDateString("es-MX")}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pago: {Number(i.payment_amount).toFixed(2)} {i.payment_currency} ({i.payment_method === "cash" ? "efectivo" : "transf."})
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive shrink-0 transition-all duration-200"
                    disabled={i.status === "sold"}
                    onClick={() => remove(i.id, i.status)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
