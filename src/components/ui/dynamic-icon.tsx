import * as Icons from "lucide-react";
import { LucideProps } from "lucide-react";
import { ComponentType } from "react";

interface DynamicIconProps extends LucideProps {
  name: string;
}

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  // Convert common icon name formats to PascalCase
  const pascalName = name
    .split(/[-_\s]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  
  const iconsMap = Icons as unknown as Record<string, ComponentType<LucideProps>>;
  const IconComponent = iconsMap[pascalName] || iconsMap[name] || Icons.Circle;
    
  return <IconComponent {...props} />;
}
