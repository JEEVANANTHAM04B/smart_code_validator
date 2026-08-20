import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!code?.trim()) {
    return <p className="text-sm text-muted-foreground">Not provided.</p>;
  }

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-muted/40 text-foreground dark:bg-slate-950 dark:text-slate-100 dark:border-slate-800",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border bg-muted/80 px-3 py-2 dark:bg-slate-900/80">
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground dark:text-slate-400">
          {label ?? "code"}
        </span>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs text-foreground dark:text-slate-300" onClick={copy}>
          {copied ? <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="max-h-[26rem] overflow-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-foreground dark:text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
