import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  value: number | string;
  icon: LucideIcon;
  accent?: "default" | "warning" | "success";
};

export function StatCard({ title, value, icon: Icon, accent = "default" }: Props) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-2",
        accent === "warning" && "border-amber-500/30 bg-amber-950/20",
        accent === "success" && "border-emerald-500/25 bg-emerald-950/15"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
        <span
          className={cn(
            "rounded-lg p-2",
            accent === "warning" && "bg-amber-500/15 text-amber-300",
            accent === "success" && "bg-emerald-500/15 text-emerald-300",
            accent === "default" && "bg-fire-red/15 text-fire-yellow"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
    </Card>
  );
}
