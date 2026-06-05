import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Upload, CheckCircle2, Clock, AlertCircle, Loader2, FileCheck2, Sparkles,
  Camera, FileText, ExternalLink, PartyPopper, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Doc {
  id: string;
  doc_key: string;
  label: string;
  required: boolean;
  status: "pending" | "received" | "approved" | "rejected";
  file_name: string | null;
  file_url: string | null;
  uploaded_at: string | null;
  uploaded_via: "rh" | "candidate" | null;
  notes: string | null;
  sort_order: number;
}

interface PortalData {
  id: string;
  candidate_name: string;
  position_title: string | null;
  department: string | null;
  start_date: string | null;
  stage: string;
  documents: Doc[];
  expired?: boolean;
}

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admission-portal`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const STATUS_META: Record<Doc["status"], { label: string; cls: string; icon: typeof Clock }> = {
  pending: { label: "Pendente", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", icon: Clock },
  received: { label: "Recebido", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30", icon: FileCheck2 },
  approved: { label: "Aprovado", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: CheckCircle2 },
  rejected: { label: "Reenviar", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30", icon: AlertCircle },
};

export default function PublicAdmissionPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const cameraInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${FN_URL}?action=get&token=${token}`, {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      });
      if (!res.ok) throw new Error("not_found");
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  const handleUpload = async (docId: string, file: File) => {
    if (!token) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Arquivo acima de 15MB. Tente uma foto em qualidade menor ou um PDF.");
      return;
    }
    setUploadingId(docId);
    const fd = new FormData();
    fd.append("token", token);
    fd.append("doc_id", docId);
    fd.append("file", file);
    try {
      const res = await fetch(`${FN_URL}?action=upload`, {
        method: "POST",
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "falha no envio");
      toast.success("Documento enviado com sucesso! ✨");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro no envio";
      toast.error(msg);
    } finally {
      setUploadingId(null);
    }
  };

  const { docs, required, sent, progress, allDone } = useMemo(() => {
    const docs = data?.documents || [];
    const required = docs.filter((d) => d.required);
    const sent = required.filter((d) => d.status === "received" || d.status === "approved").length;
    const progress = required.length > 0 ? Math.round((sent / required.length) * 100) : 0;
    const allDone = required.length > 0 && sent === required.length;
    return { docs, required, sent, progress, allDone };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!data || data.expired) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-center">
        <div>
          <AlertCircle className="h-12 w-12 mx-auto text-rose-400 mb-3" />
          <h1 className="text-xl font-semibold text-zinc-100">Link inválido ou expirado</h1>
          <p className="text-sm text-zinc-400 mt-2 max-w-sm mx-auto">
            Entre em contato com o RH da Eternum para receber um novo link de envio de documentos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black text-zinc-100">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium mb-4">
            <Sparkles className="h-3 w-3" />
            Eternum · Onboarding
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Olá, {data.candidate_name.split(" ")[0]}!
          </h1>
          <p className="text-zinc-400 mt-3 text-base">
            Que bom te ter por aqui. Pra começar sua admissão
            {data.position_title && (
              <> como <span className="text-zinc-200 font-medium">{data.position_title}</span></>
            )}
            , precisamos de alguns documentos.
          </p>
        </div>

        {/* Conclusão */}
        {allDone && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 mb-6 text-center">
            <PartyPopper className="h-8 w-8 mx-auto text-emerald-300 mb-2" />
            <h2 className="text-lg font-semibold text-emerald-100">Tudo enviado! 🎉</h2>
            <p className="text-sm text-emerald-200/80 mt-1">
              Nosso time de RH vai revisar os documentos e te avisar sobre os próximos passos.
              Você pode fechar essa página — ou substituir um arquivo abaixo, se quiser.
            </p>
          </div>
        )}

        {/* Progress */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-zinc-300">Seu progresso</span>
            <span className="text-sm text-zinc-400">{sent}/{required.length} enviados · {progress}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Docs list */}
        <div className="space-y-3">
          {docs.length === 0 ? (
            <p className="text-center text-zinc-500 py-8">Nenhum documento configurado ainda. Fale com o RH.</p>
          ) : (
            docs.map((d) => {
              const meta = STATUS_META[d.status];
              const Icon = meta.icon;
              const locked = d.status === "approved";
              return (
                <div
                  key={d.id}
                  className={`rounded-xl border p-4 transition ${
                    d.status === "rejected"
                      ? "border-rose-500/40 bg-rose-500/5"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-zinc-100">{d.label}</h3>
                        {d.required && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-zinc-700 text-zinc-400">
                            obrigatório
                          </Badge>
                        )}
                      </div>
                      {d.file_name && (
                        <div className="mt-1.5">
                          {d.file_url ? (
                            <a
                              href={d.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200 max-w-full"
                            >
                              <FileText className="h-3 w-3 shrink-0" />
                              <span className="truncate">{d.file_name}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            <p className="text-xs text-zinc-500 truncate">📎 {d.file_name}</p>
                          )}
                        </div>
                      )}
                      {d.notes && d.status === "rejected" && (
                        <p className="text-xs text-rose-300 mt-2 leading-relaxed">
                          <span className="font-medium">Motivo:</span> {d.notes}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-xs shrink-0 ${meta.cls}`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {meta.label}
                    </Badge>
                  </div>

                  <input
                    ref={(el) => (fileInputs.current[d.id] = el)}
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={(e) => e.target.files?.[0] && handleUpload(d.id, e.target.files[0])}
                  />
                  <input
                    ref={(el) => (cameraInputs.current[d.id] = el)}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => e.target.files?.[0] && handleUpload(d.id, e.target.files[0])}
                  />

                  {!locked && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={uploadingId === d.id}
                        onClick={() => cameraInputs.current[d.id]?.click()}
                        className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-200"
                      >
                        {uploadingId === d.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <><Camera className="h-3.5 w-3.5 mr-1.5" />Tirar foto</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={uploadingId === d.id}
                        onClick={() => fileInputs.current[d.id]?.click()}
                        className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-200"
                      >
                        {uploadingId === d.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <><Upload className="h-3.5 w-3.5 mr-1.5" />{d.file_name ? "Substituir" : "Enviar"}</>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-10 space-y-2.5 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Seus documentos são confidenciais e usados apenas para sua admissão.
          </div>
          <p className="text-xs text-zinc-600">
            Aceitos: imagens (JPG, PNG, HEIC) ou PDF · até 15MB cada
          </p>
          <p className="text-xs text-zinc-600">
            Dúvidas? Fale com o RH no WhatsApp informado na sua carta-proposta.
          </p>
        </div>
      </div>
    </div>
  );
}
