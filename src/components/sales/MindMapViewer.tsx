import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2, Download, ChevronRight, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

// ==================== TYPES ====================

interface MindMapNode {
  id: string;
  label: string;
  children: MindMapNode[];
  level: number;
  color: string;
  description?: string; // Step label like "PREPARAÇÃO", "PASSO 1", etc.
}

// Step labels for the commercial process sections
const COMMERCIAL_STEP_LABELS = [
  'PREPARAÇÃO',
  'ABERTURA',
  'PASSO 1',
  'PASSO 2',
  'PASSO 3',
  'PASSO 4',
  'PASSO 5',
  'PASSO 6',
  'PASSO 7',
  'PASSO 8',
  'PASSO 9',
  'PASSO 10',
];

// Step labels for the SDR process
const SDR_STEP_LABELS = [
  'ETAPA 1',
  'ETAPA 2',
  'ETAPA 3',
  'ETAPA 4',
  'ETAPA 5',
  'ETAPA 6',
  'ETAPA 7',
  'ETAPA 8',
  'ETAPA 9',
  'ETAPA 10',
];

// ==================== BRANCH COLORS ====================

const BRANCH_COLORS = [
  '#2bb5a0', // teal
  '#c06bc7', // magenta
  '#e05252', // red
  '#7c5bbf', // purple
  '#d660a8', // pink
  '#4a7fd4', // blue
  '#6e5bbf', // indigo
  '#8b7a3a', // olive
  '#e08a3a', // orange
];

// ==================== PARSER ====================

function parseMarkdownToTree(content: string, scriptType?: string): MindMapNode {
  const lines = content.split('\n');
  const isSDR = scriptType === 'sdr';
  const STEP_LABELS = isSDR ? SDR_STEP_LABELS : COMMERCIAL_STEP_LABELS;
  const root: MindMapNode = { id: 'root', label: isSDR ? 'PROCESSO SDR' : 'PROCESSO COMERCIAL', children: [], level: 0, color: '#C5A053' };

  // Detect if content uses tree format (├─, └─, |) instead of markdown
  const isTreeFormat = content.includes('├─') || content.includes('└─');

  if (isTreeFormat) {
    return parseTreeFormatToTree(content, isSDR, STEP_LABELS);
  }

  let currentH2: MindMapNode | null = null;
  let currentH3: MindMapNode | null = null;
  let currentH4: MindMapNode | null = null;
  let colorIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '---') continue;

    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      root.label = trimmed.replace(/^# /, '').replace(/\*\*/g, '').trim();
      continue;
    }

    if (trimmed.startsWith('## ')) {
      const color = BRANCH_COLORS[colorIndex % BRANCH_COLORS.length];
      let sectionLabel = trimmed.replace(/^## /, '').replace(/\*\*/g, '').replace(/^\d+\.\s*/, '').trim();
      
      const isPreparacao = sectionLabel.toLowerCase().includes('contexto') && sectionLabel.toLowerCase().includes('objetivo');
      if (isPreparacao) {
        sectionLabel = 'Preparação';
      }
      
      const stepLabel = STEP_LABELS[colorIndex] || `PASSO ${colorIndex}`;
      colorIndex++;
      currentH2 = {
        id: `h2-${root.children.length}`,
        label: sectionLabel,
        children: [],
        level: 1,
        color,
        description: stepLabel,
      };

      if (isPreparacao) {
        currentH2.children.push({
          id: `prep-1`,
          label: 'SE PREPARAR EMOCIONALMENTE PARA A LIGAÇÃO. Se certificar de que está bem, beber água e deixar a sala num clima agradável. Ter pensamentos positivos e entrar na call com a cabeça de que JÁ VENDEU/ESSA VENDA JÁ É SUA.',
          children: [],
          level: 2,
          color,
        });
        currentH2.children.push({
          id: `prep-2`,
          label: 'Entusiasmo e brilho nos olhos durante uma apresentação convence mais do que QUALQUER script.',
          children: [],
          level: 2,
          color,
        });
      }

      root.children.push(currentH2);
      currentH3 = null;
      currentH4 = null;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      const parent = currentH2 || root;
      currentH3 = {
        id: `h3-${parent.children.length}-${Math.random().toString(36).substr(2, 4)}`,
        label: trimmed.replace(/^### /, '').replace(/\*\*/g, '').trim(),
        children: [],
        level: 2,
        color: parent.color,
      };
      parent.children.push(currentH3);
      currentH4 = null;
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      const parent = currentH3 || currentH2 || root;
      currentH4 = {
        id: `h4-${parent.children.length}-${Math.random().toString(36).substr(2, 4)}`,
        label: trimmed.replace(/^#### /, '').replace(/\*\*/g, '').trim(),
        children: [],
        level: 3,
        color: parent.color,
      };
      parent.children.push(currentH4);
      continue;
    }

    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      const parent = currentH4 || currentH3 || currentH2 || root;
      parent.children.push({
        id: `bold-${Math.random().toString(36).substr(2, 6)}`,
        label: trimmed.replace(/\*\*/g, '').replace(/:$/, '').trim(),
        children: [],
        level: parent.level + 1,
        color: parent.color,
      });
      continue;
    }

    if (trimmed.startsWith('>')) {
      const text = trimmed.replace(/^>\s*/, '').replace(/\*\*/g, '').trim();
      if (text.length < 3) continue;
      const parent = currentH4 || currentH3 || currentH2 || root;
      parent.children.push({
        id: `quote-${Math.random().toString(36).substr(2, 6)}`,
        label: text,
        children: [],
        level: parent.level + 1,
        color: parent.color,
      });
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const text = trimmed.replace(/^[-*] /, '').replace(/\*\*/g, '').trim();
      if (text.length < 3) continue;
      const parent = currentH4 || currentH3 || currentH2 || root;
      parent.children.push({
        id: `leaf-${Math.random().toString(36).substr(2, 6)}`,
        label: text,
        children: [],
        level: parent.level + 1,
        color: parent.color,
      });
    }
  }

  return root;
}

