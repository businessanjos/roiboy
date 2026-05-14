import { RefObject, useCallback, useState, useMemo } from "react";
import { MessageSquare, Clock } from "lucide-react";
import { ZappChatHeader } from "./ZappChatHeader";
import { ZappMessagesList } from "./ZappMessagesList";
import { ZappMessageInput, MentionData } from "./ZappMessageInput";
import { ZappAIAssistBar } from "./ZappAIAssistBar";
import { ZappMessageSearchBar } from "./ZappMessageSearchBar";
import { ZappMediaGallery } from "./ZappMediaGallery";
import { ConversationAssignment, ContactInfo } from "./types";
import { Message } from "@/hooks/useZappData";
import { useMessageAssistant } from "@/hooks/useMessageAssistant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReplyingToMessage {
  id: string;
  content: string | null;
  sender_name: string | null;
  is_from_client: boolean;
}

interface ZappChatViewProps {
  selectedConversation: ConversationAssignment | null;
  messages: Message[];
  contactInfo: ContactInfo;
  clientProducts: { id: string; name: string; color?: string }[];
  currentAgentId: string | null;
  messageInput: string;
  sendingMessage: boolean;
  uploadingMedia: boolean;
  isRecording: boolean;
  recordingDuration: number;
  audioPreview: { blob: Blob; url: string; duration: number } | null;
  showFormatting: boolean;
  replyingTo: ReplyingToMessage | null;
  messageInputRef: RefObject<HTMLTextAreaElement>;
  imageInputRef: RefObject<HTMLInputElement>;
  fileInputRef: RefObject<HTMLInputElement>;
  sectorId?: string;
  // Image preview props
  imagePreview?: { file: File; url: string } | null;
  onSetImagePreview?: (preview: { file: File; url: string } | null) => void;
  filePreview?: { file: File; url: string } | null;
  onSetFilePreview?: (preview: { file: File; url: string } | null) => void;
  // AI Settings
  spellingEnabled?: boolean;
  // Stats for empty state
  onlineAgents: number;
  totalQueueConversations: number;
  activeConversations: number;
  // Handlers
  onBack: () => void;
  onOpenClientEdit: (id: string) => void;
  onAssignToMe: (id: string) => void;
  onReleaseToQueue: (id: string) => void;
  onUpdateStatus: (id: string, status: "triage" | "pending" | "active" | "waiting" | "closed") => void;
  onOpenTransfer: () => void;
  onOpenRoiDialog: () => void;
  onOpenRiskDialog: () => void;
  onOpenAddClient: () => void;
  onOpenCloseTicket?: () => void;
  onOpenLinkClient?: () => void;
  onClientLinked?: () => void;
  onDeleteConversation?: () => void;
  onDismissConversation?: () => void;
  onOpenEditGroup?: () => void;
  accountId?: string;
  showLeadOption?: boolean;
  onMessageChange: (value: string) => void;
  onSendMessage: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onToggleFormatting: () => void;
  onInsertFormatting: (type: 'bold' | 'italic' | 'strikethrough' | 'monospace') => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onDiscardAudioPreview: () => void;
  onConfirmAudioSend: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "document") => void;
  onOpenContactPicker: () => void;
  onOpenQuickReplies: () => void;
  onReplyMessage: (message: Message) => void;
  onCancelReply: () => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => Promise<void>;
  onRetryMessage?: (message: Message) => void;
  onRetryMediaDownload?: (messageId: string) => void;
  onMentionInsert?: (mention: MentionData) => void;
  // Signature
  signatureEnabled?: boolean;
  hasSignature?: boolean;
  onToggleSignature?: () => void;
  // Playbook
  onOpenPlaybook?: () => void;
  // Meta templates
  isMetaChannel?: boolean;
  onOpenTemplates?: () => void;
}

