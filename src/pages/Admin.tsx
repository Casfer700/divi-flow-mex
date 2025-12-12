import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { ExchangeRatesManager } from "@/components/admin/ExchangeRatesManager";
import { InventoryManager } from "@/components/admin/InventoryManager";
import { WhatsAppTemplatesManager } from "@/components/admin/WhatsAppTemplatesManager";
import { ReportsManager } from "@/components/admin/ReportsManager";
import { DailyCashRegister } from "@/components/admin/DailyCashRegister";

export default function Admin() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile && profile.role !== "admin") {
      navigate("/");
    }
  }, [profile, navigate]);

  if (profile?.role !== "admin") {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Administración</h1>
        <DailyCashRegister />
        <ExchangeRatesManager />
        <InventoryManager />
        <WhatsAppTemplatesManager />
        <ReportsManager />
      </div>
    </Layout>
  );
}
