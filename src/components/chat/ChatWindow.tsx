"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { ChatInput } from "@/components/chat/ChatInput";
import { MessageList } from "@/components/chat/MessageList";
import { TripSummaryPanel } from "@/components/chat/TripSummaryPanel";
import type { Preferences } from "@/lib/agent/preferencesSchema";
import { getOrCreateThreadId } from "@/lib/session";
import type { AppUIMessage } from "@/lib/types/chatData";

function latestPreferences(messages: AppUIMessage[]): Preferences | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const parts = messages[i].parts;
    for (let j = parts.length - 1; j >= 0; j -= 1) {
      const part = parts[j];
      if (part.type === "data-preferences") {
        return part.data;
      }
    }
  }
  return null;
}

export function ChatWindow() {
  const [threadId] = useState<string | undefined>(() =>
    typeof window === "undefined" ? undefined : getOrCreateThreadId(),
  );

  const { messages, sendMessage, status, error } = useChat<AppUIMessage>({
    id: threadId,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const disabled = status === "submitted" || status === "streaming";
  const preferences = latestPreferences(messages);

  return (
    <div className="flex h-full w-full flex-1 flex-col">
      {preferences ? <TripSummaryPanel preferences={preferences} /> : null}
      <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col">
        <MessageList messages={messages} status={status} />
        {error ? (
          <p className="px-4 py-2 text-sm text-red-600 dark:text-red-400">{error.message}</p>
        ) : null}
        <ChatInput disabled={disabled} onSend={(text) => sendMessage({ text })} />
      </div>
    </div>
  );
}
