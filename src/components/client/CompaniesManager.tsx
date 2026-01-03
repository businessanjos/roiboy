import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, X, Building2, Loader2, Check, AlertCircle } from "lucide-react";
import { formatCNPJ, validateCNPJ, formatCEP } from "@/lib/validators";

export interface CompanyData {
  cnpj: string;
  name: string;
  trading_name?: string;
  segment?: string;
  niche?: string;
  street?: string;
  street_number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

interface CompaniesManagerProps {
  companies: CompanyData[];
  onChange: (companies: CompanyData[]) => void;
  label?: string;
}

export function CompaniesManager({ companies, onChange, label = "Empresas Adicionais" }: CompaniesManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [formData, setFormData] = useState<CompanyData>({
    cnpj: "",
    name: "",
    trading_name: "",
    segment: "",
    niche: "",
    street: "",
    street_number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip_code: "",
  });

  const resetForm = () => {
    setFormData({
      cnpj: "",
      name: "",
      trading_name: "",
      segment: "",
      niche: "",
      street: "",
      street_number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      zip_code: "",
    });
    setEditIndex(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    setFormData(companies[index]);
    setEditIndex(index);
    setDialogOpen(true);
  };

  const handleCNPJChange = async (value: string) => {
    const formatted = formatCNPJ(value);
    setFormData(prev => ({ ...prev, cnpj: formatted }));

    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 14 && validateCNPJ(formatted)) {
      setCnpjLoading(true);
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
        if (response.ok) {
          const cnpjData = await response.json();
          setFormData(prev => ({
            ...prev,
            cnpj: formatted,
            name: cnpjData.razao_social || prev.name,
            trading_name: cnpjData.nome_fantasia || prev.trading_name,
            street: cnpjData.logradouro || prev.street,
            street_number: cnpjData.numero || prev.street_number,
            complement: cnpjData.complemento || prev.complement,
            neighborhood: cnpjData.bairro || prev.neighborhood,
            city: cnpjData.municipio || prev.city,
            state: cnpjData.uf || prev.state,
            zip_code: cnpjData.cep ? formatCEP(cnpjData.cep) : prev.zip_code,
          }));
        }
      } catch (error) {
        console.error("Erro ao buscar CNPJ:", error);
      } finally {
        setCnpjLoading(false);
      }
    }
  };

  const handleSave = () => {
    if (!formData.cnpj.trim() && !formData.name.trim()) return;

    if (editIndex !== null) {
      const updated = [...companies];
      updated[editIndex] = formData;
      onChange(updated);
    } else {
      onChange([...companies, formData]);
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleRemove = (index: number) => {
    onChange(companies.filter((_, i) => i !== index));
  };

  const cnpjDigits = formData.cnpj.replace(/\D/g, "");
  const isCnpjValid = cnpjDigits.length === 14 && validateCNPJ(formData.cnpj);
  const isCnpjPartial = cnpjDigits.length > 0 && cnpjDigits.length < 14;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={openAddDialog}
        >
          <Plus className="h-4 w-4" />
          Adicionar Empresa
        </Button>
      </div>

      {companies.length > 0 && (
        <div className="space-y-2">
          {companies.map((company, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => openEditDialog(index)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {company.trading_name || company.name || "Empresa sem nome"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {company.cnpj && <span>{company.cnpj}</span>}
                    {company.segment && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {company.segment}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-destructive/20 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(index);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {editIndex !== null ? "Editar Empresa" : "Adicionar Empresa"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <div className="relative">
                <Input
                  value={formData.cnpj}
                  onChange={(e) => handleCNPJChange(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  className={`pr-9 ${
                    isCnpjValid
                      ? "border-emerald-500/50 ring-1 ring-emerald-500/20"
                      : cnpjDigits.length === 14 && !isCnpjValid
                        ? "border-destructive ring-1 ring-destructive/30"
                        : ""
                  }`}
                />
                {cnpjLoading ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : isCnpjValid ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                    <Check className="h-4 w-4" />
                  </div>
                ) : cnpjDigits.length === 14 ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive">
                    <X className="h-4 w-4" />
                  </div>
                ) : null}
              </div>
              {cnpjDigits.length === 14 && !isCnpjValid && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  CNPJ inválido
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Razão Social</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Razão Social"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nome Fantasia</Label>
                <Input
                  value={formData.trading_name || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, trading_name: e.target.value }))}
                  placeholder="Nome Fantasia"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Segmento</Label>
                <Input
                  value={formData.segment || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, segment: e.target.value }))}
                  placeholder="Ex: Varejo"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nicho</Label>
                <Input
                  value={formData.niche || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, niche: e.target.value }))}
                  placeholder="Ex: Moda"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Endereço (preenchido automaticamente pelo CNPJ)</Label>
              {formData.street && (
                <p className="text-sm text-muted-foreground">
                  {formData.street}, {formData.street_number}
                  {formData.complement && ` - ${formData.complement}`}
                  {formData.neighborhood && `, ${formData.neighborhood}`}
                  {formData.city && ` - ${formData.city}`}
                  {formData.state && `/${formData.state}`}
                  {formData.zip_code && ` - ${formData.zip_code}`}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!formData.cnpj.trim() && !formData.name.trim()}>
              {editIndex !== null ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
