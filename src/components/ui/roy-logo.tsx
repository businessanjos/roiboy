import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import royLogoLight from "@/assets/roy-logo-light.png";
import royLogoDark from "@/assets/roy-logo-dark.png";

interface RoyLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-16 w-16",
};

export function RoyLogo({ className = "", size = "md" }: RoyLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by showing light logo initially
  const logoSrc = mounted && resolvedTheme === "dark" ? royLogoDark : royLogoLight;

  return (
    <img
      src={logoSrc}
      alt="ROY"
      className={`object-contain ${sizeClasses[size]} ${className}`}
    />
  );
}
