import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessageCircle, MapPin, MoreVertical, Edit, Trash2, Truck, CreditCard, User, CalendarIcon, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatAmount, getOrderAmounts } from "@/lib/format";

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

// Verde oscuro: el texto blanco se lee bien sobre él (el verde claro no alcanzaba contraste).
const PAY_BUTTON = "bg-[hsl(152,69%,28%)] hover:bg-[hsl(152,69%,24%)] text-white";

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
  // Monto principal = primera moneda; las demás se muestran como "+ otra moneda".
  const amounts = getOrderAmounts(order);
  const mainAmount = amounts[0]?.text ?? formatAmount(0, "USD");
  const extraAmounts = amounts.slice(1);

  const isAdminOrLocal = profile?.role === "admin" || profile?.role === "local";
  const isDeliveryOwner = profile?.role === "delivery" && order.assigned_to === user?.id;
  const isPaid = order.payment_status === "paid" || order.payment_status === "verified";
  const isDelivered = order.delivery_status === "delivered";

  const showPay = isAdminOrLocal && order.payment_status === "pending";
  const showDeliver = isAdminOrLocal && order.delivery_status !== "delivered";
  const deliverLabel = order.delivery_status === "pending" ? "En camino" : "Entregado";
  const deliverNext = order.delivery_status === "pending" ? "in_transit" : "delivered";

  // Un solo botón destacado: el siguiente paso (primero el pago, luego la entrega).
  const primary: "update" | "pay" | "deliver" | null = isDeliveryOwner
    ? "update"
    : showPay
    ? "pay"
    : showDeliver
    ? "deliver"
    : null;

  return (
    <div className="bg-card rounded-2xl shadow-fintech-md p-4 space-y-3 animate-fade-in">
      {/* Header: name + menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{order.customers.name}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground truncate">{order.customers.address}</p>
          </div>
        </div>

        {/* 3-dot menu for secondary actions */}
        {isAdminOrLocal && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Más opciones"
                className="h-11 w-11 -mt-1.5 -mr-2 flex-shrink-0 rounded-full"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              {onEditOrder && (
                <DropdownMenuItem onClick={() => onEditOrder(order)} className="py-3 text-sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
              )}
              {isPaid && (
                <DropdownMenuItem
                  onClick={() => onUpdateStatus(order.id, "payment_status", "pending")}
                  className="py-3 text-sm"
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  Revertir pago
                </DropdownMenuItem>
              )}
              {isDelivered && (
                <DropdownMenuItem
                  onClick={() => onUpdateStatus(order.id, "delivery_status", "pending")}
                  className="py-3 text-sm"
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  Revertir entrega
                </DropdownMenuItem>
              )}
              {onDeleteOrder && (
                <DropdownMenuItem
                  onClick={() => onDeleteOrder(order.id)}
                  className="py-3 text-sm text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Amount + status (el estado se muestra una sola vez: en las insignias) */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight tabular-nums">{mainAmount}</p>
          <p className="text-sm text-muted-foreground font-medium tabular-nums">{formatAmount(order.total_mxn, "MXN")}</p>
        </div>
        <div className="flex flex-col gap-1 items-end flex-shrink-0">
          {getPaymentBadge(order.payment_status)}
          {getDeliveryBadge(order.delivery_status)}
        </div>
      </div>

      {/* Detail chips */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-xs h-6 px-2.5 rounded-full font-medium">
          {order.price_type === "retail" ? "Menudeo" : order.price_type === "wholesale" ? "Mayoreo" : "Individual"}
        </Badge>
        {order.assigned_user && (
          <Badge variant="outline" className="text-xs h-6 px-2.5 rounded-full font-medium gap-1">
            <User className="h-3 w-3" />
            {order.assigned_user.full_name}
          </Badge>
        )}
        {order.delivery_date && (
          <Badge variant="outline" className="text-xs h-6 px-2.5 rounded-full font-medium gap-1">
            <CalendarIcon className="h-3 w-3" />
            {format(new Date(order.delivery_date), "d MMM", { locale: es })}
          </Badge>
        )}
        {extraAmounts.map((a) => (
          <Badge key={a.currency} variant="outline" className="text-xs h-6 px-2.5 rounded-full font-medium tabular-nums">
            + {a.text}
          </Badge>
        ))}
      </div>

      {order.delivery_notes && (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-xl px-3 py-2 italic">
          {order.delivery_notes}
        </p>
      )}

      {/* Acciones: arriba el siguiente paso, abajo las secundarias */}
      <div className="space-y-2 pt-1">
        {primary === "pay" && (
          <Button
            onClick={() => onUpdateStatus(order.id, "payment_status", "paid")}
            className={`w-full h-11 rounded-xl gap-2 text-sm font-semibold ${PAY_BUTTON}`}
          >
            <CreditCard className="h-4 w-4" />
            Marcar como pagado
          </Button>
        )}

        {primary === "deliver" && (
          <Button
            onClick={() => onUpdateStatus(order.id, "delivery_status", deliverNext)}
            className="w-full h-11 rounded-xl gap-2 text-sm font-semibold"
          >
            <Truck className="h-4 w-4" />
            {order.delivery_status === "pending" ? "Marcar en camino" : "Marcar como entregado"}
          </Button>
        )}

        {primary === "update" && (
          <Button
            onClick={() => onOpenDeliveryDialog(order)}
            className="w-full h-11 rounded-xl gap-2 text-sm font-semibold"
          >
            <Truck className="h-4 w-4" />
            Actualizar entrega
          </Button>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onSendWhatsApp(order)}
            className="flex-1 h-11 rounded-xl gap-2 text-sm font-medium"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>

          {/* Si falta el pago, la entrega sigue disponible pero como acción secundaria */}
          {primary === "pay" && showDeliver && (
            <Button
              variant="outline"
              onClick={() => onUpdateStatus(order.id, "delivery_status", deliverNext)}
              className="flex-1 h-11 rounded-xl gap-2 text-sm font-medium"
            >
              <Truck className="h-4 w-4" />
              {deliverLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
