import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 shadow-inner shadow-black/20 backdrop-blur-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
