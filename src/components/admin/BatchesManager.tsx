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
import { Layers, Plus, Trash2, Package2, AlertTriangle } from "lucide-react";
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

  // form
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costUsd, setCostUsd] = useState("");
  const [costMxn, setCostMxn] = useState("");
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
    setInvoice(""); setPurchaseDate(new Date().toISOString().slice(0, 10)); setNotes("");
  };

  const submit = async () => {
    if (!productId) return toast.error("Selecciona un producto");
    const q = parseFloat(quantity);
    if (!q || q <= 0) return toast.error("Cantidad inválida");
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("product_batches").insert({
      product_id: productId,
      quantity: q,
      remaining_quantity: q,
      cost_usd: parseFloat(costUsd) || 0,
      cost_mxn: parseFloat(costMxn) || 0,
      supplier_invoice: invoice.trim() || null,
      purchase_date: purchaseDate,
      notes: notes.trim() || null,
      created_by: user?.id,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Lote registrado");
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
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Registrar lote de compra</DialogTitle></DialogHeader>
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
                    <Label>Costo total USD</Label>
                    <Input type="number" step="0.01" value={costUsd} onChange={(e) => setCostUsd(e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <Label>Costo total MXN</Label>
                    <Input type="number" step="0.01" value={costMxn} onChange={(e) => setCostMxn(e.target.value)} placeholder="0.00" />
                  </div>
                </div>
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
                  {submitting ? "Guardando..." : "Guardar lote"}
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
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0">
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
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
