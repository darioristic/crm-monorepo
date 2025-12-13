import type { EditorDoc } from "@/types/quote";
import { EditorContent } from "./editor-content";

type Props = {
  content: string | EditorDoc;
};

function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export function Description({ content }: Props) {
  if (typeof content !== "string") {
    const doc = content as EditorDoc;
    if (doc && typeof doc === "object" && doc.type === "doc") {
      return <EditorContent content={doc} />;
    }
    return <div className="leading-4 text-[11px] break-words">{String(content)}</div>;
  }
  const value = isValidJSON(content) ? JSON.parse(content) : null;

  // If the content is not valid JSON, return the content as a string
  if (!value || typeof value !== "object" || value.type !== "doc") {
    return <div className="leading-4 text-[11px] break-words">{content}</div>;
  }

  return <EditorContent content={value} />;
}
