import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string | null;
}

interface Props {
  penColor?: string;
  backgroundColor?: string;
  height?: number;
  onChange?: (empty: boolean) => void;
}

/** Canvas de assinatura à mão livre (mouse, caneta ou dedo). */
const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { penColor = "#1d1208", backgroundColor = "#ffffff", height = 180, onChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [, force] = useState(0);

  const setup = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth || 300;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = penColor;
  };

  useEffect(() => {
    setup();
    const onResize = () => { setup(); dirty.current = false; onChange?.(true); force((n) => n + 1); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    clear: () => { setup(); dirty.current = false; onChange?.(true); force((n) => n + 1); },
    isEmpty: () => !dirty.current,
    toDataURL: () => (dirty.current ? canvasRef.current?.toDataURL("image/png") || null : null),
  }));

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!dirty.current) { dirty.current = true; onChange?.(false); force((n) => n + 1); }
  };

  const end = () => { drawing.current = false; };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      className="w-full touch-none rounded-sm cursor-crosshair"
      style={{ background: backgroundColor }}
    />
  );
});

export default SignaturePad;
