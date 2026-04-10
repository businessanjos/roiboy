import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image, FileText, Link2, Play, Mic, Download, ExternalLink } from "lucide-react";
import { Message } from "./types";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ZappMediaGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
  contactName: string;
}

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

function extractLinks(messages: Message[]) {
  const links: { url: string; content: string; date: string; sender: string }[] = [];
  messages.forEach((m) => {
    const matches = m.content?.match(URL_REGEX);
    if (matches) {
      matches.forEach((url) => {
        links.push({
          url,
          content: m.content || "",
          date: m.created_at,
          sender: m.is_from_client ? "Cliente" : m.sender_name || "Você",
        });
      });
    }
  });
  return links.reverse();
}

function categorizeMedia(messages: Message[]) {
  const images: Message[] = [];
  const videos: Message[] = [];
  const audios: Message[] = [];
  const documents: Message[] = [];

  messages.forEach((m) => {
    if (!m.media_url || m.is_deleted) return;
    const type = m.message_type || m.media_type || "";
    if (type.includes("image") || type === "sticker") images.push(m);
    else if (type.includes("video")) videos.push(m);
    else if (type.includes("audio") || type === "ptt") audios.push(m);
    else if (type.includes("document") || type.includes("file")) documents.push(m);
    else if (m.media_mimetype) {
      if (m.media_mimetype.startsWith("image")) images.push(m);
      else if (m.media_mimetype.startsWith("video")) videos.push(m);
      else if (m.media_mimetype.startsWith("audio")) audios.push(m);
      else documents.push(m);
    }
  });

  return { images: images.reverse(), videos: videos.reverse(), audios: audios.reverse(), documents: documents.reverse() };
}

function MediaGrid({ items }: { items: Message[] }) {
  if (items.length === 0) return <EmptyState label="Nenhuma mídia encontrada" />;
  return (
    <div className="grid grid-cols-3 gap-1">
      {items.map((m) => (
        <a
          key={m.id}
          href={m.media_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="aspect-square bg-zapp-bg-dark rounded overflow-hidden relative group"
        >
          <img
            src={m.media_url!}
            alt={m.media_filename || "image"}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <ExternalLink className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="absolute bottom-0.5 right-1 text-[9px] text-white/80 bg-black/40 rounded px-1">
            {format(parseISO(m.created_at), "dd/MM")}
          </span>
        </a>
      ))}
    </div>
  );
}

function VideoGrid({ items }: { items: Message[] }) {
  if (items.length === 0) return <EmptyState label="Nenhum vídeo encontrado" />;
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((m) => (
        <a
          key={m.id}
          href={m.media_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="aspect-video bg-zapp-bg-dark rounded overflow-hidden relative group flex items-center justify-center"
        >
          <Play className="h-8 w-8 text-white/80" />
          <span className="absolute bottom-1 right-1 text-[10px] text-white/80 bg-black/40 rounded px-1">
            {format(parseISO(m.created_at), "dd/MM/yy")}
          </span>
        </a>
      ))}
    </div>
  );
}

