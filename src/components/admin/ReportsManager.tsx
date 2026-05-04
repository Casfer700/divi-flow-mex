import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Download } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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
  customers: { name: string; address: string; phone_mx: string };
  created_at: string;
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

interface ExpenseBreakdown {
  source: string;
  currency: string;
  total: number;
  count: number;
}

const EXPENSE_SOURCE_LABEL: Record<string, string> = {
  manual: "Manuales",
  commission: "Comisiones",
  purchase: "Compras",
  purchase_invoice: "Facturas de compra",
  currency_exchange: "Cambio de divisa",
  sale: "Reembolsos venta",
};

export function ReportsManager() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportType, setReportType] = useState<"all" | "paid" | "pending">("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [expenses, setExpenses] = useState<ExpenseBreakdown[]>([]);
  const [expenseTotalMXN, setExpenseTotalMXN] = useState(0);

  const generateReport = async () => {
    if (!startDate || !endDate) { toast.error("Selecciona un rango de fechas"); return; }
    let query = supabase.from("orders").select(`*, customers (name, address, phone_mx)`)
      .gte("created_at", new Date(startDate).toISOString())
      .lte("created_at", new Date(endDate + "T23:59:59").toISOString())
      .order("created_at", { ascending: false });
    if (reportType === "paid") query = query.eq("payment_status", "paid");
    else if (reportType === "pending") query = query.eq("payment_status", "pending");
    const { data, error } = await query;
    if (error) { toast.error("Error al generar reporte"); return; }
    setOrders(data as Order[]);
    setSummary({
      totalOrders: data.length,
      totalMXN: data.reduce((s, o) => s + Number(o.total_mxn), 0),
      totalUSD: data.reduce((s, o) => s + Number(o.usd_amount), 0),
      totalEUR: data.reduce((s, o) => s + Number(o.eur_amount), 0),
      totalCUP: data.reduce((s, o) => s + Number(o.cup_amount), 0),
      paidOrders: data.filter(o => o.payment_status === "paid").length,
      pendingOrders: data.filter(o => o.payment_status === "pending").length,
      deliveredOrders: data.filter(o => o.delivery_status === "delivered").length,
    });

    // Pull ALL expenses regardless of source from financial_movements
    const { data: expData, error: expErr } = await supabase
      .from("financial_movements")
      .select("source, currency, amount")
      .eq("movement_type", "expense")
      .gte("movement_date", new Date(startDate).toISOString())
      .lte("movement_date", new Date(endDate + "T23:59:59").toISOString());
    if (expErr) {
      toast.error("Error al cargar egresos");
    } else {
      const map = new Map<string, ExpenseBreakdown>();
      let totalMxn = 0;
      (expData || []).forEach((m: any) => {
        const key = `${m.source}::${m.currency}`;
        if (!map.has(key)) map.set(key, { source: m.source, currency: m.currency, total: 0, count: 0 });
        const row = map.get(key)!;
        row.total += Number(m.amount);
        row.count += 1;
        if (m.currency === "MXN") totalMxn += Number(m.amount);
      });
      setExpenses(Array.from(map.values()).sort((a, b) => b.total - a.total));
      setExpenseTotalMXN(totalMxn);
    }

    toast.success(`Reporte: ${data.length} órdenes`);
  };

  const exportToPDF = () => {
    if (!summary || orders.length === 0) { toast.error("Genera un reporte primero"); return; }
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text("Reporte de Órdenes", 14, 20);
    doc.setFontSize(11); doc.text(`Período: ${startDate} al ${endDate}`, 14, 30);
    const summaryData = [
      ["Total órdenes", summary.totalOrders.toString()],
      ["Total MXN", `$${summary.totalMXN.toFixed(2)}`],
      ["Total USD", `$${summary.totalUSD.toFixed(2)}`],
      ["Total EUR", `€${summary.totalEUR.toFixed(2)}`],
      ["Total CUP", `${summary.totalCUP.toFixed(2)}`],
    ];
    autoTable(doc, { startY: 36, head: [["Concepto", "Valor"]], body: summaryData, theme: "grid", headStyles: { fillColor: [37, 99, 235] } });
    const finalY = (doc as any).lastAutoTable.finalY || 50;
    const orderData = orders.map(o => {
      const currencies = [
        o.usd_amount > 0 ? `$${Number(o.usd_amount).toFixed(2)} USD` : null,
        o.eur_amount > 0 ? `€${Number(o.eur_amount).toFixed(2)} EUR` : null,
        o.cup_amount > 0 ? `$${Number(o.cup_amount).toFixed(2)} CUP` : null,
      ].filter(Boolean).join(", ");
      return [
        new Date(o.created_at).toLocaleDateString("es-MX"),
        o.customers.name,
        currencies || "—",
        `$${Number(o.total_mxn).toFixed(2)} MXN`,
        o.payment_status === "paid" ? "Pagado" : "Pendiente",
        o.delivery_status === "delivered" ? "Entregado" : "Pendiente",
      ];
    });
    autoTable(doc, { startY: finalY + 10, head: [["Fecha", "Cliente", "Divisas", "Total MXN", "Pago", "Entrega"]], body: orderData, theme: "striped", headStyles: { fillColor: [37, 99, 235] }, styles: { fontSize: 8 } });
    doc.save(`reporte_${startDate}_${endDate}.pdf`);
  };

  const exportToJSON = () => {
    if (!summary || orders.length === 0) { toast.error("Genera un reporte primero"); return; }
    const blob = new Blob([JSON.stringify({ metadata: { startDate, endDate, reportType, generatedAt: new Date().toISOString() }, summary, orders }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `respaldo_${startDate}_${endDate}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-card rounded-2xl shadow-fintech-sm p-4 space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Reportes</h2>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Inicio</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-lg text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Fin</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-lg text-sm" />
        </div>
      </div>

      <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
        <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
        <SelectContent className="bg-popover">
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="paid">Pagadas</SelectItem>
          <SelectItem value="pending">Pendientes</SelectItem>
        </SelectContent>
      </Select>

      <Button onClick={generateReport} className="w-full h-11 rounded-xl font-semibold gap-2">
        <FileText className="h-4 w-4" /> Generar
      </Button>

      {summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Órdenes", value: summary.totalOrders },
              { label: "Total MXN", value: `$${summary.totalMXN.toFixed(2)}` },
              { label: "Pagadas", value: summary.paidOrders },
              { label: "Entregadas", value: summary.deliveredOrders },
            ].map(s => (
              <div key={s.label} className="bg-muted/30 rounded-xl p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "USD", value: `$${summary.totalUSD.toFixed(2)}` },
              { label: "EUR", value: `€${summary.totalEUR.toFixed(2)}` },
              { label: "CUP", value: `${summary.totalCUP.toFixed(2)}` },
            ].map(s => (
              <div key={s.label} className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-sm font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Expenses breakdown — ALL sources */}
          <div className="bg-card rounded-xl border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Egresos por origen</p>
              <p className="text-sm font-bold text-destructive tabular-nums">
                ${expenseTotalMXN.toFixed(2)} MXN
              </p>
            </div>
            {expenses.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">Sin egresos en el período</p>
            ) : (
              <div className="space-y-1">
                {expenses.map((e) => (
                  <div key={`${e.source}-${e.currency}`} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{EXPENSE_SOURCE_LABEL[e.source] ?? e.source}</p>
                      <p className="text-[10px] text-muted-foreground">{e.count} mov · {e.currency}</p>
                    </div>
                    <p className="font-bold tabular-nums text-destructive">
                      {e.currency === "MXN" ? "$" : ""}{e.total.toFixed(2)} {e.currency !== "MXN" && e.currency}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={exportToPDF} className="h-10 rounded-xl gap-1 text-xs font-semibold">
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button variant="outline" onClick={exportToJSON} className="h-10 rounded-xl gap-1 text-xs font-semibold">
              <Download className="h-3.5 w-3.5" /> JSON
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
