"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink, FileText, Globe, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

interface Source {
  id: string;
  title: string;
  url?: string;
  description?: string;
  type?: "web" | "document" | "link";
  favicon?: string;
  snippet?: string;
}

interface SourcesProps {
  sources: Source[];
  className?: string;
  defaultOpen?: boolean;
  maxVisible?: number;
  title?: string;
}

const sourceIcons = {
  web: Globe,
  document: FileText,
  link: LinkIcon,
};

function SourceItem({ source }: { source: Source }) {
  const Icon = sourceIcons[source.type || "link"];
  const domain = source.url ? new URL(source.url).hostname : null;

  return (
    <motion.a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={cn(
        "group flex items-start gap-3 rounded-lg border p-3 transition-colors",
        "hover:bg-muted/50 hover:border-primary/20",
        !source.url && "pointer-events-none"
      )}
    >
      <div className="flex-shrink-0">
        {source.favicon ? (
          <Avatar className="size-8">
            <AvatarImage src={source.favicon} alt="" />
            <AvatarFallback>
              <Icon className="size-4" />
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="flex size-8 items-center justify-center rounded-full bg-muted">
            <Icon className="size-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{source.title}</p>
          {source.url && (
            <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
        {domain && <p className="text-xs text-muted-foreground truncate">{domain}</p>}
        {source.snippet && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{source.snippet}</p>
        )}
      </div>
    </motion.a>
  );
}

export function Sources({
  sources,
  className,
  defaultOpen = false,
  maxVisible = 3,
  title = "Sources",
}: SourcesProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showAll, setShowAll] = useState(false);

  if (sources.length === 0) return null;

  const visibleSources = showAll ? sources : sources.slice(0, maxVisible);
  const hasMore = sources.length > maxVisible;

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <LinkIcon className="size-4 text-muted-foreground" />
          <span>{title}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {sources.length}
          </span>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="size-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t p-3">
              {visibleSources.map((source) => (
                <SourceItem key={source.id} source={source} />
              ))}

              {hasMore && !showAll && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Show {sources.length - maxVisible} more sources
                </button>
              )}

              {showAll && hasMore && (
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Show less
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Inline citation component for use within text
interface InlineCitationProps {
  index: number;
  source: Source;
  className?: string;
}

export function InlineCitation({ index, source, className }: InlineCitationProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <span className="relative inline-block">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "inline-flex items-center justify-center",
          "size-5 rounded-full bg-primary/10 text-xs font-medium text-primary",
          "hover:bg-primary/20 transition-colors cursor-pointer",
          "align-super ml-0.5",
          className
        )}
      >
        {index}
      </a>

      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"
          >
            <div className="w-64 rounded-lg border bg-popover p-3 shadow-lg">
              <p className="font-medium text-sm truncate">{source.title}</p>
              {source.url && (
                <p className="text-xs text-muted-foreground truncate mt-1">
                  {new URL(source.url).hostname}
                </p>
              )}
              {source.snippet && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{source.snippet}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// Citation carousel for multiple inline citations
interface CitationCarouselProps {
  sources: Source[];
  className?: string;
}

export function CitationCarousel({ sources, className }: CitationCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (sources.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {sources.map((source, index) => (
        <button
          key={source.id}
          type="button"
          onClick={() => setActiveIndex(index)}
          className={cn(
            "size-6 rounded-full text-xs font-medium transition-colors",
            activeIndex === index
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}
