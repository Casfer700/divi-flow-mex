import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Package, Users, Settings, Wallet, ShoppingCart } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: "Órdenes", href: "/", icon: Package },
    { name: "Clientes", href: "/customers", icon: Users },
  ];

  if (profile?.role === "admin" || profile?.role === "local") {
    navigation.push({ name: "POS", href: "/pos", icon: ShoppingCart });
    navigation.push({ name: "Finanzas", href: "/finance", icon: Wallet });
  }

  if (profile?.role === "admin") {
    navigation.push({ name: "Admin", href: "/admin", icon: Settings });
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Top header - sleek */}
      <header className="bg-card sticky top-0 z-30 shadow-fintech-sm">
        <div className="px-4 h-14 flex items-center justify-between max-w-screen-xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">D</span>
            </div>
            <span className="font-bold text-lg tracking-tight">DiviFlow</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link key={item.name} to={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className="gap-2 h-9"
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold leading-none">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{profile?.role}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} className="h-9 w-9">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 max-w-screen-xl mx-auto">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t shadow-fintech-lg">
        <div className="flex justify-around items-center h-16 px-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link key={item.name} to={item.href} className="flex-1">
                <div className={`flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}>
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.name}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
