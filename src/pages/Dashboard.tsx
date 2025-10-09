import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { OrderCard } from "@/components/OrderCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, MessageCircle, MapPin, DollarSign, Search, User, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";

interface Customer {
  id: string;
  name: string;
  phone_mx: string;
  phone_cu: string | null;
  address: string;
  notes: string | null;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface ExchangeRate {
  currency: string;
  rate_type: string;
  buy_rate: number;
  sell_rate: number;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  template: string;
  description: string | null;
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
  price_type: "wholesale" | "retail";
  assigned_to: string | null;
  delivery_notes: string | null;
  delivery_date: string | null;
  customers: Customer;
  assigned_user?: Profile;
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeliveryDialogOpen, setIsDeliveryDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [deliveryFormData, setDeliveryFormData] = useState<{
    delivery_status: "pending" | "in_transit" | "delivered";
    delivery_notes: string;
    delivery_date: Date | undefined;
  }>({
    delivery_status: "pending",
    delivery_notes: "",
    delivery_date: undefined,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    customer_id: "",
    usd_amount: "",
    eur_amount: "",
    cup_amount: "",
    total_mxn: "",
    price_type: "retail",
    assigned_to: "",
    delivery_date: undefined as Date | undefined,
  });

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
    fetchUsers();
    fetchRates();
    fetchTemplates();
  }, []);

  useEffect(() => {
    calculateTotal();
  }, [formData.usd_amount, formData.eur_amount, formData.cup_amount, formData.price_type]);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        customers (*),
        assigned_user:profiles!orders_assigned_to_fkey (id, full_name, role)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error al cargar órdenes");
      return;
    }
    setOrders((data || []) as Order[]);
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

  const fetchUsers = async () => {
    // First get user_roles for local and delivery
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["local", "delivery"]);

    if (rolesError) {
      toast.error("Error al cargar usuarios");
      console.error("Error fetching user roles:", rolesError);
      return;
    }

    if (!rolesData || rolesData.length === 0) {
      setUsers([]);
      return;
    }

    // Then get profiles for those users
    const userIds = rolesData.map(r => r.user_id);
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profilesError) {
      toast.error("Error al cargar perfiles de usuarios");
      console.error("Error fetching profiles:", profilesError);
      return;
    }

    // Combine the data
    const transformedData = rolesData.map((roleItem) => {
      const profile = profilesData?.find(p => p.id === roleItem.user_id);
      return {
        id: roleItem.user_id,
        full_name: profile?.full_name || "Usuario",
        role: roleItem.role
      };
    });
    
    setUsers(transformedData);
  };

  const fetchRates = async () => {
    const { data, error } = await supabase
      .from("exchange_rates")
      .select("*");

    if (error) {
      toast.error("Error al cargar tasas");
      return;
    }
    setRates(data || []);
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("whatsapp_templates")
      .select("*");

    if (error) {
      toast.error("Error al cargar plantillas");
      return;
    }
    setTemplates(data || []);
  };

  const calculateTotal = () => {
    if (!formData.usd_amount && !formData.eur_amount && !formData.cup_amount) {
      return;
    }

    let total = 0;
    const rateType = formData.price_type;

    if (formData.usd_amount) {
      const rate = rates.find(r => r.currency === "USD" && r.rate_type === rateType);
      if (rate) total += parseFloat(formData.usd_amount) * rate.sell_rate;
    }

    if (formData.eur_amount) {
      const rate = rates.find(r => r.currency === "EUR" && r.rate_type === rateType);
      if (rate) total += parseFloat(formData.eur_amount) * rate.sell_rate;
    }

    if (formData.cup_amount) {
      const rate = rates.find(r => r.currency === "CUP" && r.rate_type === rateType);
      if (rate) total += parseFloat(formData.cup_amount) * rate.sell_rate;
    }

    setFormData(prev => ({ ...prev, total_mxn: total.toFixed(2) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from("orders").insert([{
      customer_id: formData.customer_id,
      usd_amount: parseFloat(formData.usd_amount) || 0,
      eur_amount: parseFloat(formData.eur_amount) || 0,
      cup_amount: parseFloat(formData.cup_amount) || 0,
      total_mxn: parseFloat(formData.total_mxn),
      price_type: formData.price_type,
      assigned_to: formData.assigned_to || null,
      delivery_date: formData.delivery_date?.toISOString() || null,
      created_by: user?.id,
    }]);

    if (error) {
      toast.error("Error al crear orden");
      return;
    }

    toast.success("Orden creada");
    setIsDialogOpen(false);
    setFormData({ 
      customer_id: "", 
      usd_amount: "", 
      eur_amount: "", 
      cup_amount: "", 
      total_mxn: "",
      price_type: "retail",
      assigned_to: "",
      delivery_date: undefined,
    });
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

  const openDeliveryDialog = (order: Order) => {
    setSelectedOrder(order);
    setDeliveryFormData({
      delivery_status: order.delivery_status,
      delivery_notes: order.delivery_notes || "",
      delivery_date: order.delivery_date ? new Date(order.delivery_date) : undefined,
    });
    setIsDeliveryDialogOpen(true);
  };

  const handleDeliveryUpdate = async () => {
    if (!selectedOrder) return;

    const { error } = await supabase
      .from("orders")
      .update({
        delivery_status: deliveryFormData.delivery_status,
        delivery_notes: deliveryFormData.delivery_notes,
        delivery_date: deliveryFormData.delivery_date?.toISOString() || null,
      })
      .eq("id", selectedOrder.id);

    if (error) {
      toast.error("Error al actualizar entrega");
      console.error("Error updating delivery:", error);
      return;
    }

    toast.success("Entrega actualizada");
    setIsDeliveryDialogOpen(false);
    setSelectedOrder(null);
    fetchOrders();
  };

  const sendWhatsApp = (order: Order) => {
    // Get default template
    const template = templates.find(t => t.name === "default_order");
    
    if (!template) {
      toast.error("No hay plantilla configurada");
      return;
    }

    // Build currency amounts string
    const currencyAmounts = [
      order.usd_amount > 0 ? `USD: $${order.usd_amount.toFixed(2)}` : null,
      order.eur_amount > 0 ? `EUR: €${order.eur_amount.toFixed(2)}` : null,
      order.cup_amount > 0 ? `CUP: $${order.cup_amount.toFixed(2)}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Payment status labels
    const paymentStatusLabels = {
      pending: "Pendiente",
      paid: "Pagado",
      verified: "Verificado",
    };

    // Delivery status labels
    const deliveryStatusLabels = {
      pending: "Pendiente",
      in_transit: "En tránsito",
      delivered: "Entregado",
    };

    // Replace template variables
    let message = template.template
      .replace("{customer_name}", order.customers.name)
      .replace("{currency_amounts}", currencyAmounts)
      .replace("{total_mxn}", order.total_mxn.toFixed(2))
      .replace("{address}", order.customers.address)
      .replace("{phone_mx}", order.customers.phone_mx)
      .replace("{payment_status}", paymentStatusLabels[order.payment_status])
      .replace("{delivery_status}", deliveryStatusLabels[order.delivery_status]);

    const phone = order.customers.phone_mx.replace(/\D/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const getPaymentBadge = (status: string) => {
    const labels = {
      pending: "Pendiente pago",
      paid: "Pagado",
      verified: "✓ Verificado",
    };
    
    const styles = {
      pending: { backgroundColor: "hsl(4, 100%, 60%)", color: "white" },
      paid: { backgroundColor: "hsl(134, 61%, 41%)", color: "white" },
      verified: { backgroundColor: "hsl(134, 61%, 41%)", color: "white" },
    };
    
    return (
      <Badge 
        variant="outline"
        style={styles[status as keyof typeof styles]}
        className="border-0"
      >
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getDeliveryBadge = (status: string) => {
    const labels = {
      pending: "Por entregar",
      in_transit: "En camino",
      delivered: "✓ Entregado",
    };
    
    const styles = {
      pending: { backgroundColor: "hsl(45, 100%, 51%)", color: "white" },
      in_transit: { backgroundColor: "hsl(262, 52%, 51%)", color: "white" },
      delivered: { backgroundColor: "hsl(162, 73%, 46%)", color: "white" },
    };
    
    return (
      <Badge 
        variant="outline"
        style={styles[status as keyof typeof styles]}
        className="border-0"
      >
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.customers.name.toLowerCase().includes(query) ||
      order.customers.address.toLowerCase().includes(query) ||
      order.customers.phone_mx.includes(query)
    );
  });

  // Separate orders for admin and local views
  const localOrders = filteredOrders.filter(order => 
    !order.assigned_to || order.assigned_user?.role === "local"
  );
  
  const deliveryOrders = filteredOrders.filter(order => 
    order.assigned_user?.role === "delivery"
  );

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
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="price_type">Tipo de precio</Label>
                    <Select
                      value={formData.price_type}
                      onValueChange={(value) => setFormData({ ...formData, price_type: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="retail">Menudeo</SelectItem>
                        <SelectItem value="wholesale">Mayoreo</SelectItem>
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
                    <Label htmlFor="total">Total MXN (calculado)</Label>
                    <Input
                      id="total"
                      type="number"
                      step="0.01"
                      value={formData.total_mxn}
                      onChange={(e) => setFormData({ ...formData, total_mxn: e.target.value })}
                      required
                      className="bg-muted"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="assigned_to">Asignar a</Label>
                    <Select
                      value={formData.assigned_to}
                      onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {users.map((usr) => (
                          <SelectItem key={usr.id} value={usr.id}>
                            {usr.full_name} ({usr.role === "local" ? "Local" : "Repartidor"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Fecha de entrega</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.delivery_date ? (
                            format(formData.delivery_date, "PPP", { locale: es })
                          ) : (
                            <span>Seleccionar fecha</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.delivery_date}
                          onSelect={(date) => setFormData({ ...formData, delivery_date: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <Button type="submit" className="w-full">Crear orden</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, dirección o teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {(profile?.role === "admin" || profile?.role === "local") ? (
          <Tabs defaultValue="local" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="local">Órdenes Local</TabsTrigger>
              <TabsTrigger value="delivery">Órdenes Delivery</TabsTrigger>
            </TabsList>
            <TabsContent value="local" className="space-y-4 mt-4">
              {localOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchQuery ? "No se encontraron órdenes con ese criterio" : "No hay órdenes locales"}
                </div>
              ) : (
                <div className="grid gap-4">
                  {localOrders.map((order) => (
                    <OrderCard 
                      key={order.id} 
                      order={order} 
                      profile={profile} 
                      user={user}
                      onUpdateStatus={updateOrderStatus}
                      onOpenDeliveryDialog={openDeliveryDialog}
                      onSendWhatsApp={sendWhatsApp}
                      getPaymentBadge={getPaymentBadge}
                      getDeliveryBadge={getDeliveryBadge}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="delivery" className="space-y-4 mt-4">
              {deliveryOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchQuery ? "No se encontraron órdenes con ese criterio" : "No hay órdenes de delivery"}
                </div>
              ) : (
                <div className="grid gap-4">
                  {deliveryOrders.map((order) => (
                    <OrderCard 
                      key={order.id} 
                      order={order} 
                      profile={profile} 
                      user={user}
                      onUpdateStatus={updateOrderStatus}
                      onOpenDeliveryDialog={openDeliveryDialog}
                      onSendWhatsApp={sendWhatsApp}
                      getPaymentBadge={getPaymentBadge}
                      getDeliveryBadge={getDeliveryBadge}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="grid gap-4">
            {filteredOrders.map((order) => (
              <OrderCard 
                key={order.id} 
                order={order} 
                profile={profile} 
                user={user}
                onUpdateStatus={updateOrderStatus}
                onOpenDeliveryDialog={openDeliveryDialog}
                onSendWhatsApp={sendWhatsApp}
                getPaymentBadge={getPaymentBadge}
                getDeliveryBadge={getDeliveryBadge}
              />

            ))}
          </div>
        )}

        {profile?.role === "delivery" && filteredOrders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery ? "No se encontraron órdenes con ese criterio" : "No hay órdenes asignadas"}
          </div>
        )}
      </div>

      {/* Dialog for delivery updates */}
      <Dialog open={isDeliveryDialogOpen} onOpenChange={setIsDeliveryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar estado de entrega</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delivery_status">Estado de entrega</Label>
              <Select
                value={deliveryFormData.delivery_status}
                onValueChange={(value) => 
                  setDeliveryFormData({ 
                    ...deliveryFormData, 
                    delivery_status: value as "pending" | "in_transit" | "delivered"
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="pending">Por entregar</SelectItem>
                  <SelectItem value="in_transit">En camino</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery_notes">Notas de entrega</Label>
              <Textarea
                id="delivery_notes"
                placeholder="Agregar notas sobre la entrega..."
                value={deliveryFormData.delivery_notes}
                onChange={(e) => 
                  setDeliveryFormData({ ...deliveryFormData, delivery_notes: e.target.value })
                }
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha de entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deliveryFormData.delivery_date ? (
                      format(deliveryFormData.delivery_date, "PPP", { locale: es })
                    ) : (
                      <span>Seleccionar fecha</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={deliveryFormData.delivery_date}
                    onSelect={(date) => setDeliveryFormData({ ...deliveryFormData, delivery_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeliveryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDeliveryUpdate}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
