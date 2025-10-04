import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, MessageCircle, MapPin, DollarSign } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Customer {
  id: string;
  name: string;
  phone_mx: string;
  phone_cu: string | null;
  address: string;
  notes: string | null;
}

interface Order {
  id: string;
  customer_id: string;
  usd_amount: number;
  eur_amount: number;
  cup_amount: number;
  total_mxn: number;
  payment_status: "pending" | "paid" | "verified";
  delivery_status: "pending" | "in_transit" | "delivered";
  customers: Customer;
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: "",
    usd_amount: "",
    eur_amount: "",
    cup_amount: "",
    total_mxn: "",
  });

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        customers (*)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error al cargar órdenes");
      return;
    }
    setOrders(data || []);
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Error al cargar clientes");
      return;
    }
    setCustomers(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from("orders").insert([{
      ...formData,
      usd_amount: parseFloat(formData.usd_amount) || 0,
      eur_amount: parseFloat(formData.eur_amount) || 0,
      cup_amount: parseFloat(formData.cup_amount) || 0,
      total_mxn: parseFloat(formData.total_mxn),
      created_by: user?.id,
    }]);

    if (error) {
      toast.error("Error al crear orden");
      return;
    }

    toast.success("Orden creada");
    setIsDialogOpen(false);
    setFormData({ customer_id: "", usd_amount: "", eur_amount: "", cup_amount: "", total_mxn: "" });
    fetchOrders();
  };

  const updateOrderStatus = async (
    orderId: string,
    field: "payment_status" | "delivery_status",
    value: string
  ) => {
    const { error } = await supabase
      .from("orders")
      .update({ [field]: value })
      .eq("id", orderId);

    if (error) {
      toast.error("Error al actualizar estado");
      return;
    }

    toast.success("Estado actualizado");
    fetchOrders();
  };

  const sendWhatsApp = (order: Order) => {
    const message = `Hola ${order.customers.name},

Te confirmamos tu orden de divisas:
${order.usd_amount > 0 ? `- USD: $${order.usd_amount.toFixed(2)}\n` : ""}${order.eur_amount > 0 ? `- EUR: €${order.eur_amount.toFixed(2)}\n` : ""}${order.cup_amount > 0 ? `- CUP: $${order.cup_amount.toFixed(2)}\n` : ""}
Total a pagar: $${order.total_mxn.toFixed(2)} MXN

Por favor realiza tu pago a:
Banco: *BBVA*
Nombre: Kevin Castellanos Fermin
Concepto: ${order.customers.name}

• Si su cuenta es BBVA ÚNICAMENTE:
Número de cuenta - 1123766659

• Si su cuenta es de otro banco:
CLABE - 012610011237666590

*Favor de enviar la captura del pago*`;

    const phone = order.customers.phone_mx.replace(/\D/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const getPaymentBadge = (status: string) => {
    const variants = {
      pending: "warning",
      paid: "success",
      verified: "success",
    };
    const labels = {
      pending: "Pendiente",
      paid: "Pagado",
      verified: "Verificado",
    };
    return <Badge variant={variants[status as keyof typeof variants] as any}>{labels[status as keyof typeof labels]}</Badge>;
  };

  const getDeliveryBadge = (status: string) => {
    const variants = {
      pending: "warning",
      in_transit: "warning",
      delivered: "success",
    };
    const labels = {
      pending: "Pendiente",
      in_transit: "En camino",
      delivered: "Entregado",
    };
    return <Badge variant={variants[status as keyof typeof variants] as any}>{labels[status as keyof typeof labels]}</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold">Órdenes</h1>
          {(profile?.role === "admin" || profile?.role === "local") && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva orden
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nueva orden</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer">Cliente</Label>
                    <Select
                      value={formData.customer_id}
                      onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="usd">USD</Label>
                      <Input
                        id="usd"
                        type="number"
                        step="0.01"
                        value={formData.usd_amount}
                        onChange={(e) => setFormData({ ...formData, usd_amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="eur">EUR</Label>
                      <Input
                        id="eur"
                        type="number"
                        step="0.01"
                        value={formData.eur_amount}
                        onChange={(e) => setFormData({ ...formData, eur_amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cup">CUP</Label>
                      <Input
                        id="cup"
                        type="number"
                        step="0.01"
                        value={formData.cup_amount}
                        onChange={(e) => setFormData({ ...formData, cup_amount: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="total">Total MXN</Label>
                    <Input
                      id="total"
                      type="number"
                      step="0.01"
                      value={formData.total_mxn}
                      onChange={(e) => setFormData({ ...formData, total_mxn: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">Crear orden</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid gap-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle className="text-lg">{order.customers.name}</CardTitle>
                  <div className="flex gap-2">
                    {getPaymentBadge(order.payment_status)}
                    {getDeliveryBadge(order.delivery_status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        {order.usd_amount > 0 && <span className="mr-2">USD: ${order.usd_amount.toFixed(2)}</span>}
                        {order.eur_amount > 0 && <span className="mr-2">EUR: €{order.eur_amount.toFixed(2)}</span>}
                        {order.cup_amount > 0 && <span>CUP: ${order.cup_amount.toFixed(2)}</span>}
                      </div>
                    </div>
                    <p className="text-sm font-medium">Total: ${order.total_mxn.toFixed(2)} MXN</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <p className="text-muted-foreground">{order.customers.address}</p>
                    </div>
                    {order.customers.notes && (
                      <p className="text-sm text-muted-foreground italic">{order.customers.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => sendWhatsApp(order)}
                    className="gap-2"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>

                  {(profile?.role === "admin" || profile?.role === "local") && (
                    <Select
                      value={order.payment_status}
                      onValueChange={(value) => updateOrderStatus(order.id, "payment_status", value)}
                    >
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="pending">Pendiente</SelectItem>
                        <SelectItem value="paid">Pagado</SelectItem>
                        <SelectItem value="verified">Verificado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  <Select
                    value={order.delivery_status}
                    onValueChange={(value) => updateOrderStatus(order.id, "delivery_status", value)}
                  >
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="in_transit">En camino</SelectItem>
                      <SelectItem value="delivered">Entregado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {orders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No hay órdenes registradas
          </div>
        )}
      </div>
    </Layout>
  );
}
