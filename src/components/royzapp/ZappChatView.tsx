import { RefObject } from "react";
import { MessageSquare, Clock } from "lucide-react";
import { ZappChatHeader } from "./ZappChatHeader";
import { ZappMessagesList } from "./ZappMessagesList";
import { ZappMessageInput, MentionData } from "./ZappMessageInput";
import { ConversationAssignment, Message } from "./types";

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
}: ZappChatViewProps) {
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
        onBack={onBack}
        onOpenClientEdit={onOpenClientEdit}
        onAssignToMe={onAssignToMe}
        onReleaseToQueue={onReleaseToQueue}
        onUpdateStatus={onUpdateStatus}
        onOpenTransfer={onOpenTransfer}
        onOpenRoiDialog={onOpenRoiDialog}
        onOpenRiskDialog={onOpenRiskDialog}
        onOpenAddClient={onOpenAddClient}
      />

      {/* Messages */}
      <ZappMessagesList 
        messages={messages} 
        isGroup={contactInfo.isGroup}
        onReplyMessage={onReplyMessage}
        onDeleteMessage={onDeleteMessage}
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
      />
    </div>
  );
}
