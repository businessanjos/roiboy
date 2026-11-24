import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { Bold, Italic, List, ListOrdered, Highlighter, Eraser, Undo2, Redo2, Plus, Expand, Shrink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { markerInk, TASK_MARKER_COLORS, validMarkerColor } from "@/lib/marketing/taskDescription";
import { linkTaskDocument, safeTaskLinkHref } from "@/lib/marketing/taskLinks";
import { createTaskMentionExtension, type TaskMentionPerson } from "./TaskMentions";
import { TaskTimestampExtension } from "./TaskTimestampExtension";
import "./task-editor.css";

const SafeHighlight = Highlight.extend({
  renderHTML({ HTMLAttributes }) {
    const color = validMarkerColor(HTMLAttributes["data-color"]) ? HTMLAttributes["data-color"] as string : TASK_MARKER_COLORS[0].color;
    return ["mark", { "data-color": color, style: `background-color: ${color}; color: ${markerInk(color)};` }, 0];
  },
});
export function TaskDescriptionEditor({ initialContent, valueKey, onChange, colors, onColorsChange, disabled, portalContainer, label = "Descrição", compact = false, mentionPeople, placeholder, footer }: {
  initialContent: JSONContent; valueKey: string; onChange: (text: string, document: JSONContent) => void;
  colors: string[]; onColorsChange: (colors: string[]) => void; disabled?: boolean; portalContainer: HTMLElement | null;
  label?: string; compact?: boolean;
  mentionPeople?: TaskMentionPerson[];
  placeholder?: string; footer?: React.ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [customColor, setCustomColor] = useState<string>();
  const [expanded, setExpanded] = useState(false);
  const [, redraw] = useState(0);
  const peopleRef = useRef(mentionPeople ?? []);
  peopleRef.current = mentionPeople ?? [];
  const linkedContent = useMemo(() => linkTaskDocument(initialContent), [initialContent]);
  const contentRef = useRef(linkedContent);
  contentRef.current = linkedContent;
  const mentions = useMemo(() => createTaskMentionExtension(() => peopleRef.current), []);
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false, blockquote: false, code: false, codeBlock: false, horizontalRule: false, link: {
      autolink: true, linkOnPaste: true, defaultProtocol: "https", openOnClick: false,
      isAllowedUri: (href) => !!safeTaskLinkHref(href), shouldAutoLink: (href) => !!safeTaskLinkHref(href),
      HTMLAttributes: { target: "_blank", rel: "noopener noreferrer", class: "cursor-pointer text-info underline decoration-info/40 underline-offset-4 hover:decoration-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" },
    }, underline: false, strike: false }), SafeHighlight.configure({ multicolor: true }), ...(!compact ? [TaskTimestampExtension] : []), ...(mentionPeople ? [mentions] : [])],
    content: linkedContent,
    editable: !disabled,
    editorProps: {
      attributes: { role: "textbox", "aria-label": label, "aria-multiline": "true", spellcheck: "true", ...(placeholder ? { "aria-placeholder": placeholder } : {}) },
      handleClick: (view, _position, event) => {
        if (event.button !== 0 || !(event.target instanceof Element)) return false;
        const anchor = event.target.closest("a[href]");
        if (!anchor || !view.dom.contains(anchor)) return false;
        const href = safeTaskLinkHref(anchor.getAttribute("href"));
        event.preventDefault();
        if (href) window.open(href, "_blank", "noopener,noreferrer");
        return true;
      },
    },
    onUpdate: ({ editor: updated }) => onChange(updated.getText({ blockSeparator: "\n" }), updated.getJSON()),
    onSelectionUpdate: () => redraw((value) => value + 1),
    onTransaction: () => redraw((value) => value + 1),
  });
  useEffect(() => { if (editor) editor.commands.setContent(contentRef.current, { emitUpdate: false }); }, [valueKey, editor]);
  useEffect(() => { editor?.setEditable(!disabled, false); }, [disabled, editor]);
  const apply = (color: string) => { if (!editor || !validMarkerColor(color)) return; editor.chain().focus().setHighlight({ color }).run(); setPaletteOpen(false); };
  const tool = (name: string, icon: React.ReactNode, action: () => void, active = false, unavailable = false) => <Tooltip key={name}>
    <TooltipTrigger asChild><Button type="button" variant={active ? "secondary" : "ghost"} size="icon" aria-label={name} className={cn(compact ? "h-8 w-8" : "h-9 w-9")} disabled={disabled || unavailable || !editor}
      onMouseDown={(e) => e.preventDefault()} onClick={action}>{icon}</Button></TooltipTrigger><TooltipContent>{name}</TooltipContent>
  </Tooltip>;
  return <div className={cn("task-description-editor overflow-hidden rounded-md border bg-background focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/10", expanded && "expanded", compact && "compact")}>
    <div role="toolbar" aria-label={`Formatação ${compact ? "do comentário" : "da descrição"}`} className="flex flex-wrap items-center gap-0.5 border-b bg-muted/25 px-2 py-1.5">
      {tool("Negrito", <Bold className="h-4 w-4" />, () => editor?.chain().focus().toggleBold().run(), editor?.isActive("bold"))}
      {tool("Itálico", <Italic className="h-4 w-4" />, () => editor?.chain().focus().toggleItalic().run(), editor?.isActive("italic"))}
      <span className="mx-1 h-5 w-px bg-border" />
      {tool("Lista", <List className="h-4 w-4" />, () => editor?.chain().focus().toggleBulletList().run(), editor?.isActive("bulletList"))}
      {tool("Lista numerada", <ListOrdered className="h-4 w-4" />, () => editor?.chain().focus().toggleOrderedList().run(), editor?.isActive("orderedList"))}
      <span className="mx-1 h-5 w-px bg-border" />
      <Popover open={paletteOpen} onOpenChange={setPaletteOpen}>
        <Tooltip><TooltipTrigger asChild><PopoverTrigger asChild><Button type="button" variant={editor?.isActive("highlight") ? "secondary" : "ghost"} size="icon" className={cn(compact ? "h-8 w-8" : "h-9 w-9")} aria-label="Marca-texto" aria-pressed={editor?.isActive("highlight") ?? false} disabled={disabled || !editor} onMouseDown={(e) => e.preventDefault()}
          onClick={(event) => {
            if (!editor?.isActive("highlight")) return;
            event.preventDefault();
            editor.chain().focus().unsetHighlight().run();
            setPaletteOpen(false);
          }}><Highlighter className="h-4 w-4" /></Button></PopoverTrigger></TooltipTrigger><TooltipContent>Marca-texto</TooltipContent></Tooltip>
        <PopoverContent portalContainer={portalContainer} align="start" className="w-64 space-y-3" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex flex-wrap gap-2">
            {TASK_MARKER_COLORS.map((color) => <Button key={color.name} type="button" variant="outline" size="icon" title={color.name} aria-label={`Destacar em ${color.name}`} className={cn("h-10 w-10", color.className)} onClick={() => apply(color.color)} />)}
            {colors.map((color) => <Button key={color} type="button" variant="outline" size="icon" title={color} aria-label={`Destacar em ${color}`} className="h-10 w-10" style={{ backgroundColor: color }} onClick={() => apply(color)} />)}
          </div>
          <div className="flex items-center gap-2 border-t pt-3">
            <Input type="color" aria-label="Criar cor de destaque" className="h-9 w-12 p-1" {...(customColor ? { value: customColor } : {})} onChange={(event) => setCustomColor(event.target.value)} />
            <Button type="button" variant="outline" size="sm" disabled={!customColor} onClick={() => { if (!customColor) return; onColorsChange([...new Set([...colors, customColor])]); apply(customColor); }}><Plus className="h-4 w-4" />Criar cor</Button>
          </div>
          <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={() => { editor?.chain().focus().unsetHighlight().run(); setPaletteOpen(false); }}><Eraser className="h-4 w-4" />Remover destaque</Button>
        </PopoverContent>
      </Popover>
      <span className="mx-1 h-5 w-px bg-border" />
      {tool("Desfazer", <Undo2 className="h-4 w-4" />, () => editor?.chain().focus().undo().run(), false, !editor?.can().undo())}
      {tool("Refazer", <Redo2 className="h-4 w-4" />, () => editor?.chain().focus().redo().run(), false, !editor?.can().redo())}
      <span className="flex-1" />
      {!compact && tool(expanded ? "Recolher descrição" : "Ampliar descrição", expanded ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />, () => setExpanded(!expanded))}
    </div>
    <div className="relative">
      <EditorContent editor={editor} />
      {placeholder && editor?.isEmpty && <span aria-hidden="true" className="task-editor-placeholder pointer-events-none absolute inset-x-0 top-0 text-muted-foreground">{placeholder}</span>}
    </div>
    {footer && <div className="flex items-center justify-end px-3 pb-3 pt-1">{footer}</div>}
  </div>;
}