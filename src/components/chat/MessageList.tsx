import type { ChatStatus } from "ai";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { AppUIMessage } from "@/lib/types/chatData";

interface MessageListProps {
  messages: AppUIMessage[];
  status: ChatStatus;
}

export function MessageList({ messages, status }: MessageListProps) {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-6">
      {messages.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Tell me about the trip you want to plan — destination, dates, budget, and what
          you&apos;re into.
        </p>
      ) : null}
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {status === "submitted" ? (
        <p className="flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400 dark:bg-zinc-500" />
          Thinking…
        </p>
      ) : null}
    </div>
  );
}
