"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ChatInterface } from "@/components/chat";
import { useChatStore } from "@/store/chat";

interface ChatPageProps {
  params: Promise<{ chatId?: string[] }>;
}

export default function ChatPage({ params: _params }: ChatPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setCurrentChatId, setArtifactType, createSession } = useChatStore();

  // Extract chatId from the catch-all route
  const chatId = useParams()?.chatId as string[] | undefined;
  const currentChatId = chatId?.at(0);

  // Get artifact type from query params
  const artifactType = searchParams.get("artifact-type");

  useEffect(() => {
    if (currentChatId) {
      setCurrentChatId(currentChatId);
    }
    if (artifactType) {
      setArtifactType(artifactType);
    }
  }, [currentChatId, artifactType, setCurrentChatId, setArtifactType]);

  // Handle new chat creation
  const handleNewChat = () => {
    const newId = createSession();
    router.push(`/dashboard/chat/${newId}`);
  };

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ChatInterface
        initialChatId={currentChatId}
        onNewChat={handleNewChat}
        isHome={!currentChatId}
      />
    </div>
  );
}
