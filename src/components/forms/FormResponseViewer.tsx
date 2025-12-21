import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search,
  Download,
  X,
  Calendar as CalendarIcon,
  User,
  Phone,
  FileText,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Link2,
} from "lucide-react";
import { format, isAfter, isBefore, isEqual } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CustomField {
  id: string;
  name: string;
  field_type: string;
  options: any;
  is_required: boolean;
}

interface FormResponse {
  id: string;
  form_id: string;
  client_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  responses: Record<string, any>;
  submitted_at: string;
  clients?: {
    id: string;
    full_name: string;
    phone_e164: string;
    avatar_url?: string;
  } | null;
}

interface FormResponseViewerProps {
  responses: FormResponse[];
  customFields: CustomField[];
  formFields: string[];
  formTitle: string;
  onSaveToClient: (responseId: string, clientId: string) => Promise<void>;
  clients?: Array<{ id: string; full_name: string; phone_e164: string }>;
}

export function FormResponseViewer({
  responses,
  customFields,
  formFields,
  formTitle,
  onSaveToClient,
  clients = [],
}: FormResponseViewerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedFieldFilter, setSelectedFieldFilter] = useState<string>("all");
  const [selectedFieldValue, setSelectedFieldValue] = useState<string>("");
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);
  const [savingToClient, setSavingToClient] = useState(false);
  const [linkingClientId, setLinkingClientId] = useState<string>("");

  // Get ordered fields data
  const orderedFields = useMemo(() => {
    return formFields
      .map((id) => customFields.find((f) => f.id === id))
      .filter(Boolean) as CustomField[];
  }, [formFields, customFields]);

  // Filter responses
  const filteredResponses = useMemo(() => {
    return responses.filter((response) => {
      // Search filter
      const clientName = response.clients?.full_name || response.client_name || "";
      const clientPhone = response.clients?.phone_e164 || response.client_phone || "";
      const matchesSearch =
        searchTerm === "" ||
        clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientPhone.includes(searchTerm);

      // Date filter
      const responseDate = new Date(response.submitted_at);
      const matchesDateFrom = !dateFrom || isAfter(responseDate, dateFrom) || isEqual(responseDate, dateFrom);
      const matchesDateTo = !dateTo || isBefore(responseDate, dateTo) || isEqual(responseDate, dateTo);

      // Field value filter
      let matchesFieldFilter = true;
      if (selectedFieldFilter !== "all" && selectedFieldValue) {
        const fieldValue = response.responses?.[selectedFieldFilter];
        if (Array.isArray(fieldValue)) {
          matchesFieldFilter = fieldValue.includes(selectedFieldValue);
        } else {
          matchesFieldFilter = String(fieldValue).toLowerCase().includes(selectedFieldValue.toLowerCase());
        }
      }

      return matchesSearch && matchesDateFrom && matchesDateTo && matchesFieldFilter;
    });
  }, [responses, searchTerm, dateFrom, dateTo, selectedFieldFilter, selectedFieldValue]);

  // Get option label for select fields
  const getOptionLabel = (field: CustomField, value: string): string => {
    if (!field.options || !Array.isArray(field.options)) return value;
    const option = field.options.find((o: any) => o.value === value);
    return option?.label || value;
  };

  // Render field value
  const renderValue = (field: CustomField, value: any) => {
    if (value === undefined || value === null || value === "") {
      return <span className="text-muted-foreground">—</span>;
    }

    switch (field.field_type) {
      case "boolean":
        return value ? (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <Check className="h-3 w-3 mr-1" /> Sim
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-muted">Não</Badge>
        );

      case "select":
        const option = field.options?.find((o: any) => o.value === value);
        return (
          <Badge
            variant="outline"
            style={{
              backgroundColor: option?.color ? `${option.color}20` : undefined,
              borderColor: option?.color || undefined,
              color: option?.color || undefined,
            }}
          >
            {option?.label || value}
          </Badge>
        );

      case "multi_select":
        if (!Array.isArray(value)) return value;
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((v: string, i: number) => {
              const opt = field.options?.find((o: any) => o.value === v);
              return (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-xs"
                  style={{
                    backgroundColor: opt?.color ? `${opt.color}20` : undefined,
                    borderColor: opt?.color || undefined,
                    color: opt?.color || undefined,
                  }}
                >
                  {opt?.label || v}
                </Badge>
              );
            })}
          </div>
        );

      case "date":
        try {
          return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
        } catch {
          return value;
        }

      case "currency":
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(Number(value));

      case "number":
        return Number(value).toLocaleString("pt-BR");

      case "rating":
        return (
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={cn(
                  "text-lg",
                  star <= value ? "text-amber-400" : "text-muted-foreground/30"
                )}
              >
                ★
              </span>
            ))}
          </div>
        );

      default:
        return <span className="break-words">{String(value)}</span>;
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ["Cliente", "Telefone", "Data", ...orderedFields.map((f) => f.name)];
    const rows = filteredResponses.map((r) => {
      const clientName = r.clients?.full_name || r.client_name || "Não identificado";
      const phone = r.clients?.phone_e164 || r.client_phone || "";
      const date = format(new Date(r.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR });
      const fieldValues = orderedFields.map((field) => {
        const value = r.responses?.[field.id];
        if (value === undefined || value === null) return "";
        if (Array.isArray(value)) return value.map((v) => getOptionLabel(field, v)).join("; ");
        if (field.field_type === "boolean") return value ? "Sim" : "Não";
        if (field.field_type === "select") return getOptionLabel(field, value);
        if (field.field_type === "date") {
          try {
            return format(new Date(value), "dd/MM/yyyy");
          } catch {
            return value;
          }
        }
        if (field.field_type === "currency") return `R$ ${Number(value).toFixed(2)}`;
        return String(value);
      });
      return [clientName, phone, date, ...fieldValues];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `respostas-${formTitle.replace(/[^a-zA-Z0-9]/g, "_")}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso!");
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm("");
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedFieldFilter("all");
    setSelectedFieldValue("");
  };

  const hasActiveFilters = searchTerm || dateFrom || dateTo || selectedFieldFilter !== "all";

  // Handle save to client
  const handleSaveToClient = async () => {
    if (!selectedResponse || !linkingClientId) return;
    setSavingToClient(true);
    try {
      await onSaveToClient(selectedResponse.id, linkingClientId);
      toast.success("Respostas salvas no perfil do cliente!");
      setSelectedResponse(null);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar respostas");
    } finally {
      setSavingToClient(false);
    }
  };

  // Get current response index for navigation
  const currentIndex = selectedResponse
    ? filteredResponses.findIndex((r) => r.id === selectedResponse.id)
    : -1;

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setSelectedResponse(filteredResponses[currentIndex - 1]);
    }
  };

  const goToNext = () => {
    if (currentIndex < filteredResponses.length - 1) {
      setSelectedResponse(filteredResponses[currentIndex + 1]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filters Bar */}
      <div className="p-4 border-b space-y-3 bg-muted/20">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Date From */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "De"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          {/* Date To */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM/yyyy") : "Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          {/* Field Filter */}
          <Select value={selectedFieldFilter} onValueChange={setSelectedFieldFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por campo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os campos</SelectItem>
              {orderedFields.map((field) => (
                <SelectItem key={field.id} value={field.id}>
                  {field.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Field Value Filter */}
          {selectedFieldFilter !== "all" && (
            <Input
              placeholder="Valor do campo..."
              value={selectedFieldValue}
              onChange={(e) => setSelectedFieldValue(e.target.value)}
              className="w-[150px]"
            />
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}

          {/* Export */}
          <Button variant="outline" size="sm" onClick={exportToCSV} className="ml-auto">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          {filteredResponses.length} de {responses.length} resposta(s)
        </div>
      </div>

      {/* Responses Grid */}
      <ScrollArea className="flex-1">
        {filteredResponses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma resposta encontrada</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              {hasActiveFilters
                ? "Tente ajustar os filtros para ver mais resultados."
                : "Compartilhe o formulário para começar a coletar respostas."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filteredResponses.map((response) => {
              const clientName = response.clients?.full_name || response.client_name || "Não identificado";
              const clientPhone = response.clients?.phone_e164 || response.client_phone;
              const hasClient = !!response.clients || !!response.client_id;

              return (
                <Card
                  key={response.id}
                  className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                  onClick={() => setSelectedResponse(response)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={response.clients?.avatar_url} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {clientName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-medium truncate">
                            {clientName}
                          </CardTitle>
                          {clientPhone && (
                            <p className="text-xs text-muted-foreground truncate">
                              {clientPhone}
                            </p>
                          )}
                        </div>
                      </div>
                      {hasClient ? (
                        <Badge variant="outline" className="shrink-0 bg-green-50 text-green-700 border-green-200">
                          <Link2 className="h-3 w-3 mr-1" />
                          Vinculado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0">
                          Avulso
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-xs text-muted-foreground mb-3">
                      {format(new Date(response.submitted_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                    {/* Preview of first 3 fields */}
                    <div className="space-y-2">
                      {orderedFields.slice(0, 3).map((field) => {
                        const value = response.responses?.[field.id];
                        const isEmpty = value === undefined || value === null || value === "";
                        if (isEmpty) return null;

                        return (
                          <div key={field.id} className="text-xs">
                            <span className="text-muted-foreground">{field.name}:</span>{" "}
                            <span className="text-foreground font-medium">
                              {field.field_type === "select"
                                ? getOptionLabel(field, value)
                                : Array.isArray(value)
                                ? value.map((v) => getOptionLabel(field, v)).join(", ")
                                : String(value).slice(0, 50)}
                              {String(value).length > 50 && "..."}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Response Detail Dialog */}
      <Dialog open={!!selectedResponse} onOpenChange={(open) => !open && setSelectedResponse(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          {selectedResponse && (
            <>
              {/* Header with navigation */}
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedResponse.clients?.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {(selectedResponse.clients?.full_name || selectedResponse.client_name || "?")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-lg">
                      {selectedResponse.clients?.full_name || selectedResponse.client_name || "Não identificado"}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(selectedResponse.submitted_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {currentIndex + 1} de {filteredResponses.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={goToPrevious}
                    disabled={currentIndex <= 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={goToNext}
                    disabled={currentIndex >= filteredResponses.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <ScrollArea className="flex-1 px-6 py-4">
                <div className="space-y-6">
                  {/* Client Info Section */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Informações do Cliente
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" /> Nome
                        </Label>
                        <p className="font-medium">
                          {selectedResponse.clients?.full_name || selectedResponse.client_name || "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> Telefone
                        </Label>
                        <p className="font-medium">
                          {selectedResponse.clients?.phone_e164 || selectedResponse.client_phone || "—"}
                        </p>
                      </div>
                    </div>

                    {/* Link to client profile or link action */}
                    {selectedResponse.client_id || selectedResponse.clients ? (
                      <Link
                        to={`/clients/${selectedResponse.client_id || selectedResponse.clients?.id}`}
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Ver perfil do cliente
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                        <Select value={linkingClientId} onValueChange={setLinkingClientId}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecionar cliente para vincular..." />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.full_name} ({client.phone_e164})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={handleSaveToClient}
                          disabled={!linkingClientId || savingToClient}
                        >
                          {savingToClient && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Vincular
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Form Responses Section */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Respostas do Formulário
                    </h3>
                    <div className="divide-y rounded-lg border bg-card">
                      {orderedFields.map((field) => {
                        const value = selectedResponse.responses?.[field.id];

                        return (
                          <div key={field.id} className="flex flex-col sm:flex-row sm:items-start gap-2 p-4">
                            <div className="sm:w-1/3">
                              <Label className="text-sm font-medium text-foreground">
                                {field.name}
                                {field.is_required && <span className="text-destructive ml-1">*</span>}
                              </Label>
                            </div>
                            <div className="sm:w-2/3">
                              {renderValue(field, value)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/20">
                <Button variant="outline" onClick={() => setSelectedResponse(null)}>
                  Fechar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
