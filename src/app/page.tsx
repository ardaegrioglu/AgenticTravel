import { ChatWindow } from "@/components/chat/ChatWindow";

export default function Home() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h1 className="mx-auto max-w-3xl text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          AgenticTravel
        </h1>
      </header>
      <ChatWindow />
    </div>
  );
}
