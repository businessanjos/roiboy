import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote } from "lucide-react";

interface WhatsAppFormattingToolbarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  id?: string;
  disabled?: boolean;
}

export function WhatsAppFormattingToolbar({
  value,
  onChange,
  placeholder = "Digite sua mensagem...",
  rows = 4,
  className = "",
  id,
  disabled = false,
}: WhatsAppFormattingToolbarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertFormatting = useCallback((formatType: 'bold' | 'italic' | 'strikethrough' | 'monospace' | 'quote' | 'bulletList' | 'numberedList') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    let prefix = '';
    let suffix = '';
    let isLinePrefix = false;
    
    switch (formatType) {
      case 'bold':
        prefix = '*';
        suffix = '*';
        break;
      case 'italic':
        prefix = '_';
        suffix = '_';
        break;
      case 'strikethrough':
        prefix = '~';
        suffix = '~';
        break;
      case 'monospace':
        prefix = '```';
        suffix = '```';
        break;
      case 'quote':
        prefix = '> ';
        isLinePrefix = true;
        break;
      case 'bulletList':
        prefix = '• ';
        isLinePrefix = true;
        break;
      case 'numberedList':
        prefix = '1. ';
        isLinePrefix = true;
        break;
    }
    
    let newText: string;
    
    if (isLinePrefix) {
      // For line-based formatting, add prefix to each line
      if (selectedText) {
        const lines = selectedText.split('\n');
        const formattedLines = lines.map((line, index) => {
          if (formatType === 'numberedList') {
            return `${index + 1}. ${line}`;
          }
          return `${prefix}${line}`;
        });
        newText = value.substring(0, start) + formattedLines.join('\n') + value.substring(end);
      } else {
        // No selection - just add prefix at cursor
        newText = value.substring(0, start) + prefix + value.substring(end);
      }
    } else {
      newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
    }
    
    onChange(newText);
    
    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = selectedText 
        ? start + (isLinePrefix ? prefix.length + selectedText.length : prefix.length + selectedText.length + suffix.length)
        : start + prefix.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [value, onChange]);

  return (
    <div className={className}>
      <TooltipProvider>
        <div className="flex items-center gap-1 p-1 border rounded-t-md bg-muted/30 border-b-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => insertFormatting('bold')}
                disabled={disabled}
              >
                <Bold className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Negrito (*texto*)</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => insertFormatting('italic')}
                disabled={disabled}
              >
                <Italic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Itálico (_texto_)</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => insertFormatting('strikethrough')}
                disabled={disabled}
              >
                <Strikethrough className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Tachado (~texto~)</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => insertFormatting('monospace')}
                disabled={disabled}
              >
                <Code className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Monoespaçado (```texto```)</p>
            </TooltipContent>
          </Tooltip>
          
          <div className="w-px h-5 bg-border mx-1" />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => insertFormatting('quote')}
                disabled={disabled}
              >
                <Quote className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Citação (&gt; texto)</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => insertFormatting('bulletList')}
                disabled={disabled}
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Lista com marcadores (• item)</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => insertFormatting('numberedList')}
                disabled={disabled}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Lista numerada (1. item)</p>
            </TooltipContent>
          </Tooltip>
          
          <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
            Selecione o texto e clique para formatar
          </span>
        </div>
      </TooltipProvider>
      
      <Textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="rounded-t-none font-mono text-sm"
        disabled={disabled}
      />
    </div>
  );
}