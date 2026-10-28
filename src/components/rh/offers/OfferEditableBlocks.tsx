import { useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";

export type OfferBlock = {
  id: string;
  title: string;
  body: string;
  kind?: "detail" | "strip" | "text";
  icon?: string;
  anchor?: StripAnchor;
  /** Faixa comprida de destaque: ocupa as duas colunas. */
  wide?: boolean;
};
export type StripAnchor = "after_details" | "after_benefits" | "end";

export type OfferBlocksEditor = {
  snapshot: () => void;
  update: (id: string, patch: Partial<OfferBlock>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  insert: (afterId: string | null, block: Omit<OfferBlock, "id">, groupIds: string[]) => void;
  reorder: (orderedIds: string[]) => void;
};

type IconMap = Record<string, { label: string; Icon: React.ComponentType<{ className?: string }> }>;

const CARD = "#ede6cb";
const TEXT_DARK = "#3b2510";
const GOLD = "#c9a86a";
const SERIF = "'Merriweather', Georgia, serif";

type Variant = "detail" | "strip" | "text";

/**
 * Grupo de blocos personalizados da carta-proposta.
 * Sem `editor`: renderiza só a leitura (página do candidato).
 * Com `editor`: arrastar para reordenar, editar no lugar, inserir, duplicar e excluir.
 */
export function OfferEditableBlocks({
  variant, items, editor, icons, template, gridClassName, addLabel, emptyHint,
}: {
  variant: Variant;
  items: OfferBlock[];
  editor?: OfferBlocksEditor;
  icons: IconMap;
  template: Omit<OfferBlock, "id">;
  gridClassName?: string;
  addLabel: string;
  emptyHint?: boolean;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const visible = editor ? items : items.filter((b) => b.title?.trim() || b.body?.trim());
  if (!editor) {
    if (!visible.length) return null;
    return <div className={gridClassName}>{visible.map((b) => <div key={b.id} className={b.wide ? "col-span-full" : undefined}><BlockBody variant={variant} block={b} icons={icons} /></div>)}</div>;
  }
  const ids = items.map((b) => b.id);
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    if (from < 0 || to < 0) return;
    editor.snapshot();
    editor.reorder(arrayMove(ids, from, to));
  };
  return (
    <div data-no-section-click className={emptyHint && !items.length ? "" : undefined}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          {items.length > 0 && (
            <div className={gridClassName}>
              {items.map((b) => (
                <SortableBlock key={b.id} variant={variant} block={b} icons={icons} editor={editor} onInsertAfter={() => { editor.snapshot(); editor.insert(b.id, template, ids); }} />
              ))}
            </div>
          )}
        </SortableContext>
      </DndContext>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => { editor.snapshot(); editor.insert(ids[ids.length - 1] ?? null, template, ids); }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-sm border border-dashed text-xs uppercase tracking-[0.2em] transition-opacity ${items.length ? "py-2 opacity-40 hover:opacity-100" : "py-3 opacity-60 hover:opacity-100"}`}
          style={{ borderColor: `${GOLD}80`, color: GOLD }}
        >
          <Plus className="h-3.5 w-3.5" /> {addLabel}
        </button>
        {variant === "strip" && (
          <button
            type="button"
            onClick={() => { editor.snapshot(); editor.insert(ids[ids.length - 1] ?? null, { ...template, wide: true, icon: "star" }, ids); }}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-sm border border-dashed text-xs uppercase tracking-[0.2em] transition-opacity ${items.length ? "py-2 opacity-40 hover:opacity-100" : "py-3 opacity-60 hover:opacity-100"}`}
            style={{ borderColor: `${GOLD}80`, color: GOLD }}
          >
            <MoveHorizontal className="h-3.5 w-3.5" /> Faixa comprida (aviso)
          </button>
        )}
      </div>
    </div>
  );
}