/**
 * Fallback parser for tree-format content (├─, └─, |)
 * Converts indentation-based tree into the same MindMapNode structure
 */
function parseTreeFormatToTree(content: string, isSDR: boolean, STEP_LABELS: string[]): MindMapNode {
  const root: MindMapNode = { id: 'root', label: isSDR ? 'PROCESSO SDR' : 'PROCESSO COMERCIAL', children: [], level: 0, color: '#C5A053' };
  const lines = content.split('\n');

  // Extract title from first non-empty line that is not a tree connector
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip lines that are just | or tree connectors
    if (/^[|├└─\s]+$/.test(trimmed)) continue;
    // Title line (before tree starts)
    if (!trimmed.startsWith('├') && !trimmed.startsWith('└') && !trimmed.startsWith('|')) {
      if (trimmed.includes('|')) {
        root.label = trimmed.split('|').map(s => s.trim()).filter(Boolean).join(' — ');
      } else if (trimmed.length > 3) {
        root.label = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
      }
      break;
    }
    // If first content line is already a tree node, skip title extraction
    break;
  }

  // Calculate the "column position" of tree characters to determine depth
  // The actual content uses patterns like:
  // ├─ Level 1
  // |   ├─ Level 2  
  // |   |   ├─ Level 3
  
  interface StackEntry { node: MindMapNode; col: number; }
  const stack: StackEntry[] = [{ node: root, col: -1 }];
  let colorIndex = 0;

  for (const line of lines) {
    // Find position of ├ or └ in the line
    const branchIndex = line.search(/[├└]/);
    if (branchIndex === -1) continue;
    
    // Extract the label after ├─ or └─
    const afterBranch = line.substring(branchIndex).replace(/^[├└]─\s*/, '').trim();
    let label = afterBranch.replace(/\*\*/g, '').replace(/[""]/g, '"').trim();
    
    // Clean emoji number prefixes like 1️⃣
    label = label.replace(/^[\d]️⃣\s*/, '').replace(/^[①-⑳]\s*/, '').trim();
    
    if (label.length < 2) continue;

    // Use column position of ├/└ to determine depth
    const col = branchIndex;

    // Pop stack until we find a parent with smaller column
    while (stack.length > 1 && stack[stack.length - 1].col >= col) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].node;
    const depth = stack.length - 1;
    const color = depth <= 1 
      ? BRANCH_COLORS[colorIndex % BRANCH_COLORS.length] 
      : parent.color;

    const node: MindMapNode = {
      id: `tree-${Math.random().toString(36).substr(2, 6)}`,
      label,
      children: [],
      level: depth,
      color,
    };

    // Add step labels for depth-1 nodes
    if (depth === 1) {
      node.description = STEP_LABELS[colorIndex] || `ETAPA ${colorIndex + 1}`;
      colorIndex++;
    }

    parent.children.push(node);
    stack.push({ node, col });
  }

  return root;
}

// ==================== COLLAPSIBLE NODE COMPONENT ====================

interface NodeProps {
  node: MindMapNode;
  depth: number;
  isRoot?: boolean;
  isLast?: boolean;
  onEditNode: (id: string, newLabel: string) => void;
}

