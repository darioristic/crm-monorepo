import type { EditorDoc } from "@/types/quote";

export function formatEditorContent(doc?: EditorDoc | null): React.ReactNode | null {
  if (!doc || !doc.content) {
    return null;
  }

  return (
    <>
      {(doc.content as any[]).map((node: any, nodeIndex) => {
        if (node?.type === "paragraph") {
          return (
            <p key={`paragraph-${nodeIndex.toString()}`}>
              {Array.isArray(node.content)
                ? (node.content as any[]).map((inlineContent: any, inlineIndex) => {
                    if (inlineContent?.type === "text") {
                      let style = "text-[11px]";
                      let href: string | undefined;

                      if (Array.isArray(inlineContent.marks)) {
                        for (const mark of inlineContent.marks as any[]) {
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

                      const content = String(inlineContent.text || "");
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
