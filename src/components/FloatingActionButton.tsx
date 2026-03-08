import { useState } from "react";
import { Plus, Package, Users, ArrowLeftRight, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FABAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface FloatingActionButtonProps {
  actions: FABAction[];
}

export function FloatingActionButton({ actions }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 z-40 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Actions menu */}
      <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col items-end gap-2">
        {isOpen && actions.map((action, i) => (
          <div
            key={i}
            className="flex items-center gap-2 animate-slide-up"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="bg-card text-foreground text-xs font-medium px-3 py-1.5 rounded-full shadow-fintech-md whitespace-nowrap">
              {action.label}
            </span>
            <Button
              size="icon"
              onClick={() => { action.onClick(); setIsOpen(false); }}
              className="h-11 w-11 rounded-full shadow-fintech-md bg-card text-foreground hover:bg-secondary"
            >
              {action.icon}
            </Button>
          </div>
        ))}

        {/* Main FAB */}
        <Button
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className={`h-14 w-14 rounded-full shadow-fintech-lg transition-transform duration-200 ${
            isOpen ? "bg-foreground text-background rotate-45" : "bg-primary text-primary-foreground"
          }`}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </div>
    </>
  );
}
