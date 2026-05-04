import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessageCircle, MapPin, Check, MoreVertical, Edit, Trash2, Truck, CreditCard, User, CalendarIcon, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

interface OrderCardProps {
  order: Order;
  profile: Profile | null;
  user: any;
  onUpdateStatus: (orderId: string, field: "payment_status" | "delivery_status", value: string) => void;
  onOpenDeliveryDialog: (order: Order) => void;
  onSendWhatsApp: (order: Order) => void;
  onEditOrder?: (order: Order) => void;
  onDeleteOrder?: (orderId: string) => void;
  getPaymentBadge: (status: string) => JSX.Element;
  getDeliveryBadge: (status: string) => JSX.Element;
}

function OrderProgressTimeline({ paymentStatus, deliveryStatus }: { paymentStatus: string; deliveryStatus: string }) {
  const steps = [
    { label: "Pago", completed: paymentStatus === "paid" || paymentStatus === "verified", active: paymentStatus === "pending" },
    { label: "Entregado", completed: deliveryStatus === "delivered", active: (paymentStatus === "paid" || paymentStatus === "verified") && deliveryStatus !== "delivered" },
  ];

  return (
    <div className="flex items-center gap-1 w-full">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors ${
              step.completed
                ? "bg-success text-success-foreground"
                : step.active
                ? "bg-warning text-warning-foreground"
                : "bg-muted text-muted-foreground"
            }`}>
              {step.completed ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className="text-[10px] mt-1 text-muted-foreground font-medium">{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 -mt-4 mx-0.5 rounded-full ${
              step.completed ? "bg-success" : "bg-muted"
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

export function OrderCard({
  order,
  profile,
  user,
  onUpdateStatus,
  onOpenDeliveryDialog,
  onSendWhatsApp,
  onEditOrder,
  onDeleteOrder,
  getPaymentBadge,
  getDeliveryBadge,
}: OrderCardProps) {
  const mainAmount = order.usd_amount > 0
    ? `$${order.usd_amount.toFixed(2)} USD`
    : order.eur_amount > 0
    ? `€${order.eur_amount.toFixed(2)} EUR`
    : `$${order.cup_amount.toFixed(2)} CUP`;

  const secondaryAmounts = [
    order.usd_amount > 0 ? `$${order.usd_amount.toFixed(2)} USD` : null,
    order.eur_amount > 0 ? `€${order.eur_amount.toFixed(2)} EUR` : null,
    order.cup_amount > 0 ? `$${order.cup_amount.toFixed(2)} CUP` : null,
  ].filter(Boolean);

  const isAdminOrLocal = profile?.role === "admin" || profile?.role === "local";
  const isDeliveryOwner = profile?.role === "delivery" && order.assigned_to === user?.id;
  const isPaid = order.payment_status === "paid" || order.payment_status === "verified";
  const isDelivered = order.delivery_status === "delivered";

  return (
    <div className="bg-card rounded-2xl shadow-fintech-md p-4 space-y-3 animate-fade-in">
      {/* Header: name + menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{order.customers.name}</h3>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground truncate">{order.customers.address}</p>
          </div>
        </div>

        {/* 3-dot menu for secondary actions */}
        {isAdminOrLocal && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 min-h-0 flex-shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              {onEditOrder && (
                <DropdownMenuItem onClick={() => onEditOrder(order)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
              )}
              {isPaid && (
                <DropdownMenuItem onClick={() => onUpdateStatus(order.id, "payment_status", "pending")}>
                  <Undo2 className="h-4 w-4 mr-2" />
                  Revertir pago
                </DropdownMenuItem>
              )}
              {isDelivered && (
                <DropdownMenuItem onClick={() => onUpdateStatus(order.id, "delivery_status", "pending")}>
                  <Undo2 className="h-4 w-4 mr-2" />
                  Revertir entrega
                </DropdownMenuItem>
              )}
              {onDeleteOrder && (
                <DropdownMenuItem onClick={() => onDeleteOrder(order.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Amount section */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold tracking-tight">{mainAmount}</p>
          <p className="text-sm text-muted-foreground font-medium">${order.total_mxn.toFixed(2)} MXN</p>
        </div>
        <div className="flex flex-col gap-1 items-end">
          {getPaymentBadge(order.payment_status)}
          {getDeliveryBadge(order.delivery_status)}
        </div>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[10px] h-5 px-2 rounded-full font-medium">
          {order.price_type === "retail" ? "Menudeo" : order.price_type === "wholesale" ? "Mayoreo" : "Individual"}
        </Badge>
        {order.assigned_user && (
          <Badge variant="outline" className="text-[10px] h-5 px-2 rounded-full font-medium gap-1">
            <User className="h-2.5 w-2.5" />
            {order.assigned_user.full_name}
          </Badge>
        )}
        {order.delivery_date && (
          <Badge variant="outline" className="text-[10px] h-5 px-2 rounded-full font-medium gap-1">
            <CalendarIcon className="h-2.5 w-2.5" />
            {format(new Date(order.delivery_date), "d MMM", { locale: es })}
          </Badge>
        )}
        {secondaryAmounts.length > 1 && (
          <Badge variant="outline" className="text-[10px] h-5 px-2 rounded-full font-medium">
            {secondaryAmounts.join(" · ")}
          </Badge>
        )}
      </div>

      {/* Progress timeline */}
      <OrderProgressTimeline paymentStatus={order.payment_status} deliveryStatus={order.delivery_status} />

      {order.delivery_notes && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2 italic">
          {order.delivery_notes}
        </p>
      )}

      {/* Primary quick actions */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSendWhatsApp(order)}
          className="flex-1 h-10 rounded-xl gap-1.5 text-xs font-medium"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>

        {isAdminOrLocal && order.payment_status === "pending" && (
          <Button
            size="sm"
            onClick={() => onUpdateStatus(order.id, "payment_status", "paid")}
            className="flex-1 h-10 rounded-xl gap-1.5 text-xs font-medium bg-success hover:bg-success/90 text-success-foreground"
          >
            <CreditCard className="h-4 w-4" />
            Pagado
          </Button>
        )}

        {isAdminOrLocal && order.delivery_status !== "delivered" && (
          <Button
            size="sm"
            onClick={() => onUpdateStatus(order.id, "delivery_status", order.delivery_status === "pending" ? "in_transit" : "delivered")}
            className="flex-1 h-10 rounded-xl gap-1.5 text-xs font-medium"
          >
            <Truck className="h-4 w-4" />
            {order.delivery_status === "pending" ? "En camino" : "Entregado"}
          </Button>
        )}

        {isDeliveryOwner && (
          <Button
            size="sm"
            onClick={() => onOpenDeliveryDialog(order)}
            className="flex-1 h-10 rounded-xl gap-1.5 text-xs font-medium"
          >
            <Truck className="h-4 w-4" />
            Actualizar
          </Button>
        )}
      </div>
    </div>
  );
}
