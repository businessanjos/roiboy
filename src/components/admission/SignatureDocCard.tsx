import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, PenLine, Eraser, ScrollText, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import SignaturePad, { type SignaturePadHandle } from "./SignaturePad";
import {
  SIGNER_FIELDS, missingVariables, renderTemplate, sanitizeDocumentHtml, signerFieldLabel, formatSignatureDate,
} from "@/lib/hr/admissionDocVars";

const CARD = "#ede6cb";
const TEXT_DARK = "#3b2510";
const GOLD = "#c9a86a";
const SANS = "'Montserrat', system-ui, sans-serif";
const SERIF = "'Merriweather', Georgia, serif";

export interface SignatureDoc {
  id: string;
  label: string;
  required: boolean;
  status: "pending" | "received" | "approved" | "rejected";
  body_html?: string | null;
  signature_image_url?: string | null;
  signed_at?: string | null;
  signer_name?: string | null;
  notes?: string | null;
}

interface Props {
  doc: SignatureDoc;
  signerData: Record<string, string>;
  onChangeSigner: (key: string, value: string) => void;
  onSaveSigner: () => Promise<void>;
  onSign: (docId: string, signatureDataUrl: string, renderedHtml: string) => Promise<void>;
}

export default function SignatureDocCard({ doc, signerData, onChangeSigner, onSaveSigner, onSign }: Props) {
  const [open, setOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [empty, setEmpty] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  const signed = !!doc.signed_at;
  const rejected = doc.status === "rejected";
  const missing = useMemo(() => missingVariables(doc.body_html || "", signerData), [doc.body_html, signerData]);
  const rendered = useMemo(
    () => sanitizeDocumentHtml(renderTemplate(doc.body_html || "", signerData)),
    [doc.body_html, signerData],
  );

  const handleSign = async () => {
    if (missing.length > 0) {
      return;
    }
    const dataUrl = padRef.current?.toDataURL();
    if (!dataUrl) return;
    setSigning(true);
    try {
      await onSaveSigner();
      await onSign(doc.id, dataUrl, rendered);
      setOpen(false);
      padRef.current?.clear();
      setAccepted(false);
    } finally {
      setSigning(false);
    }
  };

  return (
    <div
      className="relative rounded-sm p-5"
      style={{
        background: CARD,
        boxShadow: rejected
          ? "0 10px 30px -10px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(220,120,120,0.55)"
          : `0 10px 30px -10px rgba(0,0,0,0.4), inset 0 0 0 1px ${signed ? "rgba(90,150,90,0.5)" : `${GOLD}33`}`,
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}66, transparent)` }} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
            <h3 className="font-medium leading-snug" style={{ color: TEXT_DARK, fontFamily: SERIF, fontWeight: 500 }}>
              {doc.label}
            </h3>
          </div>
          {rejected && doc.notes && (
            <p className="text-xs mt-2 leading-relaxed" style={{ color: "#a83232" }}>
              <span className="font-semibold">Motivo:</span> {doc.notes}
            </p>
          )}
        </div>
        <span
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-sm shrink-0 font-semibold"
          style={
            signed
              ? { background: "rgba(140,190,140,0.15)", border: "1px solid rgba(90,150,90,0.45)", color: "#2f7a3a" }
              : { background: `${GOLD}1a`, border: `1px solid ${GOLD}66`, color: "#8a6b2e" }
          }
        >
          {signed ? <CheckCircle2 className="h-3 w-3" /> : <PenLine className="h-3 w-3" />}
          {signed ? "Assinado" : "Assinar"}
        </span>
      </div>

      {signed && (
        <div className="mt-3 rounded-sm px-3 py-2.5" style={{ background: `${TEXT_DARK}0d`, border: `1px solid ${GOLD}26` }}>
          <p className="text-xs" style={{ color: TEXT_DARK }}>
            Assinado por <strong>{doc.signer_name}</strong> em{" "}
            {new Date(doc.signed_at as string).toLocaleString("pt-BR")}
          </p>
          {doc.signature_image_url && (
            <img src={doc.signature_image_url} alt="Assinatura" className="mt-2 h-14 object-contain" />
          )}
        </div>
      )}

      {!signed && (
        <>
          <p className="text-xs mt-3 leading-relaxed" style={{ color: TEXT_DARK, opacity: 0.75 }}>
            Leia o documento até o fim e assine com o dedo ou o mouse.
          </p>

          <Button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="h-11 w-full border-0 hover:opacity-90 mt-3 touch-manipulation"
            style={{ background: open ? `${TEXT_DARK}1a` : TEXT_DARK, color: open ? TEXT_DARK : CARD, fontFamily: SANS, fontWeight: 500, letterSpacing: "0.05em" }}
          >
            {open ? "Fechar documento" : "Ler e assinar"}
          </Button>
        </>
      )}

      {open && !signed && (
        <div className="mt-4 space-y-4">
          {/* Dados do signatário */}
          <div className="rounded-sm p-3.5" style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}55` }}>
            <p className="text-[10px] uppercase tracking-[0.2em] mb-2.5" style={{ color: TEXT_DARK, opacity: 0.75, fontWeight: 600 }}>
              Seus dados (usados em todos os documentos)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SIGNER_FIELDS.map((f) => (
                <div key={f.key} className={f.half ? "col-span-1 space-y-1" : "col-span-2 space-y-1"}>
                  <label className="text-[10px] uppercase tracking-[0.15em] block" style={{ color: TEXT_DARK, opacity: 0.7, fontWeight: 600 }}>
                    {f.label}
                  </label>
                  <input
                    type="text"
                    value={signerData[f.key] || ""}
                    placeholder={f.placeholder}
                    onChange={(e) => onChangeSigner(f.key, e.target.value)}
                    className="w-full h-10 rounded-sm px-2.5 text-sm outline-none"
                    style={{ background: "#fff", color: TEXT_DARK, border: `1px solid ${GOLD}55`, fontFamily: SANS }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Documento */}
          <div
            className="rounded-sm px-4 py-4 max-h-[52vh] overflow-y-auto admission-doc"
            style={{ background: "#fff", border: `1px solid ${GOLD}55`, color: TEXT_DARK }}
            dangerouslySetInnerHTML={{ __html: rendered }}
          />

          <p className="text-[11px]" style={{ color: TEXT_DARK, opacity: 0.7 }}>
            Data da assinatura: {formatSignatureDate()}
          </p>

          {missing.length > 0 && (
            <div className="flex items-start gap-2 rounded-sm px-3 py-2.5" style={{ background: "rgba(220,120,120,0.10)", border: "1px solid rgba(168,50,50,0.4)" }}>
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "#a83232" }} />
              <p className="text-[11px] leading-snug" style={{ color: "#a83232" }}>
                Preencha para liberar a assinatura: {missing.map(signerFieldLabel).join(", ")}
              </p>
            </div>
          )}

          {/* Assinatura */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: TEXT_DARK, opacity: 0.75, fontWeight: 600 }}>
                Assine aqui
              </span>
              <button
                type="button"
                onClick={() => padRef.current?.clear()}
                className="inline-flex items-center gap-1 text-[11px] underline opacity-70 hover:opacity-100"
                style={{ color: TEXT_DARK }}
              >
                <Eraser className="h-3 w-3" /> Limpar
              </button>
            </div>
            <div className="rounded-sm" style={{ border: `1px dashed ${GOLD}aa`, background: "#fff" }}>
              <SignaturePad ref={padRef} onChange={setEmpty} />
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span className="text-[11px] leading-snug" style={{ color: TEXT_DARK, opacity: 0.85 }}>
              Li o documento e concordo com todo o seu conteúdo. Reconheço esta assinatura eletrônica como válida.
            </span>
          </label>

          <Button
            type="button"
            disabled={signing || empty || !accepted || missing.length > 0}
            onClick={handleSign}
            className="h-12 w-full border-0 hover:opacity-90 disabled:opacity-50 touch-manipulation"
            style={{ background: GOLD, color: TEXT_DARK, fontFamily: SANS, fontWeight: 700, letterSpacing: "0.06em" }}
          >
            {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><ShieldCheck className="h-4 w-4 mr-1.5" />Assinar documento</>)}
          </Button>
        </div>
      )}
    </div>
  );
}
