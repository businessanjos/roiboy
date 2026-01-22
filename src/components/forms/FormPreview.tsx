import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Smartphone, Tablet, Monitor, Loader2 } from "lucide-react";
import {
  FormAppearance,
  DEFAULT_APPEARANCE,
  CARD_WIDTH_OPTIONS,
  BORDER_RADIUS_OPTIONS,
} from "./FormAppearance.types";

interface CustomField {
  id: string;
  name: string;
  field_type: string;
  options?: string[] | null;
  is_required?: boolean;
}

interface FormPreviewProps {
  formData: {
    title: string;
    description: string;
    require_client_info: boolean;
    fields: string[];
    appearance?: FormAppearance;
  };
  customFields: CustomField[];
}

type DeviceSize = "mobile" | "tablet" | "desktop";

const DEVICE_WIDTHS: Record<DeviceSize, string> = {
  mobile: "max-w-[375px]",
  tablet: "max-w-[768px]",
  desktop: "max-w-full",
};

export function FormPreview({ formData, customFields }: FormPreviewProps) {
  const [device, setDevice] = useState<DeviceSize>("desktop");
  
  const appearance = { ...DEFAULT_APPEARANCE, ...formData.appearance };
  const selectedFields = customFields.filter((f) => formData.fields.includes(f.id));

  const getBackgroundStyle = (): React.CSSProperties => {
    if (appearance.background_type === "gradient") {
      return {
        background: `linear-gradient(135deg, ${appearance.gradient_start} 0%, ${appearance.gradient_end} 100%)`,
      };
    }
    return { backgroundColor: appearance.background_color };
  };

  const cardWidthClass = CARD_WIDTH_OPTIONS[appearance.card_width || "md"].class;
  const borderRadiusClass = BORDER_RADIUS_OPTIONS[appearance.border_radius || "lg"].class;

  const titleAlignmentClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[appearance.title_alignment || "center"];

  const logoAlignmentClass = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
  }[appearance.logo_position || "center"];

  const renderField = (field: CustomField) => {
    switch (field.field_type) {
      case "boolean":
        return (
          <div className="flex items-center justify-between">
            <Label style={{ color: appearance.text_color }}>{field.name}</Label>
            <Switch disabled />
          </div>
        );
      case "single_choice":
        return (
          <div className="space-y-2">
            <Label style={{ color: appearance.text_color }}>
              {field.name}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <RadioGroup disabled>
              {field.options?.map((option, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${field.id}-${idx}`} disabled />
                  <Label 
                    htmlFor={`${field.id}-${idx}`} 
                    style={{ color: appearance.text_color }}
                    className="opacity-70"
                  >
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      case "multiple_choice":
        return (
          <div className="space-y-2">
            <Label style={{ color: appearance.text_color }}>
              {field.name}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="space-y-2">
              {field.options?.map((option, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <Checkbox id={`${field.id}-${idx}`} disabled />
                  <Label 
                    htmlFor={`${field.id}-${idx}`}
                    style={{ color: appearance.text_color }}
                    className="opacity-70"
                  >
                    {option}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );
      case "long_text":
        return (
          <div className="space-y-2">
            <Label style={{ color: appearance.text_color }}>
              {field.name}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              disabled
              placeholder="Resposta do usuário..."
              className="resize-none"
              style={{ color: appearance.text_color }}
            />
          </div>
        );
      default:
        return (
          <div className="space-y-2">
            <Label style={{ color: appearance.text_color }}>
              {field.name}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              disabled
              placeholder="Resposta do usuário..."
              style={{ color: appearance.text_color }}
            />
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Device Selector */}
      <div className="flex items-center justify-center gap-2 p-2 bg-muted rounded-lg">
        <Button
          variant={device === "mobile" ? "default" : "ghost"}
          size="sm"
          onClick={() => setDevice("mobile")}
        >
          <Smartphone className="h-4 w-4 mr-1" />
          Mobile
        </Button>
        <Button
          variant={device === "tablet" ? "default" : "ghost"}
          size="sm"
          onClick={() => setDevice("tablet")}
        >
          <Tablet className="h-4 w-4 mr-1" />
          Tablet
        </Button>
        <Button
          variant={device === "desktop" ? "default" : "ghost"}
          size="sm"
          onClick={() => setDevice("desktop")}
        >
          <Monitor className="h-4 w-4 mr-1" />
          Desktop
        </Button>
      </div>

      {/* Preview Container */}
      <div
        className={`mx-auto transition-all duration-300 ${DEVICE_WIDTHS[device]} rounded-lg overflow-hidden border shadow-lg`}
        style={{ minHeight: "500px" }}
      >
        <div
          className="min-h-[500px] p-4 flex items-start justify-center"
          style={getBackgroundStyle()}
        >
          <Card
            className={`w-full ${cardWidthClass} ${borderRadiusClass} shadow-xl mt-8`}
            style={{ backgroundColor: appearance.card_background }}
          >
            <CardHeader className={titleAlignmentClass}>
              {/* Logo */}
              {appearance.logo_url && (
                <div className={`flex ${logoAlignmentClass} mb-4`}>
                  <img
                    src={appearance.logo_url}
                    alt="Logo"
                    className="h-16 object-contain"
                  />
                </div>
              )}

              {/* Title */}
              {appearance.show_title !== false && (
                <CardTitle 
                  className="text-2xl font-bold"
                  style={{ color: appearance.text_color }}
                >
                  {formData.title || "Título do Formulário"}
                </CardTitle>
              )}

              {/* Description */}
              {formData.description && (
                <CardDescription
                  style={{ color: appearance.text_color, opacity: 0.7 }}
                >
                  {formData.description}
                </CardDescription>
              )}
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Client Info Section */}
              {formData.require_client_info && (
                <div className="space-y-4 pb-4 border-b">
                  <div className="space-y-2">
                    <Label style={{ color: appearance.text_color }}>
                      Nome Completo <span className="text-red-500">*</span>
                    </Label>
                    <Input disabled placeholder="Seu nome..." />
                  </div>
                  <div className="space-y-2">
                    <Label style={{ color: appearance.text_color }}>
                      Telefone <span className="text-red-500">*</span>
                    </Label>
                    <Input disabled placeholder="(00) 00000-0000" />
                  </div>
                </div>
              )}

              {/* Custom Fields */}
              {selectedFields.length > 0 ? (
                <div className="space-y-4">
                  {selectedFields.map((field) => (
                    <div key={field.id}>{renderField(field)}</div>
                  ))}
                </div>
              ) : (
                <div 
                  className="text-center py-8 opacity-50"
                  style={{ color: appearance.text_color }}
                >
                  Nenhum campo selecionado
                </div>
              )}

              {/* Submit Button */}
              <Button
                className="w-full"
                style={{
                  backgroundColor: appearance.primary_color,
                  color: appearance.card_background,
                }}
                disabled
              >
                <Loader2 className="h-4 w-4 mr-2 animate-spin opacity-0" />
                Enviar Respostas
              </Button>
            </CardContent>

            {/* Footer */}
            {appearance.show_footer !== false && appearance.footer_text && (
              <div
                className="text-center py-4 text-xs opacity-50"
                style={{ color: appearance.text_color }}
              >
                {appearance.footer_text}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