function MindMapNodeComponent({ node, depth, isRoot = false, onEditNode }: NodeProps) {
  const [collapsed, setCollapsed] = useState(depth >= 1);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.label);
  const hasChildren = node.children.length > 0;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(node.label);
    setEditing(true);
  };

  const handleBlur = () => {
    setEditing(false);
    if (editValue.trim() && editValue !== node.label) {
      onEditNode(node.id, editValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBlur(); }
    if (e.key === 'Escape') { setEditing(false); setEditValue(node.label); }
  };

  const childCount = countAllChildren(node);
  const nodeColor = isRoot ? '#C5A053' : node.color;

  // Step label for depth-1 nodes
  const stepLabel = depth === 1 ? node.description : undefined;

  // Spacing increases with depth for breathing room
  const verticalGap = depth <= 1 ? 'gap-5' : depth === 2 ? 'gap-3.5' : 'gap-2.5';

  // Node sizing per depth  
  const nodeStyles = isRoot
    ? "px-9 py-6 text-2xl font-bold rounded-xl shadow-lg"
    : depth === 1
      ? "px-7 py-4 text-lg font-semibold rounded-lg shadow-sm"
      : depth === 2
        ? "px-6 py-3.5 text-base font-medium rounded-lg"
        : "px-5 py-3 text-sm rounded-md";

  return (
    <div className="flex items-start">
      {/* Node + collapse toggle */}
      <div className="flex flex-col items-start shrink-0">
        {/* Step label badge above depth-1 nodes */}
        {stepLabel && (
          <div 
            className="mb-1.5 ml-1 flex items-center gap-1.5"
          >
            <span
              className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{
                backgroundColor: `${nodeColor}20`,
                color: nodeColor,
                border: `1px solid ${nodeColor}40`,
              }}
            >
              {stepLabel}
            </span>
          </div>
        )}
        <div className="flex items-center">
          <div
            className={cn(
              "relative flex items-center gap-2.5 border select-none transition-all duration-200 cursor-pointer",
              nodeStyles,
              !isRoot && "hover:shadow-md hover:brightness-110",
            )}
            style={isRoot ? {
              background: 'linear-gradient(135deg, #ffffff 0%, #faf6ec 100%)',
              borderColor: '#C5A053',
              boxShadow: '0 4px 18px rgba(197, 160, 83, 0.22)',
              color: '#8a6d2a',
            } : {
              backgroundColor: '#ffffff',
              borderColor: `${node.color}66`,
              borderLeft: `4px solid ${node.color}`,
              color: '#1f2937',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
            }}
            onDoubleClick={handleDoubleClick}
          >
            {/* Label */}
            {editing ? (
              <textarea
                ref={textareaRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="bg-transparent outline-none resize-none text-foreground min-w-[140px] max-w-[420px] leading-snug"
                style={{ fontSize: 'inherit', fontWeight: 'inherit' }}
                rows={Math.min(4, Math.ceil(editValue.length / 45))}
              />
            ) : (
              <span
                className={cn(
                  "leading-snug",
                  isRoot ? "" : "text-foreground/90",
                  depth >= 3 && "max-w-[320px] whitespace-normal"
                )}
              >
                {node.label}
              </span>
            )}
          </div>

          {/* Connector line + Collapse/Expand toggle circle */}
          {hasChildren && (
            <div className="flex items-center shrink-0">
              <div 
                className="h-[2px]" 
                style={{ 
                  width: depth === 0 ? '28px' : '20px',
                  backgroundColor: nodeColor, 
                  opacity: 0.35 
                }} 
              />
              <button
                onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
                className="flex items-center justify-center shrink-0 rounded-full border-2 transition-all duration-200 hover:scale-125 z-10"
                style={{ 
                  width: depth <= 1 ? '24px' : '20px',
                  height: depth <= 1 ? '24px' : '20px',
                  borderColor: nodeColor,
                  backgroundColor: collapsed ? nodeColor : 'transparent',
                  color: collapsed ? '#fff' : nodeColor,
                }}
                title={collapsed ? `Expandir (${childCount})` : 'Recolher'}
              >
                <span className="text-[11px] font-bold leading-none">
                  {collapsed ? '+' : '−'}
                </span>
              </button>
              {/* Line from toggle to children */}
              {!collapsed && (
                <div 
                  className="h-[2px]" 
                  style={{ 
                    width: '20px',
                    backgroundColor: nodeColor, 
                    opacity: 0.25 
                  }} 
                />
              )}
            </div>
          )}
        </div>

        {/* Collapsed child count label */}
        {hasChildren && collapsed && (
          <span
            className="mt-1 ml-auto mr-0 text-[10px] font-medium opacity-60"
            style={{ color: nodeColor }}
          >
            {childCount} {childCount === 1 ? 'item' : 'itens'}
          </span>
        )}
      </div>

      {/* Children column */}
      {hasChildren && !collapsed && (
        <div 
          className={cn("flex flex-col relative animate-fade-in", verticalGap)}
          style={{ paddingTop: '4px', paddingBottom: '4px' }}
        >
          {/* Vertical connector line */}
          {node.children.length > 1 && (
            <div
              className="absolute left-0 rounded-full"
              style={{
                backgroundColor: nodeColor,
                opacity: 0.2,
                width: '2px',
                top: depth <= 1 ? '20px' : '14px',
                bottom: depth <= 1 ? '20px' : '14px',
              }}
            />
          )}
          {node.children.map((child, i) => (
            <div key={child.id} className="flex items-center">
              {/* Horizontal branch from vertical line */}
              <div 
                className="shrink-0 h-[2px]" 
                style={{ 
                  width: depth <= 1 ? '24px' : '16px',
                  backgroundColor: child.color, 
                  opacity: 0.25 
                }} 
              />
              <MindMapNodeComponent
                node={child}
                depth={depth + 1}
                isLast={i === node.children.length - 1}
                onEditNode={onEditNode}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function countAllChildren(node: MindMapNode): number {
  let count = node.children.length;
  for (const child of node.children) count += countAllChildren(child);
  return count;
}

// ==================== MAIN COMPONENT ====================

interface MindMapViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  title: string;
  scriptType?: string;
}

export default function MindMapViewer({ open, onOpenChange, content, title, scriptType }: MindMapViewerProps) {
  const [zoom, setZoom] = useState(0.75);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [tree, setTree] = useState<MindMapNode>(() => parseMarkdownToTree(content, scriptType));

  useEffect(() => { setTree(parseMarkdownToTree(content, scriptType)); }, [content, scriptType]);

  useEffect(() => {
    if (open) { setZoom(0.75); setPan({ x: 60, y: 60 }); }
  }, [open]);

  const handleEditNode = useCallback((id: string, newLabel: string) => {
    setTree(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as MindMapNode;
      function findAndUpdate(node: MindMapNode): boolean {
        if (node.id === id) { node.label = newLabel; return true; }
        for (const child of node.children) { if (findAndUpdate(child)) return true; }
        return false;
      }
      findAndUpdate(updated);
      return updated;
    });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(z => Math.max(0.15, Math.min(2.5, z + (e.deltaY > 0 ? -0.05 : 0.05))));
    } else {
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { setIsPanning(true); setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const handleFitView = useCallback(() => { setZoom(0.75); setPan({ x: 60, y: 60 }); }, []);

  const handleExportPDF = useCallback(async () => {
    if (!contentRef.current) return;
    try {
      toast.info('Gerando PDF do mapa mental...');
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: '#0a0a12',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`mapa-mental-${title.replace(/\s+/g, '-').toLowerCase()}.pdf`);
      toast.success('PDF exportado!');
    } catch (err) {
      console.error('Erro ao exportar:', err);
      toast.error('Erro ao gerar PDF');
    }
  }, [title]);

  const handleCollapseAll = useCallback(() => {
    setTree(prev => {
      const updated = JSON.parse(JSON.stringify(prev)) as MindMapNode;
      return updated;
    });
    // Force re-render with fresh tree to reset collapse states
    setTree(parseMarkdownToTree(content));
  }, [content]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[96vw] max-h-[96vh] h-[92vh] p-0 overflow-hidden border-border/50">
        {/* Header */}
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary text-lg">
                🧠
              </span>
              <div className="flex flex-col">
                <span>Mapa Mental</span>
                <span className="text-[11px] font-normal text-muted-foreground truncate max-w-[300px]">{title}</span>
              </div>
            </DialogTitle>

            <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setZoom(z => Math.min(2.5, z + 0.1))}>
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <span className="text-[11px] text-muted-foreground w-10 text-center font-mono tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setZoom(z => Math.max(0.15, z - 0.1))}>
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <div className="w-px h-4 bg-border mx-0.5" />
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={handleFitView} title="Resetar visão">
                <Maximize2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={handleCollapseAll} title="Recolher tudo">
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
              <div className="w-px h-4 bg-border mx-0.5" />
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs rounded-md px-2.5" onClick={handleExportPDF}>
                <Download className="w-3.5 h-3.5" />
                PDF
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1.5 tracking-wide uppercase">
            Duplo clique para editar • Setas para expandir/colapsar • Scroll para navegar • Ctrl+Scroll para zoom
          </p>
        </DialogHeader>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex-1 w-full overflow-hidden relative"
          style={{ 
            height: 'calc(92vh - 90px)', 
            cursor: isPanning ? 'grabbing' : 'grab',
            background: 'radial-gradient(ellipse at center, hsl(240 10% 6%) 0%, hsl(240 10% 3%) 100%)',
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Subtle grid pattern */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, hsl(43 50% 55%) 1px, transparent 1px)',
              backgroundSize: '30px 30px',
            }}
          />

          <div
            ref={contentRef}
            className="inline-flex p-16"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <MindMapNodeComponent
              node={tree}
              depth={0}
              isRoot
              onEditNode={handleEditNode}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
