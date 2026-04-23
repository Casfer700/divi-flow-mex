import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Receipt, Ban, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Sale {
  id: string;
  product_name: string;
  total_amount: number;
  currency: string;
  sales_agent: string | null;
  sale_date: string;
  status: string;
  cancel_reason: string | null;
}

export function SalesHistoryManager() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [reason, setReason] = useState("");
  const [target, setTarget] = useState<Sale | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("pos_sales")
      .select("id,product_name,total_amount,currency,sales_agent,sale_date,status,cancel_reason")
      .order("sale_date", { ascending: false })
      .limit(30);
    setSales((data as Sale[]) || []);
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
                  {!cancelled && (
                    <AlertDialog open={target?.id === s.id} onOpenChange={(o) => !o && setTarget(null)}>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10 transition-all duration-200"
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
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
