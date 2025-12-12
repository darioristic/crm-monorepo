"use client";

import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Heading from "@tiptap/extension-heading";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import {
  Bold,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Undo,
  Unlink,
} from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Separator } from "./separator";
import { Toggle } from "./toggle";

const lowlight = createLowlight(common);

interface RichTextEditorProps {
  content?: JSONContent | string;
  onChange?: (content: JSONContent) => void;
  onBlur?: (content: JSONContent) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  showToolbar?: boolean;
  toolbarPosition?: "top" | "bottom";
  minHeight?: string;
  maxHeight?: string;
  readOnly?: boolean;
}

export function RichTextEditor({
  content,
  onChange,
  onBlur,
  placeholder = "Start writing...",
  className,
  editorClassName,
  showToolbar = true,
  toolbarPosition = "top",
  minHeight = "150px",
  maxHeight = "400px",
  readOnly = false,
}: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Heading.configure({
        levels: [1, 2, 3],
      }),
      HorizontalRule,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: "rounded-md bg-muted p-4 font-mono text-sm",
        },
      }),
    ],
    content,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
          "min-h-[inherit] p-4",
          "[&_p]:my-2 first:[&_p]:mt-0 last:[&_p]:mb-0",
          "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-4",
          "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-3",
          "[&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-2",
          "[&_ul]:list-disc [&_ul]:pl-6",
          "[&_ol]:list-decimal [&_ol]:pl-6",
          "[&_blockquote]:border-l-4 [&_blockquote]:border-muted [&_blockquote]:pl-4 [&_blockquote]:italic",
          "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm",
          "[&_pre]:my-4",
          "[&_hr]:my-6 [&_hr]:border-border",
          editorClassName
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
    onBlur: ({ editor }) => {
      onBlur?.(editor.getJSON());
    },
  });

  const setLink = useCallback(() => {
    if (!editor || !linkUrl) return;

    if (linkUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
    }
    setLinkUrl("");
    setLinkPopoverOpen(false);
  }, [editor, linkUrl]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  if (!editor) {
    return (
      <div className={cn("rounded-lg border bg-background", className)} style={{ minHeight }}>
        <div className="animate-pulse p-4">
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="mt-2 h-4 w-1/2 rounded bg-muted" />
        </div>
      </div>
    );
  }

  const Toolbar = () => (
    <div className="flex flex-wrap items-center gap-1 border-b p-2">
      {/* Text formatting */}
      <Toggle
        size="sm"
        pressed={editor.isActive("bold")}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        aria-label="Bold"
      >
        <Bold className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("italic")}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Italic"
      >
        <Italic className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("strike")}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        aria-label="Strikethrough"
      >
        <Strikethrough className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("code")}
        onPressedChange={() => editor.chain().focus().toggleCode().run()}
        aria-label="Inline Code"
      >
        <Code className="size-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Headings */}
      <Toggle
        size="sm"
        pressed={editor.isActive("heading", { level: 1 })}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        aria-label="Heading 1"
      >
        <Heading1 className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("heading", { level: 2 })}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        aria-label="Heading 2"
      >
        <Heading2 className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("heading", { level: 3 })}
        onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        aria-label="Heading 3"
      >
        <Heading3 className="size-4" />
      </Toggle>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Lists */}
      <Toggle
        size="sm"
        pressed={editor.isActive("bulletList")}
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        aria-label="Bullet List"
      >
        <List className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("orderedList")}
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label="Ordered List"
      >
        <ListOrdered className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("blockquote")}
        onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
        aria-label="Blockquote"
      >
        <Quote className="size-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("codeBlock")}
        onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}
        aria-label="Code Block"
      >
        <Code2 className="size-4" />
      </Toggle>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className="h-8 px-2"
      >
        <Minus className="size-4" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Links */}
      <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
        <PopoverTrigger asChild>
          <Toggle size="sm" pressed={editor.isActive("link")} aria-label="Add Link">
            <LinkIcon className="size-4" />
          </Toggle>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setLink()}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setLinkPopoverOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={setLink}>
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {editor.isActive("link") && (
        <Button variant="ghost" size="sm" onClick={removeLink} className="h-8 px-2">
          <Unlink className="size-4" />
        </Button>
      )}

      <div className="flex-1" />

      {/* Undo/Redo */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className="h-8 px-2"
      >
        <Undo className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className="h-8 px-2"
      >
        <Redo className="size-4" />
      </Button>
    </div>
  );

  return (
    <div className={cn("rounded-lg border bg-background", className)} style={{ minHeight }}>
      {showToolbar && toolbarPosition === "top" && <Toolbar />}

      {/* Inline formatting bubble menu removed due to Tiptap v3 types */}

      <div
        className="overflow-y-auto"
        style={{ maxHeight, minHeight: `calc(${minHeight} - 50px)` }}
      >
        <EditorContent editor={editor} />
      </div>

      {showToolbar && toolbarPosition === "bottom" && <Toolbar />}
    </div>
  );
}

// Export helper functions
export function extractTextFromJSON(content: JSONContent): string {
  if (!content) return "";

  const extract = (node: JSONContent): string => {
    if (node.type === "text") return (node as { text?: string }).text || "";
    if (node.content) {
      return node.content.map(extract).join("");
    }
    return "";
  };

  if (content.content) {
    return content.content.map(extract).join("\n");
  }
  return "";
}

export function createJSONFromText(text: string): JSONContent {
  return {
    type: "doc",
    content: text.split("\n").map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}
