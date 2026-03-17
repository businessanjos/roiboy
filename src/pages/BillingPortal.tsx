import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function BillingPortal() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/settings?tab=billing", { replace: true });
  }, [navigate]);

  return null;
}
