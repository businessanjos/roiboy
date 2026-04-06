export function EverConversationsTab() {
  return (
    <div className="flex-1 w-full h-full min-h-0">
      <iframe
        src="https://everia.pro/embed/chat"
        className="w-full h-full border-0"
        allow="microphone; clipboard-write"
        title="Ever IA Chat"
      />
    </div>
  );
}
