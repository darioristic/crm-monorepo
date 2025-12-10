"use client";

import { useCallback } from "react";
import { useChatStore } from "@/store/chat";

export function useChatSession() {
  const {
    currentChatId,
    sessions,
    createSession,
    deleteSession,
    setCurrentChatId,
    addMessageToSession,
    updateSessionTitle,
  } = useChatStore();

  const currentSession = sessions.find((s) => s.id === currentChatId);

  const startNewChat = useCallback(() => {
    const id = createSession();
    return id;
  }, [createSession]);

  const switchToChat = useCallback(
    (chatId: string) => {
      setCurrentChatId(chatId);
    },
    [setCurrentChatId]
  );

  const removeChat = useCallback(
    (chatId: string) => {
      deleteSession(chatId);
    },
    [deleteSession]
  );

  const addMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      if (!currentChatId) return;
      addMessageToSession(currentChatId, { role, content });
    },
    [currentChatId, addMessageToSession]
  );

  const renameChat = useCallback(
    (title: string) => {
      if (!currentChatId) return;
      updateSessionTitle(currentChatId, title);
    },
    [currentChatId, updateSessionTitle]
  );

  return {
    currentChatId,
    currentSession,
    sessions,
    startNewChat,
    switchToChat,
    removeChat,
    addMessage,
    renameChat,
  };
}
