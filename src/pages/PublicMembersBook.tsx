import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Search, 
  Lock, 
  Phone, 
  Mail, 
  Building2, 
  Users,
  ExternalLink,
  Instagram,
  MessageCircle,
  Filter,
  X,
  ChevronDown,
  SlidersHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  name: string;
  avatar_url?: string;
  company?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  bio?: string;
  products?: string[];
  segment?: string;
  custom_fields?: Record<string, any>;
}

interface CustomFieldFilter {
  id: string;
  name: string;
  field_type: string;
  options?: string[];
  values: string[];
}

interface MembersBookData {
  account_name: string;
  settings: {
    custom_title?: string;
    custom_description?: string;
    show_company: boolean;
    show_email: boolean;
    show_phone: boolean;
    show_instagram: boolean;
    show_bio: boolean;
    show_products: boolean;
  };
  members: Member[];
  total: number;
  filters?: {
    products: string[];
    segments: string[];
    custom_fields?: CustomFieldFilter[];
  };
}

export default function PublicMembersBook() {
  const [searchParams] = useSearchParams();
  // Support both "account" and "account_id" for backwards compatibility
  const accountId = searchParams.get("account") || searchParams.get("account_id");
  
  const [data, setData] = useState<MembersBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [selectedCustomFields, setSelectedCustomFields] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    // Text search filter
    const matchesSearch = !searchTerm || 
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.products?.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Product filter
    const matchesProduct = !selectedProduct || 
      member.products?.some(p => p === selectedProduct);
    
    // Segment filter
    const matchesSegment = !selectedSegment || 
      member.segment === selectedSegment;
    
    // Custom fields filter
    const matchesCustomFields = Object.entries(selectedCustomFields).every(([fieldId, selectedValue]) => {
      if (!selectedValue) return true;
      const fieldValue = member.custom_fields?.[fieldId];
      if (fieldValue === undefined || fieldValue === null) return false;
      
      // Find the field type
      const field = data?.filters?.custom_fields?.find(f => f.id === fieldId);
      if (!field) return false;
      
      if (field.field_type === "multi_select" && Array.isArray(fieldValue)) {
        return fieldValue.includes(selectedValue);
      } else if (field.field_type === "boolean") {
        // Compare with "Sim"/"Não" labels
        return (fieldValue === true && selectedValue === "Sim") || (fieldValue === false && selectedValue === "Não");
      } else {
        return fieldValue === selectedValue;
      }
    });
    
    return matchesSearch && matchesProduct && matchesSegment && matchesCustomFields;
  }) || [];

  const hasActiveFilters = !!selectedProduct || !!selectedSegment || Object.values(selectedCustomFields).some(v => !!v);
  const activeFiltersCount = (selectedProduct ? 1 : 0) + (selectedSegment ? 1 : 0) + Object.values(selectedCustomFields).filter(v => !!v).length;
  const hasFiltersAvailable = (data?.filters?.products?.length || 0) > 0 || 
    (data?.filters?.segments?.length || 0) > 0 || 
    (data?.filters?.custom_fields?.length || 0) > 0;

  const clearFilters = () => {
    setSelectedProduct("");
    setSelectedSegment("");
    setSelectedCustomFields({});
  };

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

          {/* Search and Filters */}
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, empresa ou produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Collapsible Filters */}
            {hasFiltersAvailable && (
              <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                <div className="flex items-center justify-center gap-2">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Filtros
                      {activeFiltersCount > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                          {activeFiltersCount}
                        </Badge>
                      )}
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        filtersOpen && "rotate-180"
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                  
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>

                <CollapsibleContent className="mt-4">
                  <div className="bg-muted/50 rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {data.filters?.products?.length > 0 && (
                        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                          <SelectTrigger className="h-9 bg-background">
                            <SelectValue placeholder="Produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {data.filters.products.map((product) => (
                              <SelectItem key={product} value={product}>
                                {product}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      {data.filters?.segments?.length > 0 && (
                        <Select value={selectedSegment} onValueChange={setSelectedSegment}>
                          <SelectTrigger className="h-9 bg-background">
                            <SelectValue placeholder="Segmento" />
                          </SelectTrigger>
                          <SelectContent>
                            {data.filters.segments.map((segment) => (
                              <SelectItem key={segment} value={segment}>
                                {segment}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      {/* Custom Field Filters */}
                      {data.filters?.custom_fields?.map((field) => (
                        <Select 
                          key={field.id}
                          value={selectedCustomFields[field.id] || ""} 
                          onValueChange={(value) => setSelectedCustomFields(prev => ({ ...prev, [field.id]: value }))}
                        >
                          <SelectTrigger className="h-9 bg-background">
                            <SelectValue placeholder={field.name} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.values.map((value) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
            
            {/* Active filters summary */}
            {hasActiveFilters && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>Mostrando {filteredMembers.length} de {data.total} membros</span>
              </div>
            )}
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

        {/* Bio */}
        {settings.show_bio && member.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {member.bio}
          </p>
        )}

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
        {(settings.show_phone || settings.show_email || settings.show_instagram) && (
          <div className="pt-3 border-t space-y-2">
            {/* Contact icons row */}
            {(settings.show_phone && member.phone) && (
              <div className="flex items-center gap-2">
                <a 
                  href={`https://wa.me/${member.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center h-9 w-9 rounded-full bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                  title="WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
                {settings.show_email && member.email && (
                  <a 
                    href={`mailto:${member.email}`}
                    className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="E-mail"
                  >
                    <Mail className="h-4 w-4" />
                  </a>
                )}
                {settings.show_instagram && member.instagram && (
                  <a 
                    href={member.instagram.startsWith('http') ? member.instagram : `https://instagram.com/${member.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-9 w-9 rounded-full bg-pink-500/10 text-pink-600 hover:bg-pink-500/20 transition-colors"
                    title="Instagram"
                  >
                    <Instagram className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}
            {/* Show email/instagram without phone */}
            {!settings.show_phone || !member.phone ? (
              <div className="flex items-center gap-2">
                {settings.show_email && member.email && (
                  <a 
                    href={`mailto:${member.email}`}
                    className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="E-mail"
                  >
                    <Mail className="h-4 w-4" />
                  </a>
                )}
                {settings.show_instagram && member.instagram && (
                  <a 
                    href={member.instagram.startsWith('http') ? member.instagram : `https://instagram.com/${member.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-9 w-9 rounded-full bg-pink-500/10 text-pink-600 hover:bg-pink-500/20 transition-colors"
                    title="Instagram"
                  >
                    <Instagram className="h-4 w-4" />
                  </a>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
