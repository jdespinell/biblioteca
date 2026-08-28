"use client";

import dynamic from "next/dynamic";
import { useCallback, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  FileText,
  Edit3,
  Check,
  Eye,
  Lock,
  CheckCircle,
  AlertCircle,
  Loader2,
  BookOpen,
} from "lucide-react";
import { useAutoSave, type AutoSaveStatus } from "@/hooks/useAutoSave";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// Dynamic import: MDEditor uses browser APIs, can't be SSR'd
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-gray-50 rounded-lg border border-gray-200 animate-pulse" />
  ),
});

const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default.Markdown),
  { ssr: false }
);

// Extend sanitize schema to allow KaTeX classes
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", /^katex/],
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      ["className", /^katex/],
    ],
  },
};

interface MarkdownEditorProps {
  initialContent?: string;
  initialIsPublic?: boolean;
  bookId: string;
  onSave: (content: string, isPublic: boolean) => Promise<void>;
}

function AutoSaveIndicator({ status }: { status: AutoSaveStatus }) {
  const t = useTranslations("notes");

  if (status === "idle") return null;

  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-medium ${
        status === "saving"
          ? "text-blue-600"
          : status === "saved"
          ? "text-emerald-600"
          : "text-red-500"
      }`}
    >
      {status === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === "saved" && <CheckCircle className="h-3 w-3" />}
      {status === "error" && <AlertCircle className="h-3 w-3" />}
      <span>
        {status === "saving"
          ? t("autosaving")
          : status === "saved"
          ? t("saved")
          : t("error", { ns: "common" })}
      </span>
    </div>
  );
}

export default function MarkdownEditor({
  initialContent = "",
  initialIsPublic = false,
  bookId,
  onSave,
}: MarkdownEditorProps) {
  const t = useTranslations("notes");
  const [content, setContent] = useState(initialContent);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  useEffect(() => {
    setIsPublic(initialIsPublic);
  }, [initialIsPublic]);

  const handleSave = useCallback(
    async (c: string, pub: boolean) => {
      await onSave(c, pub);
    },
    [onSave]
  );

  const { status, saveNow, scheduleAutoSave } = useAutoSave({
    onSave: handleSave,
    debounceMs: 2000,
  });

  const handleContentChange = (value: string | undefined) => {
    const newContent = value ?? "";
    setContent(newContent);
    scheduleAutoSave(newContent, isPublic);
  };

  const handlePublicToggle = () => {
    const newIsPublic = !isPublic;
    setIsPublic(newIsPublic);
    scheduleAutoSave(content, newIsPublic);
  };

  const handleFinishEditing = () => {
    saveNow(content, isPublic);
    setIsEditing(false);
  };

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* GitHub README Header Bar */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <FileText className="h-4 w-4 text-gray-500" />
          <span className="font-mono text-xs font-semibold text-gray-700">
            NOTAS.md
          </span>
          <span className="text-gray-300">|</span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              isPublic
                ? "bg-green-100 text-green-800"
                : "bg-gray-200/70 text-gray-700"
            }`}
          >
            {isPublic ? (
              <Eye className="h-3 w-3 text-green-700" />
            ) : (
              <Lock className="h-3 w-3 text-gray-600" />
            )}
            {isPublic ? "Pública (Comunidad)" : "Privada"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <AutoSaveIndicator status={status} />

          {isEditing ? (
            <div className="flex items-center gap-2">
              {/* Public/Private toggle in edit mode */}
              <button
                type="button"
                onClick={handlePublicToggle}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition border ${
                  isPublic
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
                title={isPublic ? t("publicDescription") : t("privateDescription")}
              >
                {isPublic ? <Eye className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {isPublic ? "Pública" : "Privada"}
              </button>

              <button
                type="button"
                onClick={handleFinishEditing}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-600 text-white font-medium rounded-lg text-xs hover:bg-primary-700 shadow-sm transition"
              >
                <Check className="h-3.5 w-3.5" />
                Listo / Guardar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-xs shadow-sm transition"
            >
              <Edit3 className="h-3.5 w-3.5 text-primary-600" />
              Editar notas
            </button>
          )}
        </div>
      </div>

      {/* Body: GitHub Markdown Render or Editor */}
      <div className="p-6 sm:p-8">
        {isEditing ? (
          <div className="space-y-3" data-color-mode="light">
            <MDEditor
              value={content}
              onChange={handleContentChange}
              height={380}
              preview="live"
              previewOptions={{
                remarkPlugins: [remarkMath],
                rehypePlugins: [
                  [rehypeSanitize, sanitizeSchema],
                  rehypeKatex,
                ],
              }}
              textareaProps={{
                placeholder:
                  "Escribe aquí tus notas, reflexiones, citas o fórmulas matemáticas con LaTeX (ej: $\\sum x_i$)...",
              }}
            />
            <p className="text-xs text-gray-400">
              💡 Tus cambios se guardan automáticamente mientras escribes. Haz clic en &quot;Listo / Guardar&quot; al terminar.
            </p>
          </div>
        ) : content.trim() ? (
          <div data-color-mode="light" className="prose prose-slate max-w-none text-gray-800">
            <MDPreview
              source={content}
              remarkPlugins={[remarkMath]}
              rehypePlugins={[
                [rehypeSanitize, sanitizeSchema],
                rehypeKatex,
              ]}
            />
          </div>
        ) : (
          <div className="text-center py-10 space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-500 flex items-center justify-center mx-auto">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-gray-800 text-sm">
                Aún no has escrito notas para este libro
              </p>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Guarda tus citas favoritas, resúmenes de capítulos, reflexiones o fórmulas con formato Markdown y KaTeX.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white font-medium rounded-xl text-xs hover:bg-primary-700 shadow-sm transition"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Escribir primera nota
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
