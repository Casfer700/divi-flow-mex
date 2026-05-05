import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ExchangeRatesManager } from "@/components/admin/ExchangeRatesManager";
import { InventoryManager } from "@/components/admin/InventoryManager";
import { WhatsAppTemplatesManager } from "@/components/admin/WhatsAppTemplatesManager";
import { ReportsManager } from "@/components/admin/ReportsManager";
import { DailyCashRegister } from "@/components/admin/DailyCashRegister";
import { CashSessionManager } from "@/components/admin/CashSessionManager";
import { AccountsManager } from "@/components/admin/AccountsManager";
import { FinancialMovementsManager } from "@/components/admin/FinancialMovementsManager";
import { ProductsManager } from "@/components/admin/ProductsManager";
import { BatchesManager } from "@/components/admin/BatchesManager";
import { BatchInvoicesManager } from "@/components/admin/BatchInvoicesManager";
import { TelegramConfigManager } from "@/components/admin/TelegramConfigManager";
import { SalesAgentsManager } from "@/components/admin/SalesAgentsManager";
import { SalesHistoryManager } from "@/components/admin/SalesHistoryManager";
import { Package, Truck, Clock, DollarSign, Banknote, Coins } from "lucide-react";
import { startOfDay, endOfDay } from "date-fns";

interface TodayStats {
  totalOrders: number;
  delivered: number;
  pending: number;
  totalUSD: number;
  totalEUR: number;
  totalCUP: number;
}

export default function Admin() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<TodayStats>({ totalOrders: 0, delivered: 0, pending: 0, totalUSD: 0, totalEUR: 0, totalCUP: 0 });

  useEffect(() => {
    if (profile && profile.role !== "admin") navigate("/");
  }, [profile, navigate]);

  useEffect(() => {
    fetchTodayStats();
  }, []);

  const fetchTodayStats = async () => {
    const start = startOfDay(new Date()).toISOString();
    const end = endOfDay(new Date()).toISOString();
    const { data } = await supabase.from("orders").select("*").gte("created_at", start).lte("created_at", end);
    if (!data) return;
    setStats({
      totalOrders: data.length,
      delivered: data.filter(o => o.delivery_status === "delivered").length,
      pending: data.filter(o => o.delivery_status === "pending").length,
      totalUSD: data.reduce((s, o) => s + (o.usd_amount || 0), 0),
      totalEUR: data.reduce((s, o) => s + (o.eur_amount || 0), 0),
      totalCUP: data.reduce((s, o) => s + (o.cup_amount || 0), 0),
    });
  };

  if (profile?.role !== "admin") return null;

  const statCards = [
    { label: "Órdenes hoy", value: stats.totalOrders, icon: Package, color: "text-primary" },
    { label: "Entregadas", value: stats.delivered, icon: Truck, color: "text-success" },
    { label: "Pendientes", value: stats.pending, icon: Clock, color: "text-warning" },
    { label: "Venta USD", value: `$${stats.totalUSD.toFixed(0)}`, icon: DollarSign, color: "text-currency-usd" },
    { label: "Venta EUR", value: `€${stats.totalEUR.toFixed(0)}`, icon: Banknote, color: "text-currency-eur" },
    { label: "Venta CUP", value: `$${stats.totalCUP.toFixed(0)}`, icon: Coins, color: "text-currency-cup" },
  ];

  return (
    <Layout>
      <div className="space-y-5">
        <h1 className="text-xl font-bold">Administración</h1>

        {/* Today overview */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Resumen de hoy</h2>
          <div className="grid grid-cols-3 gap-2">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="bg-card rounded-xl p-3 shadow-fintech-sm animate-fade-in">
                  <Icon className={`h-4 w-4 ${card.color} mb-1`} />
                  <p className="text-lg font-bold leading-tight">{card.value}</p>
                  <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{card.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        <CashSessionManager />
        <DailyCashRegister />
        <InventoryManager />
        <ProductsManager />
        <BatchesManager />
        <BatchInvoicesManager />
        <SalesAgentsManager />
        <SalesHistoryManager />
        <FinancialMovementsManager embedded />
        <AccountsManager />
        <ExchangeRatesManager />
        <WhatsAppTemplatesManager />
        <ReportsManager />
      </div>
    </Layout>
  );
}
