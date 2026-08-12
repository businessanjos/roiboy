import { Navigate, useLocation } from "react-router-dom";

interface PreserveQueryRedirectProps {
  /** Rota de destino (sem query string). */
  to: string;
  /** Parâmetros forçados no destino (ex.: `{ tab: "redes" }`). */
  params?: Record<string, string>;
}

/**
 * Redireciona rotas antigas do Marketing preservando a query string original
 * (ex.: `?platform=` e `?postId=` de /social-media).
 */
export function PreserveQueryRedirect({ to, params }: PreserveQueryRedirectProps) {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  Object.entries(params ?? {}).forEach(([key, value]) => search.set(key, value));
  const qs = search.toString();
  return <Navigate to={qs ? `${to}?${qs}` : to} replace />;
}

export default PreserveQueryRedirect;
