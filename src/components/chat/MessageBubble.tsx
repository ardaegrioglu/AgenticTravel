import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SearchResultGrid } from "@/components/cards/SearchResultGrid";
import { ToolStatusIndicator } from "@/components/chat/ToolStatusIndicator";
import type { AppUIMessage } from "@/lib/types/chatData";

interface MessageBubbleProps {
  message: AppUIMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  const text = message.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");

  const toolStatusParts = message.parts.filter(
    (part): part is Extract<typeof part, { type: "data-toolStatus" }> =>
      part.type === "data-toolStatus",
  );

  const searchResultParts = message.parts.filter(
    (part): part is Extract<typeof part, { type: "data-searchResult" }> =>
      part.type === "data-searchResult",
  );

  if (!text.trim() && toolStatusParts.length === 0 && searchResultParts.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
      {toolStatusParts.length > 0 ? (
        <div className="flex flex-col gap-1">
          {toolStatusParts.map((part) => (
            <ToolStatusIndicator key={part.id ?? part.data.toolName} status={part.data} />
          ))}
        </div>
      ) : null}

      {text.trim() ? (
        <div
          className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed [&_p]:m-0 [&_ul]:my-1 [&_ol]:my-1 ${
            isUser
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          }`}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      ) : null}

      {searchResultParts.map((part, index) => (
        <SearchResultGrid key={part.id ?? index} result={part.data} />
      ))}
    </div>
  );
}
