"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ConversationProps {
  children: ReactNode;
  className?: string;
  stickyOffset?: number;
  autoScrollThreshold?: number;
  onScrollStateChange?: (isAtBottom: boolean) => void;
}

/**
 * Conversation container with sticky-to-bottom scrolling behavior.
 * Automatically scrolls to bottom when new content is added,
 * unless user has scrolled up to read previous messages.
 */
export function Conversation({
  children,
  className,
  stickyOffset: _stickyOffset = 100,
  autoScrollThreshold = 150,
  onScrollStateChange,
}: ConversationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [userScrolled, setUserScrolled] = useState(false);
  const prevChildrenRef = useRef(children);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  const checkIfAtBottom = useCallback(() => {
    if (!containerRef.current) return true;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    return distanceFromBottom <= autoScrollThreshold;
  }, [autoScrollThreshold]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const atBottom = checkIfAtBottom();
    setIsAtBottom(atBottom);

    if (!atBottom) {
      setUserScrolled(true);
    } else {
      setUserScrolled(false);
    }

    onScrollStateChange?.(atBottom);
  }, [checkIfAtBottom, onScrollStateChange]);

  // Auto-scroll when new children are added
  useEffect(() => {
    if (children !== prevChildrenRef.current) {
      prevChildrenRef.current = children;

      // Only auto-scroll if user hasn't manually scrolled up
      if (!userScrolled || isAtBottom) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          scrollToBottom("smooth");
        });
      }
    }
  }, [children, userScrolled, isAtBottom, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom("instant");
  }, [scrollToBottom]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn(
        "flex flex-col overflow-y-auto scroll-smooth",
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border",
        className
      )}
    >
      {children}

      {/* Scroll anchor for sticky behavior */}
      <div className="h-px w-full shrink-0" aria-hidden="true" />
    </div>
  );
}

/**
 * Button to scroll back to bottom of conversation
 */
interface ScrollToBottomButtonProps {
  onClick: () => void;
  visible: boolean;
  className?: string;
  unreadCount?: number;
}

export function ScrollToBottomButton({
  onClick,
  visible,
  className,
  unreadCount,
}: ScrollToBottomButtonProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2",
        "flex items-center gap-2 rounded-full",
        "bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
        "shadow-lg transition-all hover:bg-primary/90",
        "animate-in fade-in slide-in-from-bottom-2",
        className
      )}
    >
      {unreadCount && unreadCount > 0 ? (
        <span>{unreadCount} new messages</span>
      ) : (
        <span>Scroll to bottom</span>
      )}
      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" role="img">
        <title>Arrow down</title>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 14l-7 7m0 0l-7-7m7 7V3"
        />
      </svg>
    </button>
  );
}

/**
 * Hook for managing conversation scroll state
 */
export function useConversationScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  const checkIfAtBottom = useCallback((threshold = 150) => {
    if (!containerRef.current) return true;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    return scrollHeight - scrollTop - clientHeight <= threshold;
  }, []);

  const handleScroll = useCallback(() => {
    setIsAtBottom(checkIfAtBottom());
  }, [checkIfAtBottom]);

  return {
    containerRef,
    isAtBottom,
    scrollToBottom,
    handleScroll,
  };
}
