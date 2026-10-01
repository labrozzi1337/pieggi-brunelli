import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "blue" | "emerald" | "amber" | "rose" | "indigo";

interface StatCardProps {
  label: string;
  value: string;
  description: string;
  tone: Tone;
  icon: LucideIcon;
}

const toneClasses: Record<Tone, string> = {
  blue: "bg-hub-blue",
  emerald: "bg-hub-emerald",
  amber: "bg-hub-amber",
  rose: "bg-hub-rose",
  indigo: "bg-hub-indigo"
};

export function StatCard({ label, value, description, tone, icon: Icon }: StatCardProps) {
  return (
    <section className="hub-card rounded-3xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full", toneClasses[tone])} />
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        </div>
        <Icon className="h-5 w-5 text-foreground/40" strokeWidth={1.75} />
      </div>
      <p className="mt-5 font-display text-2xl font-semibold leading-none tracking-tight sm:text-[34px]">{value}</p>
      <p className="mt-2 text-[12px] text-muted-foreground">{description}</p>
    </section>
  );
}