function SortableBlock({ variant, block, icons, editor, onInsertAfter }: { variant: Variant; block: OfferBlock; icons: IconMap; editor: OfferBlocksEditor; onInsertAfter: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const [iconOpen, setIconOpen] = useState(false);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined, opacity: isDragging ? 0.85 : 1 }}
      className="group/blk relative"
    >
      <BlockBody variant={variant} block={block} icons={icons} editor={editor} onIconClick={variant !== "text" ? () => setIconOpen((v) => !v) : undefined} />
      {/* alça */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        title="Arrastar para mover"
        className="absolute -left-3 top-1/2 -translate-y-1/2 h-7 w-5 flex items-center justify-center rounded-sm opacity-0 group-hover/blk:opacity-100 cursor-grab active:cursor-grabbing shadow"
        style={{ background: GOLD, color: TEXT_DARK }}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {/* mini-barra */}
      <div className="absolute -top-3 right-2 flex gap-1 opacity-0 group-hover/blk:opacity-100 transition-opacity">
        <ToolBtn title="Inserir abaixo" onClick={onInsertAfter}><Plus className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn title="Duplicar" onClick={() => { editor.snapshot(); editor.duplicate(block.id); }}><Copy className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn title="Excluir" onClick={() => { editor.snapshot(); editor.remove(block.id); }}><Trash2 className="h-3.5 w-3.5" /></ToolBtn>
      </div>
      {iconOpen && (
        <div className="absolute left-0 top-full mt-1 z-30 grid grid-cols-7 gap-1 p-2 rounded-md shadow-xl" style={{ background: "#1a120a", border: `1px solid ${GOLD}60` }}>
          {Object.entries(icons).map(([k, { label, Icon }]) => (
            <button
              key={k}
              type="button"
              title={label}
              onClick={() => { editor.snapshot(); editor.update(block.id, { icon: k }); setIconOpen(false); }}
              className="h-8 w-8 flex items-center justify-center rounded-sm hover:opacity-100"
              style={{ background: block.icon === k ? GOLD : `${GOLD}25`, color: block.icon === k ? TEXT_DARK : GOLD }}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className="h-6 w-6 flex items-center justify-center rounded-full shadow" style={{ background: GOLD, color: TEXT_DARK }}>
      {children}
    </button>
  );
}

function InlineText({ value, placeholder, editor, id, field, className, style, multiline }: {
  value: string; placeholder: string; editor?: OfferBlocksEditor; id: string; field: "title" | "body"; className?: string; style?: React.CSSProperties; multiline?: boolean;
}) {
  if (!editor) return <span className={className} style={style}>{value}</span>;
  const common = {
    value,
    placeholder,
    onFocus: () => editor.snapshot(),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => editor.update(id, { [field]: e.target.value }),
    className: `${className || ""} w-full bg-transparent outline-none rounded-sm placeholder:opacity-40 focus:ring-1 focus:ring-[#c9a86a] hover:bg-black/5 px-0.5`,
    style,
  };
  if (multiline) {
    return <textarea {...common} rows={Math.max(2, value.split("\n").length)} className={`${common.className} resize-none`} />;
  }
  return <input {...common} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />;
}

function BlockBody({ variant, block: b, icons, editor, onIconClick }: { variant: Variant; block: OfferBlock; icons: IconMap; editor?: OfferBlocksEditor; onIconClick?: () => void }) {
  const fallback = variant === "strip" ? "sparkles" : "briefcase";
  const I = (icons[b.icon || ""] || icons[fallback] || Object.values(icons)[0]).Icon;
  const iconEl = onIconClick ? (
    <button type="button" onClick={onIconClick} title="Trocar ícone" className="contents"><I className="h-4 w-4" /></button>
  ) : <I className="h-4 w-4" />;

  if (variant === "detail") {
    return (
      <div className="p-4 sm:p-5 rounded-sm flex items-start gap-3 sm:gap-4" style={{ background: CARD, color: TEXT_DARK, boxShadow: `inset 0 0 0 1px ${GOLD}30` }}>
        <div className={`p-2 sm:p-2.5 rounded-sm flex-shrink-0 ${onIconClick ? "cursor-pointer" : ""}`} style={{ background: `${GOLD}25`, color: TEXT_DARK }} onClick={onIconClick}>
          <I className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <InlineText editor={editor} id={b.id} field="title" value={b.title} placeholder="Título" className="block text-[10px] uppercase tracking-[0.25em] sm:tracking-[0.3em] opacity-60 font-semibold" />
          <InlineText editor={editor} id={b.id} field="body" value={b.body} placeholder="Conteúdo" className="block font-medium text-sm mt-1 sm:mt-1.5 break-words" style={{ fontFamily: SERIF }} />
        </div>
      </div>
    );
  }
  if (variant === "strip") {
    return (
      <div className="flex items-center gap-3 px-5 py-4 rounded-sm" style={{ background: CARD, color: TEXT_DARK, boxShadow: `inset 0 0 0 1px ${GOLD}30` }}>
        <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${onIconClick ? "cursor-pointer" : ""}`} style={{ background: `${GOLD}25`, color: TEXT_DARK }} onClick={onIconClick}>
          <I className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
          <InlineText editor={editor} id={b.id} field="title" value={b.title} placeholder="Nome (ex.: Plano de saúde)" className="text-sm font-medium truncate" />
          <InlineText editor={editor} id={b.id} field="body" value={b.body} placeholder="Valor" className={`text-sm font-semibold truncate ${editor ? "text-right" : "max-w-[60%]"}`} />
        </div>
      </div>
    );
  }
  void iconEl;
  return (
    <div className="space-y-4">
      {editor ? (
        <InlineText editor={editor} id={b.id} field="title" value={b.title} placeholder="TÍTULO DO BLOCO" className="block text-[11px] uppercase tracking-[0.35em] font-semibold" style={{ color: GOLD }} />
      ) : b.title?.trim() ? (
        <p className="text-[11px] uppercase tracking-[0.35em] font-semibold" style={{ color: GOLD }}>{b.title}</p>
      ) : null}
      <InlineText editor={editor} id={b.id} field="body" value={b.body} placeholder="Escreva o texto do bloco…" multiline
        className="block text-[15px] md:text-base leading-relaxed whitespace-pre-line" style={{ fontFamily: SERIF, color: "#e8dcc0", fontWeight: 300 }} />
    </div>
  );
}
