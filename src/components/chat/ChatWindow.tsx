"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import type { AppUIMessage } from "@/lib/types/chatData";

export function ChatWindow() {
  const { messages, sendMessage, status, error } = useChat<AppUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const disabled = status === "submitted" || status === "streaming";

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col">
      <MessageList messages={messages} status={status} />
      {error ? (
        <p className="px-4 py-2 text-sm text-red-600 dark:text-red-400">{error.message}</p>
      ) : null}
      <ChatInput disabled={disabled} onSend={(text) => sendMessage({ text })} />
    </div>
  );
}
