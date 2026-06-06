import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Camera, X, Loader2, RotateCcw, Check } from "lucide-react";

type Kind = "id" | "address" | "generic";

interface Props {
  open: boolean;
  kind: Kind;
  title?: string;
  onClose: () => void;
  onCapture: (file: File) => void;
}

// Aspect ratios das máscaras (largura/altura)
const FRAME = {
  id: { ratio: 85.6 / 54, label: "Alinhe o documento dentro do quadro" },          // ID-1 padrão (CNH/RG)
  address: { ratio: 0.71, label: "Encaixe o comprovante inteiro no quadro" },       // ~A4
  generic: { ratio: 1, label: "Centralize o documento no quadro" },
};

export default function DocumentCameraCapture({ open, kind, title, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const frame = FRAME[kind] ?? FRAME.generic;

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setShot(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setReady(true);
      }
    } catch (e: any) {
      setError(
        e?.name === "NotAllowedError"
          ? "Permissão de câmera negada. Use o botão de envio de arquivo."
          : "Não consegui abrir a câmera. Use o botão de envio de arquivo."
      );
    }
  }, []);

  useEffect(() => {
    if (open) start();
    return () => stop();
    // eslint-disable-next-line
  }, [open]);

  const snap = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !ready) return;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (!w || !h) return;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    setShot(c.toDataURL("image/jpeg", 0.92));
  };

  const confirm = async () => {
    if (!shot) return;
    setBusy(true);
    try {
      const blob = await (await fetch(shot)).blob();
      const file = new File([blob], `doc-${Date.now()}.jpg`, { type: "image/jpeg" });
      onCapture(file);
      stop();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="text-xs uppercase tracking-[0.25em] opacity-80">{title || "Tirar foto"}</div>
        <button onClick={() => { stop(); onClose(); }} aria-label="Fechar" className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-white/10 active:bg-white/20">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Viewfinder */}
      <div className="relative flex-1 overflow-hidden">
        {!shot && (
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover bg-black"
          />
        )}
        {shot && <img src={shot} alt="prévia" className="absolute inset-0 w-full h-full object-contain bg-black" />}

        {/* Mask overlay */}
        {!shot && (
          <div className="absolute inset-0 pointer-events-none">
            <FrameOverlay ratio={frame.ratio} label={frame.label} />
          </div>
        )}

        {/* Loading / error */}
        {!ready && !error && !shot && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <p className="text-center text-white/85 text-sm leading-relaxed max-w-xs">{error}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-6 py-5 flex items-center justify-center gap-6 text-white">
        {!shot && (
          <button
            disabled={!ready}
            onClick={snap}
            aria-label="Tirar foto"
            className="h-16 w-16 rounded-full border-4 border-white/90 bg-white/0 active:bg-white/30 disabled:opacity-40 inline-flex items-center justify-center"
          >
            <span className="h-12 w-12 rounded-full bg-white" />
          </button>
        )}
        {shot && (
          <>
            <button
              onClick={() => setShot(null)}
              className="h-12 px-5 rounded-full bg-white/10 active:bg-white/20 inline-flex items-center gap-2 text-sm"
            >
              <RotateCcw className="h-4 w-4" /> Refazer
            </button>
            <button
              disabled={busy}
              onClick={confirm}
              className="h-12 px-6 rounded-full bg-white text-black inline-flex items-center gap-2 text-sm font-semibold active:opacity-80"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Usar foto
            </button>
          </>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function FrameOverlay({ ratio, label }: { ratio: number; label: string }) {
  // Frame ocupa ~88% da largura, com aspect ratio definido
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <div
        className="relative"
        style={{
          width: "88%",
          maxWidth: 720,
          aspectRatio: String(ratio),
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          borderRadius: 14,
        }}
      >
        {/* Cantos */}
        {[
          "top-0 left-0 border-t-2 border-l-2 rounded-tl-lg",
          "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
          "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
          "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg",
        ].map((cls, i) => (
          <span key={i} className={`absolute w-8 h-8 border-white ${cls}`} />
        ))}
      </div>
      <div className="mt-5 px-4 py-2 rounded-full bg-black/55 text-white text-xs sm:text-sm tracking-wide text-center max-w-[85%]">
        {label}
      </div>
    </div>
  );
}
