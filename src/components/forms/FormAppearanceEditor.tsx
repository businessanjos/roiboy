import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Palette, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { FormLogoUpload } from "./FormLogoUpload";
import {
  FormAppearance,
  DEFAULT_APPEARANCE,
  THEME_PRESETS,
  CARD_WIDTH_OPTIONS,
  BORDER_RADIUS_OPTIONS,
} from "./FormAppearance.types";

interface FormAppearanceEditorProps {
  appearance: FormAppearance;
  onChange: (appearance: FormAppearance) => void;
  accountId: string;
  formId?: string;
}

export function FormAppearanceEditor({
  appearance,
  onChange,
  accountId,
  formId,
}: FormAppearanceEditorProps) {
  const currentAppearance = { ...DEFAULT_APPEARANCE, ...appearance };

  const updateAppearance = (updates: Partial<FormAppearance>) => {
    onChange({ ...currentAppearance, ...updates });
  };

  const applyPreset = (presetKey: keyof typeof THEME_PRESETS) => {
    const preset = THEME_PRESETS[presetKey];
    onChange({ ...currentAppearance, ...preset.appearance });
  };

  return (
    <div className="space-y-6">
      {/* Logo Upload */}
      <FormLogoUpload
        currentUrl={currentAppearance.logo_url}
        accountId={accountId}
        formId={formId}
        onUpload={(url) => updateAppearance({ logo_url: url })}
        onRemove={() => updateAppearance({ logo_url: undefined })}
      />

      {/* Logo Position */}
      {currentAppearance.logo_url && (
        <div className="space-y-2">
          <Label>Posição do Logo</Label>
          <div className="flex gap-2">
            <Button
              variant={currentAppearance.logo_position === "left" ? "default" : "outline"}
              size="sm"
              onClick={() => updateAppearance({ logo_position: "left" })}
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={currentAppearance.logo_position === "center" ? "default" : "outline"}
              size="sm"
              onClick={() => updateAppearance({ logo_position: "center" })}
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              variant={currentAppearance.logo_position === "right" ? "default" : "outline"}
              size="sm"
              onClick={() => updateAppearance({ logo_position: "right" })}
            >
              <AlignRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Theme Presets */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Temas Prontos
        </Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(THEME_PRESETS).map(([key, preset]) => (
            <Button
              key={key}
              variant="outline"
              size="sm"
              onClick={() => applyPreset(key as keyof typeof THEME_PRESETS)}
              className="text-xs"
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Background Type */}
      <div className="space-y-2">
        <Label>Tipo de Fundo</Label>
        <RadioGroup
          value={currentAppearance.background_type}
          onValueChange={(value) =>
            updateAppearance({ background_type: value as "solid" | "gradient" })
          }
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="solid" id="bg-solid" />
            <Label htmlFor="bg-solid" className="cursor-pointer">
              Cor Sólida
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="gradient" id="bg-gradient" />
            <Label htmlFor="bg-gradient" className="cursor-pointer">
              Gradiente
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-4">
        {currentAppearance.background_type === "solid" ? (
          <div className="space-y-2">
            <Label>Cor de Fundo</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={currentAppearance.background_color}
                onChange={(e) => updateAppearance({ background_color: e.target.value })}
                className="w-12 h-9 p-1 cursor-pointer"
              />
              <Input
                type="text"
                value={currentAppearance.background_color}
                onChange={(e) => updateAppearance({ background_color: e.target.value })}
                className="flex-1 font-mono text-sm"
                placeholder="#f5f5f5"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Cor Inicial</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={currentAppearance.gradient_start}
                  onChange={(e) => updateAppearance({ gradient_start: e.target.value })}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={currentAppearance.gradient_start}
                  onChange={(e) => updateAppearance({ gradient_start: e.target.value })}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor Final</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={currentAppearance.gradient_end}
                  onChange={(e) => updateAppearance({ gradient_end: e.target.value })}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={currentAppearance.gradient_end}
                  onChange={(e) => updateAppearance({ gradient_end: e.target.value })}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label>Fundo do Card</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={currentAppearance.card_background}
              onChange={(e) => updateAppearance({ card_background: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              type="text"
              value={currentAppearance.card_background}
              onChange={(e) => updateAppearance({ card_background: e.target.value })}
              className="flex-1 font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Cor Primária (botões)</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={currentAppearance.primary_color}
              onChange={(e) => updateAppearance({ primary_color: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              type="text"
              value={currentAppearance.primary_color}
              onChange={(e) => updateAppearance({ primary_color: e.target.value })}
              className="flex-1 font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Cor do Texto</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={currentAppearance.text_color}
              onChange={(e) => updateAppearance({ text_color: e.target.value })}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              type="text"
              value={currentAppearance.text_color}
              onChange={(e) => updateAppearance({ text_color: e.target.value })}
              className="flex-1 font-mono text-sm"
            />
          </div>
        </div>
      </div>

      {/* Card Dimensions */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Largura do Card</Label>
          <Select
            value={currentAppearance.card_width}
            onValueChange={(value) =>
              updateAppearance({ card_width: value as FormAppearance["card_width"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CARD_WIDTH_OPTIONS).map(([key, opt]) => (
                <SelectItem key={key} value={key}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Bordas Arredondadas</Label>
          <Select
            value={currentAppearance.border_radius}
            onValueChange={(value) =>
              updateAppearance({ border_radius: value as FormAppearance["border_radius"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(BORDER_RADIUS_OPTIONS).map(([key, opt]) => (
                <SelectItem key={key} value={key}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Title Options */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Exibir Título</Label>
          <Switch
            checked={currentAppearance.show_title}
            onCheckedChange={(checked) => updateAppearance({ show_title: checked })}
          />
        </div>

        {currentAppearance.show_title && (
          <div className="space-y-2">
            <Label>Alinhamento do Título</Label>
            <div className="flex gap-2">
              <Button
                variant={currentAppearance.title_alignment === "left" ? "default" : "outline"}
                size="sm"
                onClick={() => updateAppearance({ title_alignment: "left" })}
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={currentAppearance.title_alignment === "center" ? "default" : "outline"}
                size="sm"
                onClick={() => updateAppearance({ title_alignment: "center" })}
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                variant={currentAppearance.title_alignment === "right" ? "default" : "outline"}
                size="sm"
                onClick={() => updateAppearance({ title_alignment: "right" })}
              >
                <AlignRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Options */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Exibir Rodapé</Label>
          <Switch
            checked={currentAppearance.show_footer}
            onCheckedChange={(checked) => updateAppearance({ show_footer: checked })}
          />
        </div>

        {currentAppearance.show_footer && (
          <div className="space-y-2">
            <Label>Texto do Rodapé</Label>
            <Input
              value={currentAppearance.footer_text}
              onChange={(e) => updateAppearance({ footer_text: e.target.value })}
              placeholder="Powered by ROY"
            />
          </div>
        )}
      </div>
    </div>
  );
}
