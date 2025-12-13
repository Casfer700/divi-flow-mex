import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";

interface ExchangeRate {
  id: string;
  currency: string;
  rate_type: string;
  buy_rate: number;
  sell_rate: number;
}

export function ExchangeRatesManager() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ buy_rate: "", sell_rate: "" });

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    const { data, error } = await supabase
      .from("exchange_rates")
      .select("*")
      .order("currency")
      .order("rate_type");

    if (error) {
      toast.error("Error al cargar tasas de cambio");
      return;
    }
    setRates(data || []);
  };

  const handleEdit = (rate: ExchangeRate) => {
    setEditingId(rate.id);
    setEditValues({
      buy_rate: rate.buy_rate.toString(),
      sell_rate: rate.sell_rate.toString(),
    });
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase
      .from("exchange_rates")
      .update({
        buy_rate: parseFloat(editValues.buy_rate),
        sell_rate: parseFloat(editValues.sell_rate),
      })
      .eq("id", id);

    if (error) {
      toast.error("Error al actualizar tasa");
      return;
    }

    toast.success("Tasa actualizada");
    setEditingId(null);
    fetchRates();
  };

  const getRateLabel = (type: string) => {
    const labels: Record<string, string> = {
      wholesale: "Mayoreo",
      retail: "Menudeo",
      individual: "Individual",
    };
    return labels[type] || type;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>Tasas de Cambio</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Divisa</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Compra (MXN)</TableHead>
              <TableHead>Venta (MXN)</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((rate) => (
              <TableRow key={rate.id}>
                <TableCell className="font-medium">{rate.currency}</TableCell>
                <TableCell>{getRateLabel(rate.rate_type)}</TableCell>
                <TableCell>
                  {editingId === rate.id ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editValues.buy_rate}
                      onChange={(e) =>
                        setEditValues({ ...editValues, buy_rate: e.target.value })
                      }
                      className="w-24"
                    />
                  ) : (
                    `$${rate.buy_rate.toFixed(2)}`
                  )}
                </TableCell>
                <TableCell>
                  {editingId === rate.id ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editValues.sell_rate}
                      onChange={(e) =>
                        setEditValues({ ...editValues, sell_rate: e.target.value })
                      }
                      className="w-24"
                    />
                  ) : (
                    `$${rate.sell_rate.toFixed(2)}`
                  )}
                </TableCell>
                <TableCell>
                  {editingId === rate.id ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSave(rate.id)}>
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleEdit(rate)}>
                      Editar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
