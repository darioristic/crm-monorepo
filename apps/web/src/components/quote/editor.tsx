"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import type { JSONContent } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  initialContent?: JSONContent;
  className?: string;
  onChange?: (content?: JSONContent | null) => void;
  onBlur?: (content: JSONContent | null) => void;
  placeholder?: string;
  disablePlaceholder?: boolean;
  tabIndex?: number;
};

export function Editor({
  initialContent,
  className,
  onChange,
  onBlur,
  placeholder = "Enter text...",
  disablePlaceholder = false,
  tabIndex,
}: Props) {
  const [isFocused, setIsFocused] = useState(false);
  const [content, setContent] = useState<JSONContent | null | undefined>(initialContent);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        link: false, // Disable link from StarterKit to avoid duplicate
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline",
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content: initialContent,
    immediatelyRender: false, // Disable SSR to avoid hydration mismatches
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none focus:outline-none",
          "text-[11px] text-primary leading-[18px]",
          "[&_p]:m-0 [&_p]:leading-[18px]"
        ),
        tabindex: tabIndex?.toString() || "0",
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      const newIsEmpty = editor.state.doc.textContent.length === 0;
      const newContent = newIsEmpty ? null : json;
      setContent(newContent);
      onChange?.(newContent);
    },
    onFocus: () => setIsFocused(true),
    onBlur: () => {
      setIsFocused(false);
      if (content !== initialContent) {
        onBlur?.(content ?? null);
      }
    },
  });

  // Update editor content when initialContent changes
  useEffect(() => {
    if (editor && initialContent !== undefined) {
      const currentContent = editor.getJSON();
      if (JSON.stringify(currentContent) !== JSON.stringify(initialContent)) {
        editor.commands.setContent(initialContent || "");
      }
    }
  }, [editor, initialContent]);

  const showPlaceholder = !disablePlaceholder && !content && !isFocused;

  return (
    <div
      className={cn(
        "quote-editor min-h-[24px]",
        showPlaceholder &&
          "w-full bg-[repeating-linear-gradient(-60deg,#DBDBDB,#DBDBDB_1px,transparent_1px,transparent_5px)] dark:bg-[repeating-linear-gradient(-60deg,#2C2C2C,#2C2C2C_1px,transparent_1px,transparent_5px)]",
        className
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

// Helper to extract text from editor content
export function extractTextFromContent(content: JSONContent | null | undefined): string {
  if (!content) return "";

  const extractText = (node: JSONContent): string => {
    if (node.type === "text") return (node as { text?: string }).text || "";
    if (node.content) {
      return node.content.map(extractText).join("");
    }
    return "";
  };

  if (content.content) {
    return content.content.map(extractText).join("\n");
  }
  return "";
}

// Helper to create content from text
export function createContentFromText(text: string): JSONContent {
  const lines = text.split("\n");
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}
