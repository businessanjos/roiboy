import { MapPin, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddressLinkProps {
  address: string;
  className?: string;
  showIcon?: boolean;
  iconClassName?: string;
}

export function AddressLink({ 
  address, 
  className, 
  showIcon = true,
  iconClassName = "w-4 h-4"
}: AddressLinkProps) {
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <a
      href={googleMapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 text-primary hover:underline hover:text-primary/80 transition-colors",
        className
      )}
    >
      {showIcon && <MapPin className={iconClassName} />}
      <span>{address}</span>
      <ExternalLink className="w-3 h-3 opacity-60" />
    </a>
  );
}
