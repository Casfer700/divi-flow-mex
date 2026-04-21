import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";

export default function Owner() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile && profile.role !== "admin") navigate("/");
  }, [profile, navigate]);

  if (profile?.role !== "admin") return null;

  return (
    <Layout>
      <OwnerDashboard />
    </Layout>
  );
}
