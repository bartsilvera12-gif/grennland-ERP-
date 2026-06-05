"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

type ToolbarBtnProps = {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
};

function ToolbarBtn({ active, onClick, title, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 text-sm font-medium transition-colors ${
        active
          ? "bg-slate-200 text-slate-900"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-slate-200" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  const promptLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL del enlace (vacío para quitar):", prev ?? "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50/50 px-2 py-1.5">
      <ToolbarBtn title="Título grande" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <span className="font-bold">H1</span>
      </ToolbarBtn>
      <ToolbarBtn title="Subtítulo" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <span className="font-bold">H2</span>
      </ToolbarBtn>
      <ToolbarBtn title="Subtítulo menor" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <span className="font-bold">H3</span>
      </ToolbarBtn>
      <Sep />
      <ToolbarBtn title="Negrita (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-bold">B</span>
      </ToolbarBtn>
      <ToolbarBtn title="Itálica (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <em>I</em>
      </ToolbarBtn>
      <ToolbarBtn title="Código" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        {"<>"}
      </ToolbarBtn>
      <Sep />
      <ToolbarBtn title="Lista con viñetas" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="4" cy="6" r="1" fill="currentColor" />
          <circle cx="4" cy="12" r="1" fill="currentColor" />
          <circle cx="4" cy="18" r="1" fill="currentColor" />
        </svg>
      </ToolbarBtn>
      <ToolbarBtn title="Lista numerada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="10" y1="6" x2="21" y2="6" />
          <line x1="10" y1="12" x2="21" y2="12" />
          <line x1="10" y1="18" x2="21" y2="18" />
          <text x="3" y="9" fontSize="6" fill="currentColor" stroke="none">1</text>
          <text x="3" y="15" fontSize="6" fill="currentColor" stroke="none">2</text>
          <text x="3" y="21" fontSize="6" fill="currentColor" stroke="none">3</text>
        </svg>
      </ToolbarBtn>
      <ToolbarBtn title="Cita" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <span className="text-base leading-none">&ldquo;&rdquo;</span>
      </ToolbarBtn>
      <Sep />
      <ToolbarBtn title="Insertar enlace" active={editor.isActive("link")} onClick={promptLink}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </ToolbarBtn>
      <Sep />
      <ToolbarBtn title="Deshacer (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
        </svg>
      </ToolbarBtn>
      <ToolbarBtn title="Rehacer (Ctrl+Shift+Z)" onClick={() => editor.chain().focus().redo().run()}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 7v6h-6" />
          <path d="M3 17a9 9 0 0 1 15-6.7L21 13" />
        </svg>
      </ToolbarBtn>
    </div>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 220,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Escribí algo…" }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none px-4 py-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_a]:text-[#4FAEB2] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12.5px] [&_code]:font-mono",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // Sync external value -> editor (cuando initial cambia, ej. abrir modal con otro post).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="rounded-xl border border-slate-300 bg-white" style={{ minHeight }}>
        <div className="px-4 py-3 text-xs text-slate-400">Cargando editor…</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-[#4FAEB2] focus-within:ring-2 focus-within:ring-[#4FAEB2]/30">
      <Toolbar editor={editor} />
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