function AudioList({ items }: { items: Message[] }) {
  if (items.length === 0) return <EmptyState label="Nenhum áudio encontrado" />;
  return (
    <div className="space-y-1">
      {items.map((m) => (
        <a
          key={m.id}
          href={m.media_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded hover:bg-zapp-hover transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-zapp-accent/20 flex items-center justify-center flex-shrink-0">
            <Mic className="h-4 w-4 text-zapp-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zapp-text truncate">
              {m.is_from_client ? "Cliente" : m.sender_name || "Você"}
              {m.audio_duration_sec ? ` • ${Math.floor(m.audio_duration_sec / 60)}:${String(Math.floor(m.audio_duration_sec % 60)).padStart(2, "0")}` : ""}
            </p>
            {m.transcription && (
              <p className="text-[10px] text-zapp-text-muted truncate">{m.transcription}</p>
            )}
          </div>
          <span className="text-[10px] text-zapp-text-muted flex-shrink-0">
            {format(parseISO(m.created_at), "dd/MM")}
          </span>
        </a>
      ))}
    </div>
  );
}

function DocumentList({ items }: { items: Message[] }) {
  if (items.length === 0) return <EmptyState label="Nenhum documento encontrado" />;
  return (
    <div className="space-y-1">
      {items.map((m) => (
        <a
          key={m.id}
          href={m.media_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded hover:bg-zapp-hover transition-colors"
        >
          <div className="w-9 h-9 rounded bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <FileText className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zapp-text truncate">{m.media_filename || "Documento"}</p>
            <p className="text-[10px] text-zapp-text-muted">
              {m.is_from_client ? "Cliente" : m.sender_name || "Você"} • {format(parseISO(m.created_at), "dd/MM/yy")}
            </p>
          </div>
          <Download className="h-3.5 w-3.5 text-zapp-text-muted flex-shrink-0" />
        </a>
      ))}
    </div>
  );
}

function LinksList({ links }: { links: { url: string; content: string; date: string; sender: string }[] }) {
  if (links.length === 0) return <EmptyState label="Nenhum link encontrado" />;
  return (
    <div className="space-y-1">
      {links.map((l, i) => {
        let domain = "";
        try { domain = new URL(l.url).hostname; } catch { domain = l.url; }
        return (
          <a
            key={`${l.url}-${i}`}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-zapp-hover transition-colors"
          >
            <div className="w-9 h-9 rounded bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Link2 className="h-4 w-4 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zapp-text truncate">{domain}</p>
              <p className="text-[10px] text-zapp-text-muted truncate">{l.url}</p>
            </div>
            <span className="text-[10px] text-zapp-text-muted flex-shrink-0">
              {format(parseISO(l.date), "dd/MM")}
            </span>
          </a>
        );
      })}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-zapp-text-muted">
      <Image className="h-10 w-10 mb-3 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ZappMediaGallery({ open, onOpenChange, messages, contactName }: ZappMediaGalleryProps) {
  const [activeTab, setActiveTab] = useState("images");

  const { images, videos, audios, documents } = useMemo(() => categorizeMedia(messages), [messages]);
  const links = useMemo(() => extractLinks(messages), [messages]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-zapp-panel border-zapp-border w-[380px] sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-zapp-border">
          <SheetTitle className="text-zapp-text text-base">
            Mídias e Links
          </SheetTitle>
          <p className="text-xs text-zapp-text-muted truncate">{contactName}</p>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="bg-zapp-bg-dark mx-4 mt-3 grid grid-cols-5 h-9">
            <TabsTrigger value="images" className="text-[10px] px-1 data-[state=active]:bg-zapp-accent data-[state=active]:text-white">
              <Image className="h-3.5 w-3.5 mr-0.5" />
              {images.length > 0 && <span>{images.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="videos" className="text-[10px] px-1 data-[state=active]:bg-zapp-accent data-[state=active]:text-white">
              <Play className="h-3.5 w-3.5 mr-0.5" />
              {videos.length > 0 && <span>{videos.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="audios" className="text-[10px] px-1 data-[state=active]:bg-zapp-accent data-[state=active]:text-white">
              <Mic className="h-3.5 w-3.5 mr-0.5" />
              {audios.length > 0 && <span>{audios.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="docs" className="text-[10px] px-1 data-[state=active]:bg-zapp-accent data-[state=active]:text-white">
              <FileText className="h-3.5 w-3.5 mr-0.5" />
              {documents.length > 0 && <span>{documents.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="links" className="text-[10px] px-1 data-[state=active]:bg-zapp-accent data-[state=active]:text-white">
              <Link2 className="h-3.5 w-3.5 mr-0.5" />
              {links.length > 0 && <span>{links.length}</span>}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-4">
            <TabsContent value="images" className="mt-0"><MediaGrid items={images} /></TabsContent>
            <TabsContent value="videos" className="mt-0"><VideoGrid items={videos} /></TabsContent>
            <TabsContent value="audios" className="mt-0"><AudioList items={audios} /></TabsContent>
            <TabsContent value="docs" className="mt-0"><DocumentList items={documents} /></TabsContent>
            <TabsContent value="links" className="mt-0"><LinksList links={links} /></TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}