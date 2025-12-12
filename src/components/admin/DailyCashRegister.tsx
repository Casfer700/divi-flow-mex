import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Receipt } from "lucide-react";

interface DailySummary {
  local: {
    usd: number;
    eur: number;
    cup: number;
    total_mxn: number;
    count: number;
  };
  delivery: {
    usd: number;
    eur: number;
    cup: number;
    total_mxn: number;
    count: number;
  };
}

export function DailyCashRegister() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [summary, setSummary] = useState<DailySummary>({
    local: { usd: 0, eur: 0, cup: 0, total_mxn: 0, count: 0 },
    delivery: { usd: 0, eur: 0, cup: 0, total_mxn: 0, count: 0 },
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDailySummary();
  }, [selectedDate]);

  const fetchDailySummary = async () => {
    setLoading(true);
    const start = startOfDay(selectedDate).toISOString();
    const end = endOfDay(selectedDate).toISOString();

    // Get orders with assigned user info
    const { data: orders, error } = await supabase
      .from("orders")
      .select(`
        *,
        assigned_user:profiles!orders_assigned_to_fkey (id, full_name, role)
      `)
      .gte("created_at", start)
      .lte("created_at", end);

    if (error) {
      console.error("Error fetching daily summary:", error);
      setLoading(false);
      return;
    }

    const newSummary: DailySummary = {
      local: { usd: 0, eur: 0, cup: 0, total_mxn: 0, count: 0 },
      delivery: { usd: 0, eur: 0, cup: 0, total_mxn: 0, count: 0 },
    };

    orders?.forEach((order) => {
      const isDelivery = order.assigned_user?.role === "delivery";
      const target = isDelivery ? newSummary.delivery : newSummary.local;

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle>Corte de Caja Diario</CardTitle>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(selectedDate, "PPP", { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Cargando...
          </div>
        ) : (
          <div className="space-y-6">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">USD</TableHead>
                    <TableHead className="text-right">EUR</TableHead>
                    <TableHead className="text-right">CUP</TableHead>
                    <TableHead className="text-right">Total MXN</TableHead>
                    <TableHead className="text-right">Órdenes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <Badge variant="secondary">Local</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${summary.local.usd.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      €{summary.local.eur.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${summary.local.cup.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${summary.local.total_mxn.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {summary.local.count}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Badge variant="outline">Delivery</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${summary.delivery.usd.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      €{summary.delivery.eur.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${summary.delivery.cup.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${summary.delivery.total_mxn.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {summary.delivery.count}
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total del Día</TableCell>
                    <TableCell className="text-right">
                      ${grandTotal.usd.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      €{grandTotal.eur.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${grandTotal.cup.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-primary">
                      ${grandTotal.total_mxn.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {grandTotal.count}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {grandTotal.count === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                No hay órdenes para esta fecha
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
