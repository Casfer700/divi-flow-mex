import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Receipt } from "lucide-react";

interface DailySummary {
  local: { usd: number; eur: number; cup: number; total_mxn: number; count: number };
  delivery: { usd: number; eur: number; cup: number; total_mxn: number; count: number };
}

export function DailyCashRegister() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [summary, setSummary] = useState<DailySummary>({
    local: { usd: 0, eur: 0, cup: 0, total_mxn: 0, count: 0 },
    delivery: { usd: 0, eur: 0, cup: 0, total_mxn: 0, count: 0 },
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchDailySummary(); }, [selectedDate]);

  const fetchDailySummary = async () => {
    setLoading(true);
    const start = startOfDay(selectedDate).toISOString();
    const end = endOfDay(selectedDate).toISOString();
    const { data: orders, error } = await supabase.from("orders")
      .select(`*, assigned_user:profiles!orders_assigned_to_fkey (id, full_name, role)`)
      .gte("created_at", start).lte("created_at", end);
    if (error) { setLoading(false); return; }
    const newSummary: DailySummary = {
      local: { usd: 0, eur: 0, cup: 0, total_mxn: 0, count: 0 },
      delivery: { usd: 0, eur: 0, cup: 0, total_mxn: 0, count: 0 },
    };
    orders?.forEach((order) => {
      const target = order.assigned_user?.role === "delivery" ? newSummary.delivery : newSummary.local;
      target.usd += order.usd_amount || 0;
      target.eur += order.eur_amount || 0;
      target.cup += order.cup_amount || 0;
      target.total_mxn += order.total_mxn || 0;
      target.count += 1;
    });
    setSummary(newSummary);
    setLoading(false);
  };

  const grandTotal = {
    usd: summary.local.usd + summary.delivery.usd,
    eur: summary.local.eur + summary.delivery.eur,
    cup: summary.local.cup + summary.delivery.cup,
    total_mxn: summary.local.total_mxn + summary.delivery.total_mxn,
    count: summary.local.count + summary.delivery.count,
  };

  const renderChannel = (label: string, data: typeof summary.local, variant: "default" | "outline") => (
    <div className="bg-muted/30 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Badge variant={variant} className="text-[10px] h-5 rounded-full">{label}</Badge>
        <span className="text-xs text-muted-foreground">{data.count} órdenes</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div><span className="text-muted-foreground text-xs">USD</span><p className="font-semibold">${data.usd.toFixed(2)}</p></div>
        <div><span className="text-muted-foreground text-xs">EUR</span><p className="font-semibold">€{data.eur.toFixed(2)}</p></div>
        <div><span className="text-muted-foreground text-xs">CUP</span><p className="font-semibold">${data.cup.toFixed(2)}</p></div>
        <div><span className="text-muted-foreground text-xs">Total MXN</span><p className="font-semibold text-primary">${data.total_mxn.toFixed(2)}</p></div>
      </div>
    </div>
  );

  return (
    <div className="bg-card rounded-2xl shadow-fintech-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Corte de Caja</h2>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 min-h-0 rounded-lg gap-1 text-xs">
              <CalendarIcon className="h-3.5 w-3.5" />
              {format(selectedDate, "d MMM", { locale: es })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
          </PopoverContent>
        </Popover>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Cargando...</div>
      ) : (
        <div className="space-y-3">
          {renderChannel("Local", summary.local, "default")}
          {renderChannel("Delivery", summary.delivery, "outline")}

          <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold">Total del día</span>
              <span className="text-xs text-muted-foreground">{grandTotal.count} órdenes</span>
            </div>
            <p className="text-xl font-bold text-primary">${grandTotal.total_mxn.toFixed(2)} MXN</p>
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
              <span>${grandTotal.usd.toFixed(2)} USD</span>
              <span>€{grandTotal.eur.toFixed(2)} EUR</span>
              <span>${grandTotal.cup.toFixed(2)} CUP</span>
            </div>
          </div>

          {grandTotal.count === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">Sin órdenes para esta fecha</div>
          )}
        </div>
      )}
    </div>
  );
}
