import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";

const extensions = [
  StarterKit,
  Link.configure({
    openOnClick: false,
    autolink: true,
    defaultProtocol: "https",
  }),
];

export function registerExtensions(options?: { placeholder?: string }) {
  const { placeholder } = options ?? {};
  return [...extensions, Placeholder.configure({ placeholder })];
}
