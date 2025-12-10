import type { EditorDoc } from "@crm/schemas";

type Mark = { type: string; attrs?: { href?: string } };
type TextNode = { type: "text"; text?: string; marks?: Mark[] };
type HardBreakNode = { type: "hardBreak" };
type ParagraphNode = {
  type: "paragraph";
  content?: Array<TextNode | HardBreakNode>;
};

export function formatEditorContent(doc?: EditorDoc | null): React.ReactNode | null {
  if (!doc || !doc.content) {
    return null;
  }

  const nodes = (doc.content ?? []) as EditorDoc[];

  return (
    <>
      {nodes.map((node, nodeIndex) => {
        const paragraph = node as ParagraphNode;
        if (node?.type === "paragraph") {
          return (
            <p key={`paragraph-${nodeIndex.toString()}`}>
              {Array.isArray(paragraph.content)
                ? paragraph.content.map((inlineContent, inlineIndex) => {
                    if (inlineContent?.type === "text") {
                      let style = "text-[11px]";
                      let href: string | undefined;

                      const marks = (inlineContent as TextNode).marks;
                      if (Array.isArray(marks)) {
                        for (const mark of marks) {
                          if (mark?.type === "bold") {
                            style += " font-semibold";
                          } else if (mark?.type === "italic") {
                            style += " italic";
                          } else if (mark?.type === "link") {
                            href = mark?.attrs?.href;
                            style += " underline";
                          } else if (mark?.type === "strike") {
                            style += " line-through";
                          }
                        }
                      }

                      const content = String((inlineContent as TextNode).text || "");
                      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content);

                      if (href || isEmail) {
                        const linkHref = href || (isEmail ? `mailto:${content}` : content);
                        return (
                          <a
                            key={`link-${nodeIndex}-${inlineIndex.toString()}`}
                            href={linkHref}
                            className={`${style} underline`}
                          >
                            {content}
                          </a>
                        );
                      }

                      return (
                        <span key={`text-${nodeIndex}-${inlineIndex.toString()}`} className={style}>
                          {content}
                        </span>
                      );
                    }

                    if (inlineContent?.type === "hardBreak") {
                      return <br key={`break-${nodeIndex}-${inlineIndex.toString()}`} />;
                    }
                    return null;
                  })
                : null}
            </p>
          );
        }

        return null;
      })}
    </>
  );
}
