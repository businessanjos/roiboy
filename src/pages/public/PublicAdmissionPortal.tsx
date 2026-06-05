import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Upload, CheckCircle2, Clock, AlertCircle, Loader2, FileCheck2,
  Camera, FileText, ExternalLink, PartyPopper, ShieldCheck, X, Plus, Trash2,
  Pencil, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import letreiro from "@/assets/eternum/letreiro.png.asset.json";

interface Attachment {
  name: string;
  url: string;
  path: string | null;
  uploaded_at: string | null;
  uploaded_via: "rh" | "candidate" | null;
}

interface FormField {
  key: string;
  label: string;
  type: "text" | "select" | "textarea";
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

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
  attachments: Attachment[];
  notes: string | null;
  sort_order: number;
  doc_type?: "file" | "form";
  form_schema?: FormField[] | null;
  form_data?: Record<string, string> | null;
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

// Paleta Eternum (mesma da Carta-Proposta)
const BG = "#2a1b0f";
const BG_DEEP = "#1d1208";
const CARD = "#ede6cb";
const TEXT_DARK = "#3b2510";
const GOLD = "#c9a86a";

const SANS = "'Montserrat', system-ui, sans-serif";
const SERIF = "'Merriweather', Georgia, serif";

const STATUS_META: Record<Doc["status"], { label: string; bg: string; border: string; color: string; icon: typeof Clock }> = {
  pending:  { label: "Pendente",  bg: "rgba(201,168,106,0.10)", border: "rgba(201,168,106,0.40)", color: "#d7b46a", icon: Clock },
  received: { label: "Recebido",  bg: "rgba(120,170,200,0.12)", border: "rgba(120,170,200,0.40)", color: "#a8c8e0", icon: FileCheck2 },
  approved: { label: "Aprovado",  bg: "rgba(140,190,140,0.12)", border: "rgba(140,190,140,0.40)", color: "#b8d8b8", icon: CheckCircle2 },
  rejected: { label: "Reenviar",  bg: "rgba(220,120,120,0.12)", border: "rgba(220,120,120,0.45)", color: "#e8a8a8", icon: AlertCircle },
};

type UploadState = {
  fileName: string;
  progress: number; // 0..100
  status: "uploading" | "success" | "error";
  error?: string;
  retry?: () => void;
};

export default function PublicAdmissionPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<Record<string, UploadState | undefined>>({});
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [formSaving, setFormSaving] = useState<Record<string, boolean>>({});
  const [formEditing, setFormEditing] = useState<Record<string, boolean>>({});
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const cameraInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const successTimers = useRef<Record<string, number>>({});

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${FN_URL}?action=get&token=${token}`, {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      });
      if (!res.ok) throw new Error("not_found");
      const json: PortalData = await res.json();
      setData(json);
      // hydrate form values
      const next: Record<string, Record<string, string>> = {};
      (json.documents || []).forEach((d) => {
        if (d.doc_type === "form") {
          next[d.id] = { ...(d.form_data || {}) };
        }
      });
      setFormValues((prev) => ({ ...next, ...prev }));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  useEffect(() => () => {
    Object.values(successTimers.current).forEach((id) => window.clearTimeout(id));
  }, []);

  const setUpload = (docId: string, patch: UploadState | undefined) => {
    setUploads((prev) => ({ ...prev, [docId]: patch }));
  };

  const flashSuccess = (docId: string, fileName: string) => {
    setUpload(docId, { fileName, progress: 100, status: "success" });
    if (successTimers.current[docId]) window.clearTimeout(successTimers.current[docId]);
    successTimers.current[docId] = window.setTimeout(() => {
      setUploads((prev) => {
        const next = { ...prev };
        if (next[docId]?.status === "success") delete next[docId];
        return next;
      });
    }, 2500);
  };

  const handleUpload = (docId: string, file: File) => {
    if (!token) return;
    if (file.size > 15 * 1024 * 1024) {
      const msg = "Arquivo acima de 15MB. Tente uma foto em qualidade menor ou um PDF.";
      toast.error(msg);
      setUpload(docId, { fileName: file.name, progress: 0, status: "error", error: msg });
      return;
    }

    const fd = new FormData();
    fd.append("token", token);
    fd.append("doc_id", docId);
    fd.append("file", file);

    setUpload(docId, {
      fileName: file.name,
      progress: 0,
      status: "uploading",
      retry: () => handleUpload(docId, file),
    });

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${FN_URL}?action=upload`);
    xhr.setRequestHeader("apikey", ANON);
    xhr.setRequestHeader("Authorization", `Bearer ${ANON}`);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
      setUploads((prev) => {
        const cur = prev[docId];
        if (!cur || cur.status !== "uploading") return prev;
        return { ...prev, [docId]: { ...cur, progress: pct } };
      });
    };

    const fail = (msg: string) => {
      toast.error(msg);
      setUpload(docId, {
        fileName: file.name,
        progress: 0,
        status: "error",
        error: msg,
        retry: () => handleUpload(docId, file),
      });
    };

    xhr.onload = async () => {
      let body: { error?: string } = {};
      try { body = JSON.parse(xhr.responseText || "{}"); } catch { /* noop */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success(`${file.name} enviado ✨`);
        flashSuccess(docId, file.name);
        await load();
      } else {
        fail(body.error || `Falha no envio (HTTP ${xhr.status})`);
      }
    };
    xhr.onerror = () => fail("Sem conexão. Verifique sua internet e tente de novo.");
    xhr.ontimeout = () => fail("Tempo esgotado. Tente novamente.");
    xhr.timeout = 120000;
    xhr.send(fd);
  };

  const dismissUpload = (docId: string) => {
    setUploads((prev) => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });
  };


  const handleDelete = async (docId: string, path: string | null) => {
    if (!token || !path) {
      toast.error("Esse arquivo não pode ser removido por aqui — fale com o RH.");
      return;
    }
    if (!confirm("Remover este arquivo? Você pode enviar outro em seguida.")) return;
    try {
      const res = await fetch(`${FN_URL}?action=delete`, {
        method: "POST",
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ token, doc_id: docId, path }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "falha ao remover");
      toast.success("Arquivo removido");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "erro ao remover");
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (!data || data.expired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: BG, fontFamily: SANS }}>
        <div className="text-center max-w-md space-y-3" style={{ color: CARD }}>
          <AlertCircle className="h-12 w-12 mx-auto opacity-60" />
          <h1 className="text-xl font-semibold" style={{ fontFamily: SERIF }}>Link inválido ou expirado</h1>
          <p className="text-sm opacity-70">
            Entre em contato com o RH da Eternum para receber um novo link de envio de documentos.
          </p>
        </div>
      </div>
    );
  }

  const firstName = (data.candidate_name || "").split(" ")[0] || data.candidate_name;

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        background: BG,
        color: CARD,
        fontFamily: SANS,
        backgroundImage: `radial-gradient(circle at 20% 0%, ${GOLD}15, transparent 50%), radial-gradient(circle at 80% 100%, ${GOLD}10, transparent 50%)`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* HERO */}
      <header className="relative overflow-hidden" style={{ background: `linear-gradient(180deg, ${BG_DEEP} 0%, ${BG} 100%)` }}>
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(${GOLD} 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative max-w-3xl mx-auto px-5 sm:px-6 pt-10 pb-12 sm:pt-12 sm:pb-16">
          {/* Logo */}
          <div className="flex justify-center mb-8 sm:mb-10">
            <img src={letreiro.url} alt="Eternum" className="h-6 sm:h-7 md:h-9 object-contain opacity-95" />
          </div>

          {/* Linha dourada + tag */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <span className="h-px w-10 sm:w-12" style={{ background: GOLD }} />
            <span
              className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.4em] font-light"
              style={{ color: GOLD, fontFamily: SANS }}
            >
              Admissão · Confidencial
            </span>
            <span className="h-px w-10 sm:w-12" style={{ background: GOLD }} />
          </div>

          <h1
            className="text-center text-[28px] leading-[1.15] sm:text-4xl md:text-5xl max-w-2xl mx-auto"
            style={{ fontFamily: SERIF, color: CARD, fontWeight: 300, letterSpacing: "-0.01em" }}
          >
            Bem-vindo, {firstName}.
          </h1>
          <p
            className="mt-5 sm:mt-6 text-center text-[15px] sm:text-base md:text-lg max-w-xl mx-auto leading-relaxed"
            style={{ color: "#e8dcc0", fontFamily: SERIF, fontWeight: 300, fontStyle: "italic", opacity: 0.9 }}
          >
            Pra começar a sua jornada
            {data.position_title && (
              <> como <span style={{ color: GOLD, fontStyle: "normal" }}>{data.position_title}</span></>
            )}
            , precisamos de alguns documentos. Pode enviar tudo por aqui — é seguro e rápido.
          </p>
        </div>
      </header>

      {/* CORPO */}
      {/* Sticky mini-progress (mobile) */}
      {!allDone && required.length > 0 && (
        <div
          className="sm:hidden sticky top-0 z-30 px-4 py-2.5 backdrop-blur"
          style={{
            background: `${BG_DEEP}ee`,
            borderBottom: `1px solid ${GOLD}33`,
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-[0.25em]" style={{ color: GOLD, fontWeight: 600 }}>
              Progresso
            </span>
            <span className="text-[11px] tabular-nums" style={{ color: CARD, opacity: 0.85 }}>
              {sent}/{required.length} · {progress}%
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: `${GOLD}1f` }}>
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${GOLD}, #e8c98a)` }}
            />
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-14 space-y-5 sm:space-y-6">
        {/* Conclusão */}
        {allDone && (
          <div
            className="rounded-sm p-6 text-center relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${CARD} 0%, #f4eed5 100%)`,
              boxShadow: `0 20px 60px -20px rgba(0,0,0,0.5), inset 0 0 0 1px ${GOLD}40`,
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
            <PartyPopper className="h-8 w-8 mx-auto mb-2" style={{ color: GOLD }} />
            <h2 className="text-xl" style={{ fontFamily: SERIF, color: TEXT_DARK, fontWeight: 400 }}>
              Tudo enviado.
            </h2>
            <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: TEXT_DARK, opacity: 0.75 }}>
              Nosso time de RH vai revisar os documentos e te avisar sobre os próximos passos.
              Você pode fechar essa página — ou substituir um arquivo abaixo, se quiser.
            </p>
          </div>
        )}

        {/* Progress */}
        <div
          className="rounded-sm p-5"
          style={{
            background: `${BG_DEEP}cc`,
            boxShadow: `0 10px 40px -15px rgba(0,0,0,0.5), inset 0 0 0 1px ${GOLD}30`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-[0.3em]" style={{ color: GOLD, fontWeight: 600 }}>
              Seu progresso
            </span>
            <span className="text-xs" style={{ color: CARD, opacity: 0.75 }}>
              {sent}/{required.length} enviados · {progress}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${GOLD}1f` }}>
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${GOLD}, #e8c98a)` }}
            />
          </div>
        </div>

        {/* Section label */}
        <div className="flex items-center gap-3 pt-4">
          <span className="h-px w-8" style={{ background: GOLD }} />
          <span
            className="text-[10px] uppercase tracking-[0.35em]"
            style={{ color: GOLD, fontWeight: 600 }}
          >
            Documentos
          </span>
        </div>

        {/* Docs list */}
        <div className="space-y-3">
          {docs.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: CARD, opacity: 0.6 }}>
              Nenhum documento configurado ainda. Fale com o RH.
            </p>
          ) : (
            docs.map((d) => {
              const meta = STATUS_META[d.status];
              const Icon = meta.icon;
              const locked = d.status === "approved";
              const rejected = d.status === "rejected";
              const up = uploads[d.id];
              const isUploading = up?.status === "uploading";
              return (
                <div
                  key={d.id}
                  className="relative rounded-sm p-5 transition"
                  style={{
                    background: CARD,
                    boxShadow: rejected
                      ? `0 10px 30px -10px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(220,120,120,0.55)`
                      : `0 10px 30px -10px rgba(0,0,0,0.4), inset 0 0 0 1px ${GOLD}33`,
                  }}
                >
                  {/* fio dourado superior */}
                  <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}66, transparent)` }} />

                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium" style={{ color: TEXT_DARK, fontFamily: SERIF, fontWeight: 500 }}>
                          {d.label}
                        </h3>
                        {d.required && (
                          <span
                            className="text-[9px] uppercase tracking-[0.25em] px-1.5 py-0.5 rounded-sm"
                            style={{ color: GOLD, border: `1px solid ${GOLD}66`, fontWeight: 600 }}
                          >
                            obrigatório
                          </span>
                        )}
                      </div>
                      {d.notes && rejected && (
                        <p className="text-xs mt-2 leading-relaxed" style={{ color: "#a83232" }}>
                          <span className="font-semibold">Motivo:</span> {d.notes}
                        </p>
                      )}
                    </div>
                    <span
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-sm shrink-0 font-semibold"
                      style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                  </div>

                  {/* Lista de anexos */}
                  {d.attachments && d.attachments.length > 0 && (
                    <ul className="space-y-1.5 mb-3">
                      {d.attachments.map((att, idx) => (
                        <li
                          key={`${d.id}-${idx}`}
                          className="flex items-center gap-2 rounded-sm px-2.5 py-1.5"
                          style={{ background: `${TEXT_DARK}0d`, border: `1px solid ${GOLD}26` }}
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} />
                          {att.url ? (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs truncate flex-1 hover:underline"
                              style={{ color: TEXT_DARK }}
                            >
                              {att.name || "arquivo"}
                            </a>
                          ) : (
                            <span className="text-xs truncate flex-1" style={{ color: TEXT_DARK }}>
                              {att.name || "arquivo"}
                            </span>
                          )}
                          {!locked && (
                            att.path ? (
                              <button
                                type="button"
                                onClick={() => handleDelete(d.id, att.path)}
                                aria-label={`Remover ${att.name || "arquivo"}`}
                                title="Remover este arquivo"
                                className="shrink-0 inline-flex items-center gap-1.5 h-9 px-2.5 rounded-sm font-semibold touch-manipulation active:scale-95 transition"
                                style={{
                                  background: "rgba(168,50,50,0.10)",
                                  border: "1px solid rgba(168,50,50,0.45)",
                                  color: "#a83232",
                                  fontSize: 11,
                                  letterSpacing: "0.05em",
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="hidden xs:inline sm:inline">Remover</span>
                              </button>
                            ) : (
                              <span
                                className="shrink-0 text-[10px] uppercase tracking-[0.15em] opacity-60"
                                style={{ color: TEXT_DARK }}
                                title="Enviado pelo RH — peça remoção ao time"
                              >
                                via RH
                              </span>
                            )
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Feedback de upload por arquivo */}
                  {up && (
                    <div
                      className="mb-3 rounded-sm px-3 py-2.5"
                      style={{
                        background:
                          up.status === "error"
                            ? "rgba(220,120,120,0.10)"
                            : up.status === "success"
                            ? "rgba(140,190,140,0.14)"
                            : `${GOLD}14`,
                        border: `1px solid ${
                          up.status === "error"
                            ? "rgba(168,50,50,0.45)"
                            : up.status === "success"
                            ? "rgba(90,150,90,0.45)"
                            : `${GOLD}55`
                        }`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {up.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" style={{ color: TEXT_DARK }} />}
                        {up.status === "success" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#2f7a3a" }} />}
                        {up.status === "error" && <AlertCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "#a83232" }} />}
                        <span className="text-xs truncate flex-1" style={{ color: TEXT_DARK, fontWeight: 500 }}>
                          {up.fileName}
                        </span>
                        {up.status === "uploading" && (
                          <span className="text-[11px] tabular-nums shrink-0" style={{ color: TEXT_DARK, opacity: 0.7 }}>
                            {up.progress}%
                          </span>
                        )}
                        {up.status === "success" && (
                          <span className="text-[10px] uppercase tracking-[0.2em] shrink-0" style={{ color: "#2f7a3a", fontWeight: 600 }}>
                            enviado
                          </span>
                        )}
                        {up.status === "error" && (
                          <button
                            type="button"
                            onClick={() => dismissUpload(d.id)}
                            aria-label="Dispensar erro"
                            className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-sm opacity-60 hover:opacity-100 touch-manipulation"
                            style={{ color: TEXT_DARK }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {up.status !== "error" && (
                        <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: `${TEXT_DARK}1a` }}>
                          <div
                            className={up.status === "uploading" ? "h-full transition-all duration-200" : "h-full"}
                            style={{
                              width: `${up.progress}%`,
                              background: up.status === "success" ? "#5ea76a" : `linear-gradient(90deg, ${GOLD}, #e8c98a)`,
                            }}
                          />
                        </div>
                      )}

                      {up.status === "error" && (
                        <div className="mt-1.5 flex items-start justify-between gap-2">
                          <p className="text-[11px] leading-snug" style={{ color: "#a83232" }}>
                            {up.error || "Falha no envio."}
                          </p>
                          {up.retry && (
                            <button
                              type="button"
                              onClick={() => up.retry?.()}
                              className="text-[11px] underline shrink-0 touch-manipulation"
                              style={{ color: "#a83232", fontWeight: 600 }}
                            >
                              Tentar de novo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <input
                    ref={(el) => (fileInputs.current[d.id] = el)}
                    type="file"
                    className="hidden"
                    accept="image/*,.heic,.heif,application/pdf"
                    onChange={(e) => { if (e.target.files?.[0]) { handleUpload(d.id, e.target.files[0]); e.target.value = ""; } }}
                  />
                  <input
                    ref={(el) => (cameraInputs.current[d.id] = el)}
                    type="file"
                    className="hidden"
                    accept="image/*,.heic,.heif"
                    capture="environment"
                    onChange={(e) => { if (e.target.files?.[0]) { handleUpload(d.id, e.target.files[0]); e.target.value = ""; } }}
                  />

                  {!locked && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Button
                        type="button"
                        disabled={isUploading}
                        onClick={() => cameraInputs.current[d.id]?.click()}
                        className="h-11 sm:h-9 w-full border-0 hover:opacity-90 touch-manipulation"
                        style={{ background: `${TEXT_DARK}`, color: CARD, fontFamily: SANS, fontWeight: 500, letterSpacing: "0.05em" }}
                      >
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <><Camera className="h-4 w-4 mr-1.5" />{d.attachments?.length ? "Outra foto" : "Tirar foto"}</>
                        )}
                      </Button>
                      <Button
                        type="button"
                        disabled={isUploading}
                        onClick={() => fileInputs.current[d.id]?.click()}
                        className="h-11 sm:h-9 w-full border-0 hover:opacity-90 touch-manipulation"
                        style={{ background: GOLD, color: TEXT_DARK, fontFamily: SANS, fontWeight: 600, letterSpacing: "0.05em" }}
                      >
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>{d.attachments?.length ? <Plus className="h-4 w-4 mr-1.5" /> : <Upload className="h-4 w-4 mr-1.5" />}{d.attachments?.length ? "Adicionar arquivo" : "Enviar arquivo"}</>
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
        <div className="mt-12 space-y-2.5 text-center pt-8" style={{ borderTop: `1px solid ${GOLD}22` }}>
          <div className="flex items-center justify-center gap-2 text-xs" style={{ color: CARD, opacity: 0.65 }}>
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: GOLD }} />
            Seus documentos são confidenciais e usados apenas para sua admissão.
          </div>
          <p className="text-xs" style={{ color: CARD, opacity: 0.5 }}>
            Aceitos: imagens (JPG, PNG, HEIC) ou PDF · até 15MB cada
          </p>
          <p className="text-xs" style={{ color: CARD, opacity: 0.5 }}>
            Dúvidas? Fale com o RH no WhatsApp informado na sua carta-proposta.
          </p>
          <div className="pt-4">
            <img src={letreiro.url} alt="Eternum" className="h-4 mx-auto opacity-40" />
          </div>
        </div>
      </main>
    </div>
  );
}
