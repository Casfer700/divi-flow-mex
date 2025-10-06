import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Package, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface InventoryMovement {
  id: string;
  currency: string;
  amount: number;
  movement_type: string;
  notes: string | null;
  created_at: string;
}

interface InventoryBalance {
  USD: number;
  EUR: number;
  CUP: number;
}

export function InventoryManager() {
  const { user } = useAuth();
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [balance, setBalance] = useState<InventoryBalance>({ USD: 0, EUR: 0, CUP: 0 });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    currency: "",
    amount: "",
    movement_type: "",
    notes: "",
  });

  useEffect(() => {
    fetchMovements();
    calculateBalance();
  }, []);

  const fetchMovements = async () => {
    const { data, error } = await supabase
      .from("inventory_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      toast.error("Error al cargar movimientos");
      return;
    }
    setMovements(data || []);
  };

  const calculateBalance = async () => {
    const { data, error } = await supabase
      .from("inventory_movements")
      .select("currency, amount, movement_type");

    if (error) return;

    const newBalance: InventoryBalance = { USD: 0, EUR: 0, CUP: 0 };
    
    data?.forEach((mov) => {
      const currency = mov.currency as keyof InventoryBalance;
      const amount = parseFloat(mov.amount.toString());
      
      if (mov.movement_type === "in") {
        newBalance[currency] += amount;
      } else if (mov.movement_type === "out") {
        newBalance[currency] -= amount;
      } else if (mov.movement_type === "adjustment") {
        newBalance[currency] = amount;
      }
    });

    setBalance(newBalance);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from("inventory_movements").insert([{
      ...formData,
      amount: parseFloat(formData.amount),
      created_by: user?.id,
    }]);

    if (error) {
      toast.error("Error al registrar movimiento");
      return;
    }

    toast.success("Movimiento registrado");
    setIsDialogOpen(false);
    setFormData({ currency: "", amount: "", movement_type: "", notes: "" });
    fetchMovements();
    calculateBalance();
  };

  const getMovementTypeLabel = (type: string) => {
    const labels = { in: "Entrada", out: "Salida", adjustment: "Ajuste" };
    return labels[type as keyof typeof labels] || type;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle>Inventario de Divisas</CardTitle>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar Movimiento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo Movimiento</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Divisa</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar divisa" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="CUP">CUP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="movement_type">Tipo de Movimiento</Label>
                    <Select
                      value={formData.movement_type}
                      onValueChange={(value) => setFormData({ ...formData, movement_type: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="in">Entrada</SelectItem>
                        <SelectItem value="out">Salida</SelectItem>
                        <SelectItem value="adjustment">Ajuste</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Cantidad</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Detalles del movimiento..."
                    />
                  </div>
                  <Button type="submit" className="w-full">Registrar</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-primary/5 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">USD</div>
              <div className="text-2xl font-bold">${balance.USD.toFixed(2)}</div>
            </div>
            <div className="bg-primary/5 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">EUR</div>
              <div className="text-2xl font-bold">€{balance.EUR.toFixed(2)}</div>
            </div>
            <div className="bg-primary/5 rounded-lg p-4">
              <div className="text-sm text-muted-foreground mb-1">CUP</div>
              <div className="text-2xl font-bold">${balance.CUP.toFixed(2)}</div>
            </div>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Divisa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>
                      {new Date(movement.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">{movement.currency}</TableCell>
                    <TableCell>{getMovementTypeLabel(movement.movement_type)}</TableCell>
                    <TableCell
                      className={
                        movement.movement_type === "in"
                          ? "text-success"
                          : movement.movement_type === "out"
                          ? "text-destructive"
                          : ""
                      }
                    >
                      {movement.movement_type === "in" ? "+" : movement.movement_type === "out" ? "-" : ""}
                      {movement.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {movement.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
