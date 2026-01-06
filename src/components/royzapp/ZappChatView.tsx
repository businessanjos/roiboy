import { RefObject } from "react";
import { MessageSquare, Clock } from "lucide-react";
import { ZappChatHeader } from "./ZappChatHeader";
import { ZappMessagesList } from "./ZappMessagesList";
import { ZappMessageInput, MentionData } from "./ZappMessageInput";
import { ZappAIAssistBar } from "./ZappAIAssistBar";
import { ConversationAssignment, Message } from "./types";
import { useMessageAssistant } from "@/hooks/useMessageAssistant";

interface ContactInfo {
  name: string;
  phone: string;
  avatar: string | null;
  clientId: string | null;
  isClient: boolean;
  isGroup: boolean;
  lastMessage: string | null;
  lastMessagePreview: string;
  unreadCount: number;
  lastMessageAt: string;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
  isFavorite: boolean;
  isBlocked: boolean;
}

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
  messageInputRef: RefObject<HTMLInputElement>;
  imageInputRef: RefObject<HTMLInputElement>;
  fileInputRef: RefObject<HTMLInputElement>;
  sectorId?: string;
  // AI Settings
  spellingEnabled?: boolean;
  suggestionsEnabled?: boolean;
  autoLearningEnabled?: boolean;
  onToggleSuggestions?: () => void;
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
  onMentionInsert?: (mention: MentionData) => void;
  // Signature
  signatureEnabled?: boolean;
  hasSignature?: boolean;
  onToggleSignature?: () => void;
  // Playbook
  onOpenPlaybook?: () => void;
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
  spellingEnabled = true,
  suggestionsEnabled = true,
  autoLearningEnabled = true,
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
  onMentionInsert,
  signatureEnabled,
  hasSignature,
  onToggleSignature,
  onOpenPlaybook,
  onToggleSuggestions,
}: ZappChatViewProps) {
  // AI Message Assistant hook
  const {
    correction,
    isCheckingSpelling,
    applyCorrection,
    dismissCorrection,
    suggestions,
    isLoadingSuggestions,
    refreshSuggestions,
    selectSuggestion,
    sendFeedback,
    currentSpinPhase,
  } = useMessageAssistant({
    messageInput,
    lastMessages: messages.slice(-10),
    clientName: contactInfo.name,
    sectorId: sectorId || "operacoes",
    conversationId: selectedConversation?.zapp_conversation?.id,
    spellingEnabled,
    suggestionsEnabled,
    autoLearningEnabled,
  });

  // Handle applying correction
  const handleApplyCorrection = () => {
    if (correction) {
      onMessageChange(correction);
      applyCorrection();
    }
  };

  // Handle selecting a suggestion
  const handleSelectSuggestion = (suggestion: { id: string; text: string; type: string }) => {
    onMessageChange(suggestion.text);
    selectSuggestion(suggestion);
    messageInputRef.current?.focus();
  };
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
    <div className="flex flex-col flex-1 min-h-0 w-full bg-zapp-bg overflow-hidden">
      {/* Chat header */}
      <ZappChatHeader
        assignment={selectedConversation}
        contactInfo={contactInfo}
        clientProducts={clientProducts}
        currentAgentId={currentAgentId}
        showLeadOption={showLeadOption}
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
        accountId={accountId}
      />

      {/* Messages */}
      <ZappMessagesList 
        messages={messages} 
        isGroup={contactInfo.isGroup}
        onReplyMessage={onReplyMessage}
        onDeleteMessage={onDeleteMessage}
      />

      {/* AI Assist Bar - above message input */}
      <ZappAIAssistBar
        correction={correction}
        isCheckingSpelling={isCheckingSpelling}
        onApplyCorrection={handleApplyCorrection}
        onDismissCorrection={dismissCorrection}
        suggestions={suggestions}
        isLoadingSuggestions={isLoadingSuggestions}
        onSelectSuggestion={handleSelectSuggestion}
        onRefreshSuggestions={refreshSuggestions}
        onSendFeedback={sendFeedback}
        currentSpinPhase={currentSpinPhase}
        spellingEnabled={spellingEnabled}
        suggestionsEnabled={suggestionsEnabled}
        onToggleSuggestions={onToggleSuggestions}
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
    </div>
  );
}
