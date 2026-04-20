import { Button } from "@/components/ui/button";
import { Delete } from "lucide-react";

interface NumericKeypadProps {
  value: string;
  onChange: (next: string) => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

/**
 * Big POS-style numeric keypad. Edits a numeric string with at most 2 decimals.
 */
export function NumericKeypad({ value, onChange }: NumericKeypadProps) {
  const press = (k: string) => {
    if (k === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (k === ".") {
      if (value.includes(".")) return;
      onChange((value || "0") + ".");
      return;
    }
    // digits
    if (value.includes(".")) {
      const [, dec = ""] = value.split(".");
      if (dec.length >= 2) return;
    }
    // avoid leading zeros like "00"
    if (value === "0") {
      onChange(k);
      return;
    }
    onChange(value + k);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((k) => (
        <Button
          key={k}
          type="button"
          variant={k === "back" ? "outline" : "secondary"}
          className="h-14 text-xl font-bold active:scale-95 transition-transform"
          onClick={() => press(k)}
        >
          {k === "back" ? <Delete className="h-5 w-5" /> : k}
        </Button>
      ))}
    </div>
  );
}
