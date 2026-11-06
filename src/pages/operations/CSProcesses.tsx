import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HelpCircle, List, Workflow, ArrowDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsMobile } from "@/hooks/use-mobile";
import { GuidedTour, type TourStep } from "@/components/csProcesses/GuidedTour";
import { ProcessFlow, StepCard, CycleView, EventTimeline, isCycle, type StepStatus } from "@/components/csProcesses/ProcessFlow";
import { Copy, AlertTriangle, CheckSquare, Search, ExternalLink, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { csProcesses, type Block } from "@/lib/csProcesses";

const accents = ["border-l-purple-500", "border-l-teal-500", "border-l-blue-500"];
const dots = ["bg-purple-500", "bg-teal-500", "bg-blue-500"];
const URL_RE = /(https?:\/\/[^\s)]+)/g;

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{[^}]+\}|https?:\/\/[^\s)]+)/g).map((p, i) =>
        /^\{/.test(p) ? <mark key={i} className="rounded bg-primary/15 px-1 text-primary">{p}</mark>
        : /^https?:/.test(p) ? <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-primary underline">{p}</a>
        : <span key={i}>{p.replace(/\*\*/g, "")}</span>)}
    </>
  );
}

function BlockView({ b, first }: { b: Block; first?: boolean }) {
  if (b.kind === "message") {
    const clean = b.text.replace(/\*\*/g, "");
    return (
      <div className="rounded-lg border bg-muted/40 p-3" data-tour={first ? "copy" : undefined}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Mensagem pronta</span>
          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => { navigator.clipboard.writeText(clean); toast.success("Mensagem copiada"); }}>
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
        </div>
        <p className="whitespace-pre-wrap text-sm"><Rich text={b.text} /></p>
      </div>
    );
  }
  if (b.kind === "alert") return <div data-tour={first ? "alert" : undefined} className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-sm"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /><Rich text={b.text} /></div>;
  if (b.kind === "task") return <div className="flex gap-2 text-sm"><CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span><Rich text={b.text} /></span></div>;
  if (b.kind === "meta") return <div className="flex gap-2 text-sm"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span><b>{b.label}:</b> <Rich text={b.text} /></span></div>;
  const urls = b.text.match(URL_RE);
  if (urls && b.text.replace(URL_RE, "").replace(/[:\-\s]/g, "").length < 20) {
    return <a href={urls[0]} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary" className="gap-1"><ExternalLink className="h-3.5 w-3.5" />{b.text.replace(URL_RE, "").replace(/:\s*$/, "") || "Abrir link"}</Button></a>;
  }
  return <p className="text-sm text-muted-foreground"><Rich text={b.text} /></p>;
}

