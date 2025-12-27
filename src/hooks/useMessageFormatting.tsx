import { useRef, useCallback } from "react";

interface FormattingInsertReturn {
  messageInputRef: React.RefObject<HTMLInputElement>;
  insertFormatting: (type: string) => void;
}

export function useMessageFormatting(
  messageInput: string,
  setMessageInput: (value: string) => void
): FormattingInsertReturn {
  const messageInputRef = useRef<HTMLInputElement>(null);

  const insertFormatting = useCallback((type: string) => {
    const input = messageInputRef.current;
    if (!input) return;
    
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const selectedText = messageInput.substring(start, end);
    
    let formattedText = "";
    let cursorOffset = 0;
    
    switch (type) {
      case "bold":
        formattedText = `*${selectedText || "texto"}*`;
        cursorOffset = selectedText ? 0 : 1;
        break;
      case "italic":
        formattedText = `_${selectedText || "texto"}_`;
        cursorOffset = selectedText ? 0 : 1;
        break;
      case "strikethrough":
        formattedText = `~${selectedText || "texto"}~`;
        cursorOffset = selectedText ? 0 : 1;
        break;
      case "monospace":
        formattedText = `\`\`\`${selectedText || "texto"}\`\`\``;
        cursorOffset = selectedText ? 0 : 3;
        break;
    }
    
    const newValue = messageInput.substring(0, start) + formattedText + messageInput.substring(end);
    setMessageInput(newValue);
    
    // Focus and set cursor position after the formatting markers
    setTimeout(() => {
      input.focus();
      const newCursorPos = start + formattedText.length - cursorOffset;
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [messageInput, setMessageInput]);

  return {
    messageInputRef,
    insertFormatting,
  };
}
