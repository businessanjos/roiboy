import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
  showHome?: boolean;
}

// Route to label mapping
const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  clients: "Clientes",
  new: "Novo",
  events: "Eventos",
  tasks: "Tarefas",
  products: "Produtos",
  forms: "Formulários",
  integrations: "Integrações",
  settings: "Configurações",
  team: "Equipe",
  notifications: "Notificações",
  admin: "Admin",
  profile: "Perfil",
  account: "Conta",
};

export function Breadcrumbs({ items, className, showHome = true }: BreadcrumbsProps) {
  const location = useLocation();
  
  // Auto-generate breadcrumbs from path if items not provided
  const breadcrumbItems = items || generateBreadcrumbs(location.pathname);
  
  if (breadcrumbItems.length === 0) return null;
  
  return (
    <nav 
      aria-label="Breadcrumb" 
      className={cn("flex items-center text-sm text-muted-foreground", className)}
    >
      <ol className="flex items-center gap-1">
        {showHome && (
          <>
            <li>
              <Link 
                to="/dashboard" 
                className="hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
                aria-label="Início"
              >
                <Home className="h-4 w-4" />
              </Link>
            </li>
            {breadcrumbItems.length > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            )}
          </>
        )}
        
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          
          return (
            <li key={item.href || item.label} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link 
                  to={item.href}
                  className="hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
                >
                  {item.label}
                </Link>
              ) : (
                <span 
                  className={cn(
                    "px-1.5 py-0.5",
                    isLast && "text-foreground font-medium"
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              
              {!isLast && (
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [];
  let currentPath = "";
  
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;
    
    // Skip UUIDs
    if (isUUID(segment)) {
      items.push({
        label: "Detalhes",
        href: isLast ? undefined : currentPath,
      });
      return;
    }
    
    const label = routeLabels[segment] || capitalizeFirst(segment);
    
    items.push({
      label,
      href: isLast ? undefined : currentPath,
    });
  });
  
  return items;
}

function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
