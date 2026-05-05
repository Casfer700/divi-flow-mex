import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendTelegramNotification } from "@/lib/telegram";
import { Layout } from "@/components/Layout";
import { OrderCard } from "@/components/OrderCard";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Search, Package, Users, ArrowLeftRight, TrendingUp, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
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
    delivery_notes: "",
  });
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

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
      .select(`*, customers (*), assigned_user:profiles!orders_assigned_to_fkey (id, full_name, role)`)
      .order("created_at", { ascending: false });
    if (error) { toast.error("Error al cargar órdenes"); return; }
    setOrders((data || []) as Order[]);
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase.from("customers").select("*").order("name");
    if (error) { toast.error("Error al cargar clientes"); return; }
    setCustomers(data || []);
  };

  const fetchUsers = async () => {
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles").select("user_id, role").in("role", ["local", "delivery"]);
    if (rolesError || !rolesData || rolesData.length === 0) { setUsers([]); return; }
    const userIds = rolesData.map(r => r.user_id);
    const { data: profilesData } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    const transformedData = rolesData.map((roleItem) => {
      const p = profilesData?.find(p => p.id === roleItem.user_id);
      return { id: roleItem.user_id, full_name: p?.full_name || "Usuario", role: roleItem.role };
    });
    setUsers(transformedData);
  };

  const fetchRates = async () => {
    const { data, error } = await supabase.from("exchange_rates").select("*");
    if (error) { toast.error("Error al cargar tasas"); return; }
    setRates(data || []);
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase.from("whatsapp_templates").select("*");
    if (error) { toast.error("Error al cargar plantillas"); return; }
    setTemplates(data || []);
  };

  const calculateTotal = () => {
    if (!formData.usd_amount && !formData.eur_amount && !formData.cup_amount) return;
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
      if (rate && rate.sell_rate > 0) total += parseFloat(formData.cup_amount) / rate.sell_rate;
    }
    setFormData(prev => ({ ...prev, total_mxn: total.toFixed(2) }));
  };

  const validateStock = async (usd: number, eur: number, cup: number): Promise<{ valid: boolean; message?: string }> => {
    const { data: movements, error } = await supabase.from("inventory_movements").select("currency, amount, movement_type");
    if (error) return { valid: false, message: "Error al verificar inventario" };
    const balances: Record<string, number> = { USD: 0, EUR: 0, CUP: 0 };
    (movements || []).forEach((m) => {
      if (m.movement_type === "in" || m.movement_type === "adjustment") balances[m.currency] = (balances[m.currency] || 0) + Number(m.amount);
      else if (m.movement_type === "out") balances[m.currency] = (balances[m.currency] || 0) - Number(m.amount);
    });
    const errors: string[] = [];
    if (usd > 0 && usd > balances.USD) errors.push(`USD: disponible $${balances.USD.toFixed(2)}, solicitado $${usd.toFixed(2)}`);
    if (eur > 0 && eur > balances.EUR) errors.push(`EUR: disponible €${balances.EUR.toFixed(2)}, solicitado €${eur.toFixed(2)}`);
    if (cup > 0 && cup > balances.CUP) errors.push(`CUP: disponible $${balances.CUP.toFixed(2)}, solicitado $${cup.toFixed(2)}`);
    if (errors.length > 0) return { valid: false, message: `Stock insuficiente:\n${errors.join("\n")}` };
    return { valid: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const usdAmount = parseFloat(formData.usd_amount) || 0;
    const eurAmount = parseFloat(formData.eur_amount) || 0;
    const cupAmount = parseFloat(formData.cup_amount) || 0;
    const stockCheck = await validateStock(usdAmount, eurAmount, cupAmount);
    if (!stockCheck.valid) { toast.error(stockCheck.message || "Stock insuficiente"); return; }
    const { error } = await supabase.from("orders").insert([{
      customer_id: formData.customer_id,
      usd_amount: usdAmount, eur_amount: eurAmount, cup_amount: cupAmount,
      total_mxn: parseFloat(formData.total_mxn), price_type: formData.price_type,
      assigned_to: formData.assigned_to || null,
      delivery_date: formData.delivery_date?.toISOString() || null,
      delivery_notes: formData.delivery_notes || null, created_by: user?.id,
    }]);
    if (error) { toast.error("Error al crear orden"); return; }
    toast.success("Orden creada");
    setIsDialogOpen(false);
    resetForm();
    fetchOrders();
  };

  const resetForm = () => {
    setFormData({ customer_id: "", usd_amount: "", eur_amount: "", cup_amount: "", total_mxn: "", price_type: "retail", assigned_to: "", delivery_date: undefined, delivery_notes: "" });
  };

  const updateOrderStatus = async (orderId: string, field: "payment_status" | "delivery_status", value: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const previousDeliveryStatus = order.delivery_status;

    if (field === "delivery_status" && value === "delivered" && previousDeliveryStatus !== "delivered") {
      const stockCheck = await validateStock(order.usd_amount, order.eur_amount, order.cup_amount);
      if (!stockCheck.valid) { toast.error(stockCheck.message || "Stock insuficiente para marcar como entregada"); return; }
    }

    const { error } = await supabase.from("orders").update({ [field]: value }).eq("id", orderId);
    if (error) { toast.error("Error al actualizar estado"); return; }

    if (field === "delivery_status" && value === "delivered" && previousDeliveryStatus !== "delivered") {
      await deductInventory(order, orderId);
    }
    if (field === "delivery_status" && previousDeliveryStatus === "delivered" && value !== "delivered") {
      await revertInventory(order, orderId);
    }

    toast.success("Estado actualizado");
    fetchOrders();
  };

  const deductInventory = async (order: Order, orderId: string) => {
    const movements = [];
    if (order.usd_amount > 0) movements.push({ currency: "USD", amount: order.usd_amount, movement_type: "out", notes: `Entrega orden #${orderId.slice(0, 8)}`, reference_id: orderId, reference_type: "order", created_by: user?.id });
    if (order.eur_amount > 0) movements.push({ currency: "EUR", amount: order.eur_amount, movement_type: "out", notes: `Entrega orden #${orderId.slice(0, 8)}`, reference_id: orderId, reference_type: "order", created_by: user?.id });
    if (order.cup_amount > 0) movements.push({ currency: "CUP", amount: order.cup_amount, movement_type: "out", notes: `Entrega orden #${orderId.slice(0, 8)}`, reference_id: orderId, reference_type: "order", created_by: user?.id });
    if (movements.length > 0) {
      const { error } = await supabase.from("inventory_movements").insert(movements);
      if (error) toast.warning("Error al descontar inventario");
    }
  };

  const revertInventory = async (order: Order, orderId: string) => {
    const movements = [];
    if (order.usd_amount > 0) movements.push({ currency: "USD", amount: order.usd_amount, movement_type: "in", notes: `Reversión orden #${orderId.slice(0, 8)}`, reference_id: orderId, reference_type: "order_reversal", created_by: user?.id });
    if (order.eur_amount > 0) movements.push({ currency: "EUR", amount: order.eur_amount, movement_type: "in", notes: `Reversión orden #${orderId.slice(0, 8)}`, reference_id: orderId, reference_type: "order_reversal", created_by: user?.id });
    if (order.cup_amount > 0) movements.push({ currency: "CUP", amount: order.cup_amount, movement_type: "in", notes: `Reversión orden #${orderId.slice(0, 8)}`, reference_id: orderId, reference_type: "order_reversal", created_by: user?.id });
    if (movements.length > 0) {
      const { error } = await supabase.from("inventory_movements").insert(movements);
      if (error) toast.warning("Error al revertir inventario");
    }
  };

  const openDeliveryDialog = (order: Order) => {
    setSelectedOrder(order);
    setDeliveryFormData({ delivery_status: order.delivery_status, delivery_notes: order.delivery_notes || "", delivery_date: order.delivery_date ? new Date(order.delivery_date) : undefined });
    setIsDeliveryDialogOpen(true);
  };

  const handleDeliveryUpdate = async () => {
    if (!selectedOrder) return;
    const previousDeliveryStatus = selectedOrder.delivery_status;
    const newDeliveryStatus = deliveryFormData.delivery_status;

    if (newDeliveryStatus === "delivered" && previousDeliveryStatus !== "delivered") {
      const stockCheck = await validateStock(selectedOrder.usd_amount, selectedOrder.eur_amount, selectedOrder.cup_amount);
      if (!stockCheck.valid) { toast.error(stockCheck.message || "Stock insuficiente"); return; }
    }

    const { error } = await supabase.from("orders").update({
      delivery_status: newDeliveryStatus,
      delivery_notes: deliveryFormData.delivery_notes,
      delivery_date: deliveryFormData.delivery_date?.toISOString() || null,
    }).eq("id", selectedOrder.id);

    if (error) { toast.error("Error al actualizar entrega"); return; }

    if (newDeliveryStatus === "delivered" && previousDeliveryStatus !== "delivered") {
      await deductInventory(selectedOrder, selectedOrder.id);
    }
    if (previousDeliveryStatus === "delivered" && newDeliveryStatus !== "delivered") {
      await revertInventory(selectedOrder, selectedOrder.id);
    }

    toast.success("Entrega actualizada");
    setIsDeliveryDialogOpen(false);
    setSelectedOrder(null);
    fetchOrders();
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("¿Estás seguro de eliminar esta orden?")) return;
    const orderToDelete = orders.find(o => o.id === orderId);
    if (!orderToDelete) { toast.error("Orden no encontrada"); return; }
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) { toast.error("Error al eliminar orden"); return; }
    if (orderToDelete.delivery_status === "delivered") {
      await revertInventory(orderToDelete, orderId);
      toast.success("Orden eliminada e inventario revertido");
    } else {
      toast.success("Orden eliminada");
    }
    fetchOrders();
  };

  const openEditDialog = (order: Order) => {
    setEditingOrder(order);
    setFormData({
      customer_id: order.customer_id, usd_amount: order.usd_amount.toString(),
      eur_amount: order.eur_amount.toString(), cup_amount: order.cup_amount.toString(),
      total_mxn: order.total_mxn.toString(), price_type: order.price_type,
      assigned_to: order.assigned_to || "",
      delivery_date: order.delivery_date ? new Date(order.delivery_date) : undefined,
      delivery_notes: order.delivery_notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    const newUsd = parseFloat(formData.usd_amount) || 0;
    const newEur = parseFloat(formData.eur_amount) || 0;
    const newCup = parseFloat(formData.cup_amount) || 0;
    const usdDiff = newUsd - editingOrder.usd_amount;
    const eurDiff = newEur - editingOrder.eur_amount;
    const cupDiff = newCup - editingOrder.cup_amount;

    if (editingOrder.delivery_status === "delivered" && (usdDiff > 0 || eurDiff > 0 || cupDiff > 0)) {
      const stockCheck = await validateStock(usdDiff > 0 ? usdDiff : 0, eurDiff > 0 ? eurDiff : 0, cupDiff > 0 ? cupDiff : 0);
      if (!stockCheck.valid) { toast.error(stockCheck.message || "Stock insuficiente"); return; }
    }

    const { error } = await supabase.from("orders").update({
      customer_id: formData.customer_id, usd_amount: newUsd, eur_amount: newEur, cup_amount: newCup,
      total_mxn: parseFloat(formData.total_mxn), price_type: formData.price_type,
      assigned_to: formData.assigned_to || null,
      delivery_date: formData.delivery_date?.toISOString() || null,
      delivery_notes: formData.delivery_notes || null,
    }).eq("id", editingOrder.id);

    if (error) { toast.error("Error al actualizar orden"); return; }

    if (editingOrder.delivery_status === "delivered") {
      const inventoryMovements: any[] = [];
      if (usdDiff !== 0) inventoryMovements.push({ currency: "USD", amount: Math.abs(usdDiff), movement_type: usdDiff > 0 ? "out" : "in", notes: `Ajuste orden #${editingOrder.id.slice(0, 8)}`, reference_id: editingOrder.id, reference_type: "order_adjustment", created_by: user?.id });
      if (eurDiff !== 0) inventoryMovements.push({ currency: "EUR", amount: Math.abs(eurDiff), movement_type: eurDiff > 0 ? "out" : "in", notes: `Ajuste orden #${editingOrder.id.slice(0, 8)}`, reference_id: editingOrder.id, reference_type: "order_adjustment", created_by: user?.id });
      if (cupDiff !== 0) inventoryMovements.push({ currency: "CUP", amount: Math.abs(cupDiff), movement_type: cupDiff > 0 ? "out" : "in", notes: `Ajuste orden #${editingOrder.id.slice(0, 8)}`, reference_id: editingOrder.id, reference_type: "order_adjustment", created_by: user?.id });
      if (inventoryMovements.length > 0) {
        const { error: invError } = await supabase.from("inventory_movements").insert(inventoryMovements);
        if (invError) toast.warning("Error al ajustar inventario");
      }
    }

    toast.success("Orden actualizada");
    setIsEditDialogOpen(false);
    setEditingOrder(null);
    resetForm();
    fetchOrders();
  };

  const sendWhatsApp = (order: Order) => {
    const template = templates.find(t => t.name === "default_order");
    if (!template) { toast.error("No hay plantilla configurada"); return; }
    const currencyAmounts = [
      order.usd_amount > 0 ? `USD: $${order.usd_amount.toFixed(2)}` : null,
      order.eur_amount > 0 ? `EUR: €${order.eur_amount.toFixed(2)}` : null,
      order.cup_amount > 0 ? `CUP: $${order.cup_amount.toFixed(2)}` : null,
    ].filter(Boolean).join("\n");
    const paymentLabels: Record<string, string> = { pending: "Pendiente", paid: "Pagado" };
    const deliveryLabels: Record<string, string> = { pending: "Pendiente", in_transit: "En tránsito", delivered: "Entregado" };
    let message = template.template
      .replace("{customer_name}", order.customers.name)
      .replace("{currency_amounts}", currencyAmounts)
      .replace("{total_mxn}", order.total_mxn.toFixed(2))
      .replace("{address}", order.customers.address)
      .replace("{phone_mx}", order.customers.phone_mx)
      .replace("{payment_status}", paymentLabels[order.payment_status])
      .replace("{delivery_status}", deliveryLabels[order.delivery_status]);
    const phone = order.customers.phone_mx.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const getPaymentBadge = (status: string) => {
    const config: Record<string, { label: string; bg: string }> = {
      pending: { label: "Pendiente", bg: "hsl(0, 72%, 55%)" },
      paid: { label: "✓ Pagado", bg: "hsl(152, 69%, 41%)" },
      verified: { label: "✓ Pagado", bg: "hsl(152, 69%, 41%)" },
    };
    const c = config[status] || config.pending;
    return <Badge className="border-0 text-[10px] h-5 px-2 rounded-full font-medium" style={{ backgroundColor: c.bg, color: "white" }}>{c.label}</Badge>;
  };

  const getDeliveryBadge = (status: string) => {
    const config: Record<string, { label: string; bg: string }> = {
      pending: { label: "Por entregar", bg: "hsl(38, 92%, 50%)" },
      in_transit: { label: "En camino", bg: "hsl(262, 52%, 51%)" },
      delivered: { label: "✓ Entregado", bg: "hsl(152, 69%, 41%)" },
    };
    const c = config[status] || config.pending;
    return <Badge className="border-0 text-[10px] h-5 px-2 rounded-full font-medium" style={{ backgroundColor: c.bg, color: "white" }}>{c.label}</Badge>;
  };

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return order.customers.name.toLowerCase().includes(q) || order.customers.address.toLowerCase().includes(q) || order.customers.phone_mx.includes(q);
  });

  const localOrders = filteredOrders.filter(order => !order.assigned_to || order.assigned_user?.role === "local");
  const deliveryOrders = filteredOrders.filter(order => order.assigned_user?.role === "delivery");

  // Today's stats
  const today = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.delivery_date || "").toDateString() === today || new Date().toDateString() === today);
  const totalToday = orders.length;
  const deliveredToday = orders.filter(o => o.delivery_status === "delivered").length;
  const pendingToday = orders.filter(o => o.delivery_status === "pending").length;

  const isAdminOrLocal = profile?.role === "admin" || profile?.role === "local";

  const fabActions = [
    ...(isAdminOrLocal ? [
      { label: "Nueva orden", icon: <Package className="h-5 w-5" />, onClick: () => { resetForm(); setIsDialogOpen(true); } },
      { label: "Nuevo cliente", icon: <Users className="h-5 w-5" />, onClick: () => navigate("/customers") },
    ] : []),
    ...(profile?.role === "admin" ? [
      { label: "Movimiento de divisa", icon: <ArrowLeftRight className="h-5 w-5" />, onClick: () => navigate("/admin") },
      { label: "Tasas de cambio", icon: <TrendingUp className="h-5 w-5" />, onClick: () => navigate("/admin") },
    ] : []),
  ];

  const selectedCustomer = customers.find((c) => c.id === formData.customer_id);

  const getRetailRates = () => {
    const retailRates: Record<string, number> = {};
    const type = formData.price_type || "retail";
    ["USD", "EUR", "CUP"].forEach((cur) => {
      const rate = rates.find((r) => r.currency === cur && r.rate_type === type);
      if (rate) retailRates[cur] = rate.sell_rate;
    });
    return retailRates;
  };

  const renderOrderForm = (onSubmit: (e: React.FormEvent) => void, title: string, submitLabel: string) => {
    const currentRates = getRetailRates();
    return (
    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
      <DialogHeader>
        <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente</Label>
          <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between h-12 rounded-xl">
                {formData.customer_id ? customers.find((c) => c.id === formData.customer_id)?.name : "Buscar cliente..."}
                <Search className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar..." />
                <CommandList>
                  <CommandEmpty>Sin resultados.</CommandEmpty>
                  <CommandGroup>
                    {customers.map((customer) => (
                      <CommandItem key={customer.id} value={`${customer.name} ${customer.address} ${customer.phone_mx}`}
                        onSelect={() => { setFormData({ ...formData, customer_id: customer.id }); setCustomerSearchOpen(false); }}>
                        <div className="flex flex-col">
                          <span className="font-medium">{customer.name}</span>
                          <span className="text-xs text-muted-foreground">{customer.address}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Quick address edit when customer is selected */}
        {selectedCustomer && (
          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dirección</Label>
            <Input
              value={selectedCustomer.address}
              onChange={async (e) => {
                const newAddr = e.target.value;
                setCustomers((prev) => prev.map((c) => c.id === selectedCustomer.id ? { ...c, address: newAddr } : c));
              }}
              onBlur={async () => {
                await supabase.from("customers").update({ address: selectedCustomer.address }).eq("id", selectedCustomer.id);
              }}
              className="h-10 rounded-xl text-sm"
              placeholder="Dirección del cliente"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo de precio</Label>
          <Select value={formData.price_type} onValueChange={(v) => setFormData({ ...formData, price_type: v })}>
            <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="retail">Menudeo</SelectItem>
              <SelectItem value="wholesale">Mayoreo</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Show current rates for selected price type */}
        {(currentRates.USD || currentRates.EUR || currentRates.CUP) && (
          <div className="bg-muted/40 rounded-xl p-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">Precios:</span>
            {currentRates.USD > 0 && <span>USD: <strong className="text-foreground">${currentRates.USD.toFixed(2)}</strong></span>}
            {currentRates.EUR > 0 && <span>EUR: <strong className="text-foreground">${currentRates.EUR.toFixed(2)}</strong></span>}
            {currentRates.CUP > 0 && <span>CUP: <strong className="text-foreground">1/{currentRates.CUP.toFixed(2)}</strong></span>}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {[{ id: "usd", label: "USD", key: "usd_amount" }, { id: "eur", label: "EUR", key: "eur_amount" }, { id: "cup", label: "CUP", key: "cup_amount" }].map(c => (
            <div key={c.id} className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">{c.label}</Label>
              <Input type="number" step="0.01" value={(formData as any)[c.key]}
                onChange={(e) => setFormData({ ...formData, [c.key]: e.target.value })}
                className="h-12 rounded-xl text-center font-semibold" />
            </div>
          ))}
        </div>

        <div className="bg-primary/5 rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Total MXN</p>
          <p className="text-2xl font-bold text-primary">${formData.total_mxn || "0.00"}</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Asignar a</Label>
          <Select value={formData.assigned_to} onValueChange={(v) => setFormData({ ...formData, assigned_to: v })}>
            <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
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
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha de entrega</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-12 rounded-xl justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.delivery_date ? format(formData.delivery_date, "PPP", { locale: es }) : <span className="text-muted-foreground">Seleccionar fecha</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={formData.delivery_date} onSelect={(date) => setFormData({ ...formData, delivery_date: date })} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notas</Label>
          <Textarea placeholder="Notas opcionales..." value={formData.delivery_notes}
            onChange={(e) => setFormData({ ...formData, delivery_notes: e.target.value })} rows={2} className="rounded-xl" />
        </div>

        <Button type="submit" className="w-full h-12 rounded-xl font-semibold">{submitLabel}</Button>
      </form>
    </DialogContent>
  );
  };

  return (
    <Layout>
      <div className="space-y-4">
        {/* Stats row - only for admin/local */}
        {isAdminOrLocal && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card rounded-xl p-3 shadow-fintech-sm text-center">
              <p className="text-2xl font-bold">{totalToday}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Total</p>
            </div>
            <div className="bg-card rounded-xl p-3 shadow-fintech-sm text-center">
              <p className="text-2xl font-bold text-success">{deliveredToday}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Entregadas</p>
            </div>
            <div className="bg-card rounded-xl p-3 shadow-fintech-sm text-center">
              <p className="text-2xl font-bold text-warning">{pendingToday}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Pendientes</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, dirección..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl bg-card border-0 shadow-fintech-sm"
          />
        </div>

        {/* Orders */}
        {isAdminOrLocal ? (
          <Tabs defaultValue="local" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-11 rounded-xl bg-secondary p-1">
              <TabsTrigger value="local" className="rounded-lg text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-fintech-sm">
                Local ({localOrders.length})
              </TabsTrigger>
              <TabsTrigger value="delivery" className="rounded-lg text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-fintech-sm">
                Delivery ({deliveryOrders.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="local" className="space-y-3 mt-3">
              {localOrders.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  {searchQuery ? "Sin resultados" : "No hay órdenes locales"}
                </div>
              ) : localOrders.map((order) => (
                <OrderCard key={order.id} order={order} profile={profile} user={user}
                  onUpdateStatus={updateOrderStatus} onOpenDeliveryDialog={openDeliveryDialog}
                  onSendWhatsApp={sendWhatsApp} onEditOrder={openEditDialog} onDeleteOrder={handleDeleteOrder}
                  getPaymentBadge={getPaymentBadge} getDeliveryBadge={getDeliveryBadge} />
              ))}
            </TabsContent>
            <TabsContent value="delivery" className="space-y-3 mt-3">
              {deliveryOrders.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  {searchQuery ? "Sin resultados" : "No hay órdenes delivery"}
                </div>
              ) : deliveryOrders.map((order) => (
                <OrderCard key={order.id} order={order} profile={profile} user={user}
                  onUpdateStatus={updateOrderStatus} onOpenDeliveryDialog={openDeliveryDialog}
                  onSendWhatsApp={sendWhatsApp} onEditOrder={openEditDialog} onDeleteOrder={handleDeleteOrder}
                  getPaymentBadge={getPaymentBadge} getDeliveryBadge={getDeliveryBadge} />
              ))}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                {searchQuery ? "Sin resultados" : "No hay órdenes asignadas"}
              </div>
            ) : filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} profile={profile} user={user}
                onUpdateStatus={updateOrderStatus} onOpenDeliveryDialog={openDeliveryDialog}
                onSendWhatsApp={sendWhatsApp} onEditOrder={openEditDialog} onDeleteOrder={handleDeleteOrder}
                getPaymentBadge={getPaymentBadge} getDeliveryBadge={getDeliveryBadge} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      {fabActions.length > 0 && <FloatingActionButton actions={fabActions} />}

      {/* New order dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {renderOrderForm(handleSubmit, "Nueva orden", "Crear orden")}
      </Dialog>

      {/* Edit order dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        {renderOrderForm(handleEditSubmit, "Editar orden", "Guardar cambios")}
      </Dialog>

      {/* Delivery update dialog */}
      <Dialog open={isDeliveryDialogOpen} onOpenChange={setIsDeliveryDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Actualizar entrega</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</Label>
              <Select value={deliveryFormData.delivery_status}
                onValueChange={(v) => setDeliveryFormData({ ...deliveryFormData, delivery_status: v as any })}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="pending">Por entregar</SelectItem>
                  <SelectItem value="in_transit">En camino</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notas</Label>
              <Textarea placeholder="Notas de entrega..." value={deliveryFormData.delivery_notes}
                onChange={(e) => setDeliveryFormData({ ...deliveryFormData, delivery_notes: e.target.value })} rows={3} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-12 rounded-xl justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deliveryFormData.delivery_date ? format(deliveryFormData.delivery_date, "PPP", { locale: es }) : <span className="text-muted-foreground">Seleccionar fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={deliveryFormData.delivery_date}
                    onSelect={(date) => setDeliveryFormData({ ...deliveryFormData, delivery_date: date })} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeliveryDialogOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleDeliveryUpdate} className="rounded-xl">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
