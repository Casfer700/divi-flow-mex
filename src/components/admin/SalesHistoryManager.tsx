import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Receipt, Ban, CheckCircle2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface Sale {
  id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  total_amount: number;
  currency: string;
  sales_agent: string | null;
  sales_agent_id: string | null;
  commission_mxn: number;
  commission_currency: string;
  sale_date: string;
  status: string;
  cancel_reason: string | null;
  notes: string | null;
  payment_method: string;
}

interface Agent {
  id: string;
  name: string;
  default_commission_mxn: number;
}

export function SalesHistoryManager() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState<Sale | null>(null);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [editForm, setEditForm] = useState({
    unit_price: "",
    quantity: "",
    sales_agent_id: "",
    commission_mxn: "",
    commission_currency: "USD",
    notes: "",
  });

  const load = async () => {
    const [{ data }, { data: ags }] = await Promise.all([
      supabase
        .from("pos_sales")
        .select("id,product_name,unit_price,quantity,total_amount,currency,sales_agent,sales_agent_id,commission_mxn,commission_currency,sale_date,status,cancel_reason,notes,payment_method")
        .order("sale_date", { ascending: false })
        .limit(30),
      supabase.from("sales_agents").select("id,name,default_commission_mxn").eq("is_active", true).order("name"),
    ]);
    setSales((data as Sale[]) || []);
    setAgents((ags as Agent[]) || []);
  };
  useEffect(() => { load(); }, []);

  const cancelSale = async () => {
    if (!target) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("pos_sales")
      .update({ status: "cancelled", cancelled_by: user?.id, cancel_reason: reason || null })
      .eq("id", target.id);
    if (error) return toast.error(error.message);
    toast.success("Venta cancelada y movimientos revertidos");
    setTarget(null); setReason(""); load();
  };

  const openEdit = (s: Sale) => {
    setEditing(s);
    setEditForm({
      unit_price: String(s.unit_price),
      quantity: String(s.quantity),
      sales_agent_id: s.sales_agent_id || "",
      commission_mxn: String(s.commission_mxn || 0),
      commission_currency: s.commission_currency || "USD",
      notes: s.notes || "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const unitPrice = parseFloat(editForm.unit_price) || 0;
    const qty = parseFloat(editForm.quantity) || 0;
    const agentName = agents.find(a => a.id === editForm.sales_agent_id)?.name || null;
    const { error } = await supabase
      .from("pos_sales")
      .update({
        unit_price: unitPrice,
        quantity: qty,
        total_amount: unitPrice * qty,
        sales_agent_id: editForm.sales_agent_id || null,
        sales_agent: agentName,
        commission_mxn: parseFloat(editForm.commission_mxn) || 0,
        commission_currency: editForm.commission_currency,
        notes: editForm.notes || null,
      })
      .eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Venta actualizada");
    setEditing(null);
    load();
  };

  return (
    <Card className="rounded-xl shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4" /> Ventas POS recientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin ventas.</p>
        ) : (
          <div className="space-y-2 animate-fade-in">
            {sales.map((s) => {
              const cancelled = s.status === "cancelled";
              return (
                <div key={s.id} className={cn(
                  "rounded-lg border bg-card p-3 flex items-center gap-3 shadow-sm transition-all duration-200",
                  cancelled && "opacity-70",
                )}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {cancelled
                        ? <Ban className="h-3.5 w-3.5 text-destructive shrink-0" />
                        : <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />}
                      <p className={cn("text-sm font-semibold truncate", cancelled && "line-through")}>
                        {s.product_name}
                      </p>
                      {cancelled && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-destructive/10 text-destructive">
                          Cancelada
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.sale_date).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {s.sales_agent ? ` · ${s.sales_agent}` : ""}
                      {s.cancel_reason ? ` · ${s.cancel_reason}` : ""}
                    </p>
                  </div>
                  <span className={cn("font-bold text-sm tabular-nums", cancelled && "line-through text-muted-foreground")}>
                    {Number(s.total_amount).toFixed(2)} {s.currency}
                  </span>
                  <div className="flex items-center gap-1">
                    {!cancelled && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 w-9 p-0 rounded-lg transition-all duration-200"
                        onClick={() => openEdit(s)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {!cancelled && (
                      <AlertDialog open={target?.id === s.id} onOpenChange={(o) => !o && setTarget(null)}>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 w-9 p-0 rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10 transition-all duration-200"
                            onClick={() => setTarget(s)}
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Cancelar esta venta?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminarán los movimientos financieros, se restaurará el inventario consumido y la factura asociada (si la hay) volverá a estar disponible. Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="space-y-2">
                            <Label className="text-sm">Motivo (opcional)</Label>
                            <Textarea
                              rows={2}
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="Ej. error de cobro, cliente devolvió producto..."
                              className="rounded-lg"
                            />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => { setTarget(null); setReason(""); }}>Mantener</AlertDialogCancel>
                            <AlertDialogAction onClick={cancelSale} className="bg-destructive hover:bg-destructive/90">
                              Cancelar venta
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Editar venta: {editing?.product_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Precio unidad</Label>
                <Input type="number" step="0.01" value={editForm.unit_price}
                  onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })}
                  className="h-11 rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cantidad</Label>
                <Input type="number" step="0.01" value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                  className="h-11 rounded-lg" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</Label>
              <p className="text-lg font-bold tabular-nums">
                {((parseFloat(editForm.unit_price) || 0) * (parseFloat(editForm.quantity) || 0)).toFixed(2)} {editing?.currency}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agente</Label>
              <Select value={editForm.sales_agent_id} onValueChange={(v) => setEditForm({ ...editForm, sales_agent_id: v })}>
                <SelectTrigger className="h-11 rounded-lg"><SelectValue placeholder="Sin agente" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Comisión</Label>
                <Input type="number" step="0.01" value={editForm.commission_mxn}
                  onChange={(e) => setEditForm({ ...editForm, commission_mxn: e.target.value })}
                  className="h-11 rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Divisa comisión</Label>
                <Select value={editForm.commission_currency} onValueChange={(v) => setEditForm({ ...editForm, commission_currency: v })}>
                  <SelectTrigger className="h-11 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="MXN">MXN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notas</Label>
              <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                className="rounded-lg" rows={2} />
            </div>
            <Button onClick={saveEdit} className="w-full h-11 rounded-lg font-semibold">
              Guardar cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
