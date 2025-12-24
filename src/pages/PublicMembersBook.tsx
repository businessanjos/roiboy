import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, 
  Lock, 
  Phone, 
  Mail, 
  Building2, 
  Users,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  name: string;
  avatar_url?: string;
  company?: string;
  phone?: string;
  email?: string;
  products?: string[];
}

interface MembersBookData {
  account_name: string;
  settings: {
    custom_title?: string;
    custom_description?: string;
    show_company: boolean;
    show_email: boolean;
    show_phone: boolean;
    show_products: boolean;
  };
  members: Member[];
  total: number;
}

export default function PublicMembersBook() {
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get("account");
  
  const [data, setData] = useState<MembersBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingSettings, setPendingSettings] = useState<{ custom_title?: string; custom_description?: string } | null>(null);

  const fetchMembersBook = async (accessPassword?: string) => {
    if (!accountId) {
      setError("ID da conta não fornecido");
      setLoading(false);
      return;
    }

    setLoading(true);
    setPasswordError(false);

    try {
      const params = new URLSearchParams({ account_id: accountId });
      if (accessPassword) {
        params.append("password", accessPassword);
      }

      const { data: responseData, error: responseError } = await supabase.functions.invoke(
        "members-book",
        {
          body: null,
          headers: {},
        }
      );

      // Use fetch directly since we need query params
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/members-book?${params.toString()}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401 && result.requires_password) {
          setRequiresPassword(true);
          setPendingSettings(result.settings);
          if (accessPassword) {
            setPasswordError(true);
          }
        } else {
          setError(result.error || "Erro ao carregar Members Book");
        }
        setLoading(false);
        return;
      }

      setData(result);
      setRequiresPassword(false);
    } catch (err) {
      console.error("Error fetching members book:", err);
      setError("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembersBook();
  }, [accountId]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMembersBook(password);
  };

  const filteredMembers = data?.members.filter(member => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      member.name.toLowerCase().includes(search) ||
      member.company?.toLowerCase().includes(search) ||
      member.products?.some(p => p.toLowerCase().includes(search))
    );
  }) || [];

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .slice(0, 2)
      .map(n => n[0])
      .join("")
      .toUpperCase();
  };

  const formatPhone = (phone: string) => {
    // Remove non-digits
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 13) {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse space-y-4 text-center">
          <div className="h-12 w-12 rounded-full bg-primary/20 mx-auto" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <Users className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Ops!</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {pendingSettings?.custom_title || "Members Book"}
            </h1>
            {pendingSettings?.custom_description && (
              <p className="text-muted-foreground">{pendingSettings.custom_description}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Este conteúdo é protegido por senha
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Digite a senha de acesso"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(
                  "text-center text-lg",
                  passwordError && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {passwordError && (
                <p className="text-sm text-destructive text-center">
                  Senha incorreta. Tente novamente.
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" size="lg">
              Acessar
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container py-6 space-y-4">
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              {data.settings.custom_title || "Members Book"}
            </h1>
            {data.settings.custom_description && (
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {data.settings.custom_description}
              </p>
            )}
            <Badge variant="secondary" className="mt-2">
              <Users className="h-3 w-3 mr-1" />
              {data.total} membros
            </Badge>
          </div>

          {/* Search */}
          <div className="max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, empresa ou produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Members Grid */}
      <main className="container py-8">
        {filteredMembers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchTerm ? "Nenhum membro encontrado para esta busca" : "Nenhum membro disponível"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMembers.map((member) => (
              <MemberCard 
                key={member.id} 
                member={member} 
                settings={data.settings}
                formatPhone={formatPhone}
                getInitials={getInitials}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>Powered by ROY</p>
      </footer>
    </div>
  );
}

interface MemberCardProps {
  member: Member;
  settings: MembersBookData["settings"];
  formatPhone: (phone: string) => string;
  getInitials: (name: string) => string;
}

function MemberCard({ member, settings, formatPhone, getInitials }: MemberCardProps) {
  return (
    <div className="group relative bg-card rounded-xl border shadow-card overflow-hidden transition-all duration-300 hover:shadow-elevated hover:-translate-y-1">
      {/* Gradient top accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/40" />
      
      <div className="p-6 space-y-4">
        {/* Avatar and name */}
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 ring-2 ring-primary/20">
            <AvatarImage src={member.avatar_url} alt={member.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
              {getInitials(member.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate text-lg">
              {member.name}
            </h3>
            {settings.show_company && member.company && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{member.company}</span>
              </p>
            )}
          </div>
        </div>

        {/* Products */}
        {settings.show_products && member.products && member.products.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {member.products.slice(0, 3).map((product, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className="text-xs font-normal"
              >
                {product}
              </Badge>
            ))}
            {member.products.length > 3 && (
              <Badge variant="outline" className="text-xs font-normal">
                +{member.products.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Contact info */}
        {(settings.show_phone || settings.show_email) && (
          <div className="pt-3 border-t space-y-2">
            {settings.show_phone && member.phone && (
              <a 
                href={`https://wa.me/${member.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors group/link"
              >
                <Phone className="h-3.5 w-3.5" />
                <span className="truncate">{formatPhone(member.phone)}</span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
              </a>
            )}
            {settings.show_email && member.email && (
              <a 
                href={`mailto:${member.email}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors group/link"
              >
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{member.email}</span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
