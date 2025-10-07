import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Calendar } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Order {
  id: string;
  customer_id: string;
  usd_amount: number;
  eur_amount: number;
  cup_amount: number;
  total_mxn: number;
  payment_status: string;
  delivery_status: string;
  price_type: string;
  created_at: string;
  customers: {
    name: string;
    address: string;
    phone_mx: string;
  };
}

interface ReportSummary {
  totalOrders: number;
  totalMXN: number;
  totalUSD: number;
  totalEUR: number;
  totalCUP: number;
  paidOrders: number;
  pendingOrders: number;
  deliveredOrders: number;
}

export function ReportsManager() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportType, setReportType] = useState<"all" | "paid" | "pending">("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const { toast } = useToast();

  const generateReport = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Selecciona un rango de fechas",
        variant: "destructive",
      });
      return;
    }

    let query = supabase
      .from("orders")
      .select(
        `
        *,
        customers (
          name,
          address,
          phone_mx
        )
      `
      )
      .gte("created_at", new Date(startDate).toISOString())
      .lte("created_at", new Date(endDate + "T23:59:59").toISOString())
      .order("created_at", { ascending: false });

    if (reportType === "paid") {
      query = query.eq("payment_status", "paid");
    } else if (reportType === "pending") {
      query = query.eq("payment_status", "pending");
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo generar el reporte",
        variant: "destructive",
      });
      return;
    }

    setOrders(data as Order[]);

    // Calculate summary
    const reportSummary: ReportSummary = {
      totalOrders: data.length,
      totalMXN: data.reduce((sum, order) => sum + Number(order.total_mxn), 0),
      totalUSD: data.reduce((sum, order) => sum + Number(order.usd_amount), 0),
      totalEUR: data.reduce((sum, order) => sum + Number(order.eur_amount), 0),
      totalCUP: data.reduce((sum, order) => sum + Number(order.cup_amount), 0),
      paidOrders: data.filter((o) => o.payment_status === "paid").length,
      pendingOrders: data.filter((o) => o.payment_status === "pending").length,
      deliveredOrders: data.filter((o) => o.delivery_status === "delivered")
        .length,
    };

    setSummary(reportSummary);

    toast({
      title: "Éxito",
      description: `Reporte generado con ${data.length} órdenes`,
    });
  };

  const exportToPDF = () => {
    if (!summary || orders.length === 0) {
      toast({
        title: "Error",
        description: "Primero genera un reporte",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text("Reporte de Órdenes", 14, 20);

    // Date range
    doc.setFontSize(11);
    doc.text(`Período: ${startDate} al ${endDate}`, 14, 30);
    doc.text(`Tipo: ${reportType === "all" ? "Todas" : reportType === "paid" ? "Pagadas" : "Pendientes"}`, 14, 36);

    // Summary
    doc.setFontSize(14);
    doc.text("Resumen", 14, 46);
    doc.setFontSize(10);
    
    const summaryData = [
      ["Total de órdenes", summary.totalOrders.toString()],
      ["Total MXN", `$${summary.totalMXN.toFixed(2)}`],
      ["Total USD", `$${summary.totalUSD.toFixed(2)}`],
      ["Total EUR", `€${summary.totalEUR.toFixed(2)}`],
      ["Total CUP", `${summary.totalCUP.toFixed(2)}`],
      ["Órdenes pagadas", summary.paidOrders.toString()],
      ["Órdenes pendientes", summary.pendingOrders.toString()],
      ["Órdenes entregadas", summary.deliveredOrders.toString()],
    ];

    autoTable(doc, {
      startY: 50,
      head: [["Concepto", "Valor"]],
      body: summaryData,
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Orders table
    const finalY = (doc as any).lastAutoTable.finalY || 50;
    doc.setFontSize(14);
    doc.text("Detalle de Órdenes", 14, finalY + 10);

    const orderData = orders.map((order) => [
      new Date(order.created_at).toLocaleDateString("es-MX"),
      order.customers.name,
      `$${Number(order.usd_amount).toFixed(2)} USD`,
      `€${Number(order.eur_amount).toFixed(2)} EUR`,
      `${Number(order.cup_amount).toFixed(2)} CUP`,
      `$${Number(order.total_mxn).toFixed(2)} MXN`,
      order.payment_status === "paid" ? "Pagado" : "Pendiente",
      order.delivery_status === "delivered" ? "Entregado" : order.delivery_status === "in_transit" ? "En tránsito" : "Pendiente",
    ]);

    autoTable(doc, {
      startY: finalY + 15,
      head: [["Fecha", "Cliente", "USD", "EUR", "CUP", "Total MXN", "Pago", "Entrega"]],
      body: orderData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
    });

    // Save PDF
    const fileName = `reporte_${startDate}_${endDate}.pdf`;
    doc.save(fileName);

    toast({
      title: "Éxito",
      description: `PDF exportado como ${fileName}`,
    });
  };

  const exportToJSON = () => {
    if (!summary || orders.length === 0) {
      toast({
        title: "Error",
        description: "Primero genera un reporte",
        variant: "destructive",
      });
      return;
    }

    const data = {
      metadata: {
        startDate,
        endDate,
        reportType,
        generatedAt: new Date().toISOString(),
      },
      summary,
      orders,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `respaldo_${startDate}_${endDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Éxito",
      description: "Respaldo exportado correctamente",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reportes y Cortes</CardTitle>
        <CardDescription>
          Genera reportes por fecha y exporta la información
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="startDate">Fecha inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Fecha fin</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reportType">Tipo de reporte</Label>
              <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las órdenes</SelectItem>
                  <SelectItem value="paid">Solo pagadas</SelectItem>
                  <SelectItem value="pending">Solo pendientes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate button */}
          <Button onClick={generateReport} className="w-full">
            <FileText className="w-4 h-4 mr-2" />
            Generar Reporte
          </Button>

          {/* Summary */}
          {summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Órdenes</CardDescription>
                    <CardTitle className="text-2xl">{summary.totalOrders}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total MXN</CardDescription>
                    <CardTitle className="text-2xl">
                      ${summary.totalMXN.toFixed(2)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Pagadas</CardDescription>
                    <CardTitle className="text-2xl">{summary.paidOrders}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Entregadas</CardDescription>
                    <CardTitle className="text-2xl">
                      {summary.deliveredOrders}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total USD</CardDescription>
                    <CardTitle className="text-xl">
                      ${summary.totalUSD.toFixed(2)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total EUR</CardDescription>
                    <CardTitle className="text-xl">
                      €{summary.totalEUR.toFixed(2)}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total CUP</CardDescription>
                    <CardTitle className="text-xl">
                      {summary.totalCUP.toFixed(2)}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Export buttons */}
              <div className="flex gap-2">
                <Button onClick={exportToPDF} variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar PDF
                </Button>
                <Button onClick={exportToJSON} variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Respaldo JSON
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}