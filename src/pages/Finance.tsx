import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { FinancialMovementsManager } from "@/components/admin/FinancialMovementsManager";
import { ManualMovementsManager } from "@/components/admin/ManualMovementsManager";
import { CurrencyExchangeManager } from "@/components/admin/CurrencyExchangeManager";
import { MonthlyAccountReport } from "@/components/admin/MonthlyAccountReport";
import { cn } from "@/lib/utils";

type Tab = "all" | "manual" | "exchange" | "report";

export default function Finance() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    if (profile && profile.role !== "admin") {
      navigate("/");
    }
  }, [profile, navigate]);

  if (profile && profile.role !== "admin") return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "manual", label: "Manuales" },
    { id: "exchange", label: "Cambio" },
    { id: "report", label: "Reporte" },
  ];

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">Finanzas</h1>
          <p className="text-xs text-muted-foreground">Movimientos, divisas y reportes</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 min-w-[72px] h-10 rounded-lg text-xs font-semibold transition whitespace-nowrap px-3",
                tab === t.id ? "bg-card shadow-fintech-sm text-foreground" : "text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "all" && <FinancialMovementsManager />}
        {tab === "manual" && <ManualMovementsManager />}
        {tab === "exchange" && <CurrencyExchangeManager />}
        {tab === "report" && <MonthlyAccountReport />}
      </div>
    </Layout>
  );
}
