import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { streamGraphToUIMessageStream } from "@/lib/agent/streamBridge";
import type { AppUIMessage } from "@/lib/types/chatData";

interface ChatRequestBody {
  id?: string;
  messages: AppUIMessage[];
}

function toLangChainMessage(message: AppUIMessage): BaseMessage {
  const text = message.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");

  return message.role === "user" ? new HumanMessage(text) : new AIMessage(text);
}

export async function POST(req: Request): Promise<Response> {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { messages, id } = body;
  if (!Array.isArray(messages)) {
    return Response.json({ error: "Request body must include a `messages` array." }, {
      status: 400,
    });
  }

  // The client resends the full local message history on every turn, but we
  // only forward the newest message to the graph: the MemorySaver checkpoint
  // for this thread already holds everything earlier, and the `messages`
  // channel's append reducer takes care of the rest.
  const lastMessage = messages[messages.length - 1];
  const threadId = id ?? "default";

  const stream = createUIMessageStream<AppUIMessage>({
    execute: async ({ writer }) => {
      await streamGraphToUIMessageStream({
        writer,
        input: { messages: lastMessage ? [toLangChainMessage(lastMessage)] : [] },
        threadId,
      });
    },
    onError: (error) =>
      error instanceof Error ? error.message : "Something went wrong while planning your trip.",
  });

  return createUIMessageStreamResponse({ stream });
}