export function ZappChatView({
  selectedConversation,
  messages,
  contactInfo,
  clientProducts,
  currentAgentId,
  messageInput,
  sendingMessage,
  uploadingMedia,
  isRecording,
  recordingDuration,
  audioPreview,
  showFormatting,
  replyingTo,
  messageInputRef,
  imageInputRef,
  fileInputRef,
  sectorId,
  imagePreview,
  onSetImagePreview,
  filePreview,
  onSetFilePreview,
  spellingEnabled = true,
  onlineAgents,
  totalQueueConversations,
  activeConversations,
  onBack,
  onOpenClientEdit,
  onAssignToMe,
  onReleaseToQueue,
  onUpdateStatus,
  onOpenTransfer,
  onOpenRoiDialog,
  onOpenRiskDialog,
  onOpenAddClient,
  onOpenCloseTicket,
  onOpenLinkClient,
  onClientLinked,
  onDeleteConversation,
  onDismissConversation,
  onOpenEditGroup,
  accountId,
  showLeadOption = false,
  onMessageChange,
  onSendMessage,
  onKeyPress,
  onToggleFormatting,
  onInsertFormatting,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onDiscardAudioPreview,
  onConfirmAudioSend,
  onFileSelect,
  onOpenContactPicker,
  onOpenQuickReplies,
  onReplyMessage,
  onCancelReply,
  onDeleteMessage,
  onEditMessage,
  onRetryMessage,
  onRetryMediaDownload,
  onMentionInsert,
  signatureEnabled,
  hasSignature,
  onToggleSignature,
  onOpenPlaybook,
}: ZappChatViewProps) {
  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCurrentIndex, setSearchCurrentIndex] = useState(0);
  const [showMediaGallery, setShowMediaGallery] = useState(false);

  // Compute search matches
  const searchMatchIds = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return messages
      .filter(m => m.content?.toLowerCase().includes(q))
      .map(m => m.id);
  }, [searchQuery, messages]);

  const handleSearchNavigate = useCallback((direction: "prev" | "next") => {
    if (searchMatchIds.length === 0) return;
    setSearchCurrentIndex(prev => {
      if (direction === "next") return prev >= searchMatchIds.length ? 1 : prev + 1;
      return prev <= 1 ? searchMatchIds.length : prev - 1;
    });
  }, [searchMatchIds.length]);

  const handleCloseSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery("");
    setSearchCurrentIndex(0);
  }, []);

  const handleSearchQuery = useCallback((q: string) => {
    setSearchQuery(q);
    setSearchCurrentIndex(q.trim() ? 1 : 0);
  }, []);

  // AI Message Assistant hook (spelling correction only)
  const {
    correction,
    isCheckingSpelling,
    applyCorrection,
    dismissCorrection,
  } = useMessageAssistant({
    messageInput,
    sectorId: sectorId || "operacoes",
    spellingEnabled,
  });

  // Handle applying correction
  const handleApplyCorrection = () => {
    if (correction) {
      onMessageChange(correction);
      applyCorrection();
    }
  };

  // 3C Plus call handler
  const handleCall = useCallback(async () => {
    const phone = contactInfo.phone;
    if (!phone) {
      toast.error("Número de telefone não disponível");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-call", {
        body: { phone, contact_name: contactInfo.name },
      });
      if (error) {
        toast.error("Erro ao iniciar chamada", { description: "Não foi possível conectar ao serviço de chamadas." });
        return;
      }
      if (data?.code === "NO_INTEGRATION") {
        toast.error("3C Plus não configurado", { description: "Vá em Configurações > Integrações para conectar sua conta 3C Plus." });
        return;
      }
      if (data?.success) {
        toast.success("Chamada iniciada no 3C Plus", { description: `Ligando para ${contactInfo.name}...` });
        return;
      }
      toast.error("Erro", { description: data?.error || "Erro desconhecido" });
    } catch (err) {
      console.error("[ZappChatView] 3C Plus call error:", err);
      toast.error("Erro ao iniciar chamada");
    }
  }, [contactInfo.phone, contactInfo.name]);

  if (!selectedConversation) {
    return (
      <div className="flex flex-col flex-1 min-h-0 w-full items-center justify-center bg-zapp-bg-dark relative overflow-hidden">
        <div className="relative z-10 text-center px-8 max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-zapp-accent/10 flex items-center justify-center">
            <MessageSquare className="h-12 w-12 text-zapp-accent" />
          </div>
          <h2 className="text-zapp-text text-2xl font-light mb-3">ROY zAPP</h2>
          <p className="text-zapp-text-muted text-sm leading-relaxed">
            Selecione uma conversa para começar a atender. Suas mensagens serão enviadas em nome da conta principal do WhatsApp.
          </p>
        </div>

        {/* Stats bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-zapp-panel-header px-6 py-4 flex items-center justify-center gap-8 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-zapp-accent" />
            <span className="text-zapp-text-muted">{onlineAgents} atendentes online</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-zapp-text-muted">{totalQueueConversations} na fila</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-zapp-accent" />
            <span className="text-zapp-text-muted">{activeConversations} em atendimento</span>
          </div>
        </div>
      </div>
    );
  }

  const clientId = selectedConversation.zapp_conversation?.client_id || selectedConversation.conversation?.client?.id;

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full min-w-0 bg-zapp-bg overflow-hidden">
      {/* Chat header */}
      <ZappChatHeader
        assignment={selectedConversation}
        contactInfo={contactInfo}
        clientProducts={clientProducts}
        currentAgentId={currentAgentId}
        showLeadOption={showLeadOption}
        isGroup={contactInfo.isGroup}
        onBack={onBack}
        onOpenClientEdit={onOpenClientEdit}
        onAssignToMe={onAssignToMe}
        onReleaseToQueue={onReleaseToQueue}
        onUpdateStatus={onUpdateStatus}
        onOpenTransfer={onOpenTransfer}
        onOpenRoiDialog={onOpenRoiDialog}
        onOpenRiskDialog={onOpenRiskDialog}
        onOpenAddClient={onOpenAddClient}
        onOpenCloseTicket={onOpenCloseTicket}
        onOpenLinkClient={onOpenLinkClient}
        onClientLinked={onClientLinked}
        onDeleteConversation={onDeleteConversation}
        onDismissConversation={onDismissConversation}
        onOpenEditGroup={onOpenEditGroup}
        accountId={accountId}
        onCall={handleCall}
        onToggleSearch={() => setShowSearch(s => !s)}
        onOpenMediaGallery={() => setShowMediaGallery(true)}
      />

      {/* Search bar */}
      {showSearch && (
        <ZappMessageSearchBar
          onSearch={handleSearchQuery}
          onNavigate={handleSearchNavigate}
          onClose={handleCloseSearch}
          currentMatch={searchCurrentIndex}
          totalMatches={searchMatchIds.length}
        />
      )}

      {/* Messages */}
      <ZappMessagesList 
        messages={messages} 
        isGroup={contactInfo.isGroup}
        onReplyMessage={onReplyMessage}
        onDeleteMessage={onDeleteMessage}
        onEditMessage={onEditMessage}
        onRetryMessage={onRetryMessage}
        onRetryMediaDownload={onRetryMediaDownload}
        searchQuery={searchQuery}
        searchMatchIds={searchMatchIds}
        searchFocusId={searchMatchIds.length > 0 && searchCurrentIndex > 0 ? searchMatchIds[searchCurrentIndex - 1] : null}
      />

      {/* AI Assist Bar - spelling correction only */}
      <ZappAIAssistBar
        correction={correction}
        isCheckingSpelling={isCheckingSpelling}
        onApplyCorrection={handleApplyCorrection}
        onDismissCorrection={dismissCorrection}
        spellingEnabled={spellingEnabled}
      />

      {/* Message input */}
      <ZappMessageInput
        messageInput={messageInput}
        sendingMessage={sendingMessage}
        uploadingMedia={uploadingMedia}
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        audioPreview={audioPreview}
        showFormatting={showFormatting}
        replyingTo={replyingTo}
        messageInputRef={messageInputRef}
        imageInputRef={imageInputRef}
        fileInputRef={fileInputRef}
        isGroup={contactInfo.isGroup}
        groupJid={selectedConversation?.zapp_conversation?.group_jid || null}
        sectorId={sectorId}
        imagePreview={imagePreview}
        onSetImagePreview={onSetImagePreview}
        filePreview={filePreview}
        onSetFilePreview={onSetFilePreview}
        onMessageChange={onMessageChange}
        onSendMessage={onSendMessage}
        onKeyPress={onKeyPress}
        onToggleFormatting={onToggleFormatting}
        onInsertFormatting={onInsertFormatting}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
        onCancelRecording={onCancelRecording}
        onDiscardAudioPreview={onDiscardAudioPreview}
        onConfirmAudioSend={onConfirmAudioSend}
        onFileSelect={onFileSelect}
        onOpenContactPicker={onOpenContactPicker}
        onOpenQuickReplies={onOpenQuickReplies}
        onCancelReply={onCancelReply}
        onMentionInsert={onMentionInsert}
        signatureEnabled={signatureEnabled}
        hasSignature={hasSignature}
        onToggleSignature={onToggleSignature}
        onOpenPlaybook={onOpenPlaybook}
      />

      {/* Media Gallery */}
      <ZappMediaGallery
        open={showMediaGallery}
        onOpenChange={setShowMediaGallery}
        messages={messages}
        contactName={contactInfo.name}
      />
    </div>
  );
}
