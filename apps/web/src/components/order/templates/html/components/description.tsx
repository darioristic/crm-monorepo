import { EditorContent } from "./editor-content";

type Props = {
  content: string;
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
  const value = isValidJSON(content) ? JSON.parse(content) : null;

  // If the content is not valid JSON, return the content as a string
  if (!value) {
    return <div className="leading-4 text-[11px]">{content}</div>;
  }

  return <EditorContent content={value} />;
}
