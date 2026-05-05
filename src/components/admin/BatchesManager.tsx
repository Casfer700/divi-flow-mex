import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Layers, Plus, Trash2, Package2, AlertTriangle, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Product { id: string; name: string; }
interface Batch {
  id: string;
  product_id: string;
  quantity: number;
  remaining_quantity: number;
  cost_usd: number;
  cost_mxn: number;
  commission_usd: number;
  commission_mxn: number;
  supplier_invoice: string | null;
  purchase_date: string;
  notes: string | null;
  created_at: string;
}
interface StockRow {
  product_id: string;
  product_name: string;
  stock: number;
  avg_cost_usd: number;
  avg_cost_mxn: number;
}

export function BatchesManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCommission, setShowCommission] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);

  // form
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costUsd, setCostUsd] = useState("");
  const [costMxn, setCostMxn] = useState("");
  const [commissionUsd, setCommissionUsd] = useState("");
  const [commissionMxn, setCommissionMxn] = useState("");
  const [invoice, setInvoice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const load = async () => {
    const [{ data: prods }, { data: bs }, { data: st }] = await Promise.all([
      supabase.from("products").select("id,name").eq("is_active", true).order("name"),
      supabase.from("product_batches").select("*").order("purchase_date", { ascending: false }),
      supabase.from("product_stock").select("*").order("product_name"),
    ]);
    setProducts(prods || []);
    setBatches(bs || []);
    setStock((st as StockRow[]) || []);
  };

  useEffect(() => { load(); }, []);

  const productNameById = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [products]);

  const reset = () => {
    setProductId(""); setQuantity(""); setCostUsd(""); setCostMxn("");
    setCommissionUsd(""); setCommissionMxn(""); setShowCommission(false);
    setInvoice(""); setPurchaseDate(new Date().toISOString().slice(0, 10)); setNotes("");
    setEditingBatch(null);
  };

  const totalCostUsd = (parseFloat(costUsd) || 0) + (parseFloat(commissionUsd) || 0);
  const totalCostMxn = (parseFloat(costMxn) || 0) + (parseFloat(commissionMxn) || 0);

  const openEditDialog = (batch: Batch) => {
    setEditingBatch(batch);
    setProductId(batch.product_id);
    setQuantity(batch.quantity.toString());
    setCostUsd((Number(batch.cost_usd) - Number(batch.commission_usd)).toString());
    setCostMxn((Number(batch.cost_mxn) - Number(batch.commission_mxn)).toString());
    setCommissionUsd(Number(batch.commission_usd).toString());
    setCommissionMxn(Number(batch.commission_mxn).toString());
    setShowCommission(Number(batch.commission_usd) > 0 || Number(batch.commission_mxn) > 0);
    setInvoice(batch.supplier_invoice || "");
    setPurchaseDate(batch.purchase_date);
    setNotes(batch.notes || "");
    setOpen(true);
  };

  const submit = async () => {
    if (!productId) return toast.error("Selecciona un producto");
    const q = parseFloat(quantity);
    if (!q || q <= 0) return toast.error("Cantidad inválida");
    setSubmitting(true);

    if (editingBatch) {
      // Update existing batch
      const remainingDiff = q - Number(editingBatch.quantity);
      const newRemaining = Number(editingBatch.remaining_quantity) + remainingDiff;
      const { error } = await supabase.from("product_batches").update({
        product_id: productId,
        quantity: q,
        remaining_quantity: Math.max(0, newRemaining),
        cost_usd: totalCostUsd,
        cost_mxn: totalCostMxn,
        commission_usd: parseFloat(commissionUsd) || 0,
        commission_mxn: parseFloat(commissionMxn) || 0,
        supplier_invoice: invoice.trim() || null,
        purchase_date: purchaseDate,
        notes: notes.trim() || null,
      }).eq("id", editingBatch.id);
      setSubmitting(false);
      if (error) return toast.error(error.message);
      toast.success("Lote actualizado");
    } else {
      // Insert new batch
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("product_batches").insert({
        product_id: productId,
        quantity: q,
        remaining_quantity: q,
        cost_usd: totalCostUsd,
        cost_mxn: totalCostMxn,
        commission_usd: parseFloat(commissionUsd) || 0,
        commission_mxn: parseFloat(commissionMxn) || 0,
        supplier_invoice: invoice.trim() || null,
        purchase_date: purchaseDate,
        notes: notes.trim() || null,
        created_by: user?.id,
      });
      setSubmitting(false);
      if (error) return toast.error(error.message);
      toast.success("Lote registrado");
    }

    setOpen(false);
    reset();
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("product_batches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Lote eliminado");
    load();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" /> Lotes de inventario
          </CardTitle>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Nuevo lote
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingBatch ? "Editar lote" : "Registrar lote de compra"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Producto</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger><SelectValue placeholder="Selecciona producto" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Cantidad</Label>
                    <Input type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  </div>
                  <div>
                    <Label>Fecha de compra</Label>
                    <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Costo producto USD</Label>
                    <Input type="number" step="0.01" value={costUsd} onChange={(e) => setCostUsd(e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <Label>Costo producto MXN</Label>
                    <Input type="number" step="0.01" value={costMxn} onChange={(e) => setCostMxn(e.target.value)} placeholder="0.00" />
                  </div>
                </div>

                {/* Optional supplier commission */}
                <button
                  type="button"
                  onClick={() => setShowCommission(!showCommission)}
                  className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                >
                  {showCommission ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Comisión al proveedor (opcional)
                </button>
                {showCommission && (
                  <div className="grid grid-cols-2 gap-2 bg-muted/30 rounded-lg p-2">
                    <div>
                      <Label className="text-xs">Comisión USD</Label>
                      <Input type="number" step="0.01" value={commissionUsd} onChange={(e) => setCommissionUsd(e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                      <Label className="text-xs">Comisión MXN</Label>
                      <Input type="number" step="0.01" value={commissionMxn} onChange={(e) => setCommissionMxn(e.target.value)} placeholder="0.00" />
                    </div>
                  </div>
                )}

                {/* Total cost summary */}
                {(showCommission && (parseFloat(commissionUsd) > 0 || parseFloat(commissionMxn) > 0)) && (
                  <div className="bg-primary/5 rounded-lg p-2 text-xs space-y-0.5">
                    <p className="text-muted-foreground font-medium">Costo total del lote (producto + comisión):</p>
                    <p className="font-bold">USD: ${totalCostUsd.toFixed(2)} · MXN: ${totalCostMxn.toFixed(2)}</p>
                  </div>
                )}

                <div>
                  <Label>Factura proveedor</Label>
                  <Input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="Núm. factura" />
                </div>
                <div>
                  <Label>Notas</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={submit} disabled={submitting}>
                  {submitting ? "Guardando..." : editingBatch ? "Guardar cambios" : "Guardar lote"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stock summary */}
        <div>
          <p className="text-[11px] uppercase text-muted-foreground tracking-wide mb-2">Stock actual</p>
          {stock.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin productos.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {stock.map((s) => (
                <div
                  key={s.product_id}
                  className={cn(
                    "rounded-lg border p-2 bg-card",
                    Number(s.stock) === 0 && "border-destructive/40",
                  )}
                >
                  <p className="text-xs font-semibold truncate">{s.product_name}</p>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <span className={cn(
                      "text-base font-bold tabular-nums",
                      Number(s.stock) === 0 ? "text-destructive" : "text-foreground",
                    )}>
                      {Number(s.stock).toFixed(0)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      ${Number(s.avg_cost_mxn).toFixed(2)} MXN c/u
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Batches list */}
        <div>
          <p className="text-[11px] uppercase text-muted-foreground tracking-wide mb-2">Lotes registrados</p>
          {batches.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Aún no hay lotes. Registra una compra para empezar a rastrear costos.
            </p>
          ) : (
            <div className="space-y-1.5">
              {batches.map((b) => {
                const empty = Number(b.remaining_quantity) === 0;
                const partial = Number(b.remaining_quantity) > 0 && Number(b.remaining_quantity) < Number(b.quantity);
                const hasCommission = Number(b.commission_usd) > 0 || Number(b.commission_mxn) > 0;
                return (
                  <div key={b.id} className={cn(
                    "rounded-lg border p-2.5 bg-card flex items-start justify-between gap-2",
                    empty && "opacity-60",
                  )}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Package2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <p className="text-sm font-semibold truncate">
                          {productNameById.get(b.product_id) ?? "—"}
                        </p>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                        <span>{new Date(b.purchase_date).toLocaleDateString("es-MX")}</span>
                        {b.supplier_invoice && <span>· Fact. {b.supplier_invoice}</span>}
                      </div>
                      <div className="text-[11px] mt-1 flex flex-wrap gap-x-3 tabular-nums">
                        <span>
                          <span className="text-muted-foreground">Stock: </span>
                          <span className={cn(
                            "font-bold",
                            empty ? "text-destructive" : partial ? "text-warning" : "text-success",
                          )}>
                            {Number(b.remaining_quantity).toFixed(0)}/{Number(b.quantity).toFixed(0)}
                          </span>
                        </span>
                        <span><span className="text-muted-foreground">USD:</span> {Number(b.cost_usd).toFixed(2)}</span>
                        <span><span className="text-muted-foreground">MXN:</span> {Number(b.cost_mxn).toFixed(2)}</span>
                      </div>
                      {hasCommission && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Comisión: ${Number(b.commission_usd).toFixed(2)} USD / ${Number(b.commission_mxn).toFixed(2)} MXN
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditDialog(b)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-destructive" /> Eliminar lote
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Solo es posible si el lote no fue consumido por ventas. Esto no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(b.id)}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
