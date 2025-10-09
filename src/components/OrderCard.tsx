import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, MapPin, DollarSign, User, CalendarIcon } from "lucide-react";
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
  getPaymentBadge: (status: string) => JSX.Element;
  getDeliveryBadge: (status: string) => JSX.Element;
}

export function OrderCard({
  order,
  profile,
  user,
  onUpdateStatus,
  onOpenDeliveryDialog,
  onSendWhatsApp,
  getPaymentBadge,
  getDeliveryBadge,
}: OrderCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-lg">{order.customers.name}</CardTitle>
            <div className="flex flex-wrap gap-2">
              {getPaymentBadge(order.payment_status)}
              {getDeliveryBadge(order.delivery_status)}
              <Badge variant="outline" className="text-xs">
                {order.price_type === "retail" ? "Menudeo" : "Mayoreo"}
              </Badge>
            </div>
          </div>
          {order.assigned_user && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>
                Asignado a: {order.assigned_user.full_name} 
                ({order.assigned_user.role === "local" ? "Local" : "Repartidor"})
              </span>
            </div>
          )}
          {order.delivery_date && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
              <span>
                Fecha de entrega: {format(new Date(order.delivery_date), "PPP", { locale: es })}
              </span>
            </div>
          )}
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

        {order.delivery_notes && (
          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm font-medium mb-1">Notas de entrega:</p>
            <p className="text-sm text-muted-foreground">{order.delivery_notes}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => onSendWhatsApp(order)}
            className="gap-2"
            variant="outline"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>

          {(profile?.role === "admin" || profile?.role === "local") && (
            <>
              <Select
                value={order.payment_status}
                onValueChange={(value) => onUpdateStatus(order.id, "payment_status", value)}
              >
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="pending">Pendiente pago</SelectItem>
                  <SelectItem value="paid">Pagado</SelectItem>
                  <SelectItem value="verified">Verificado</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={order.delivery_status}
                onValueChange={(value) => onUpdateStatus(order.id, "delivery_status", value)}
              >
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="pending">Por entregar</SelectItem>
                  <SelectItem value="in_transit">En camino</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}

          {profile?.role === "delivery" && order.assigned_to === user?.id && (
            <Button
              size="sm"
              onClick={() => onOpenDeliveryDialog(order)}
              variant="default"
            >
              Actualizar entrega
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
