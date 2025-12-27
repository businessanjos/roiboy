import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function BillingPortal() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to profile page with billing tab
    navigate("/profile?tab=billing", { replace: true });
  }, [navigate]);

  return null;
}
