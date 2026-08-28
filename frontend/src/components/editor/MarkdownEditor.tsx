"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, Lock, Save, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
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
      className={`flex items-center gap-1.5 text-xs ${
        status === "saving"
          ? "text-blue-500"
          : status === "saved"
          ? "text-green-600"
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

  const handleManualSave = () => {
    saveNow(content, isPublic);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-gray-900">{t("title")}</h3>
        <div className="flex items-center gap-3">
          <AutoSaveIndicator status={status} />

          {/* Public/Private toggle */}
          <button
            onClick={handlePublicToggle}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              isPublic
                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
            }`}
            title={isPublic ? t("publicDescription") : t("privateDescription")}
          >
            {isPublic ? (
              <Eye className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {isPublic ? t("publicNote") : t("privateNote")}
          </button>

          {/* Manual save */}
          <button
            onClick={handleManualSave}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Save className="h-4 w-4" />
            {t("saveNote")}
          </button>
        </div>
      </div>

      {/* Privacy hint */}
      <p className="text-xs text-gray-500">
        {isPublic ? t("publicDescription") : t("privateDescription")}
      </p>

      {/* Editor */}
      <div data-color-mode="light">
        <MDEditor
          value={content}
          onChange={handleContentChange}
          height={400}
          preview="live"
          previewOptions={{
            remarkPlugins: [remarkMath],
            rehypePlugins: [
              [rehypeSanitize, sanitizeSchema], // Sanitize FIRST
              rehypeKatex,                       // Then render math
            ],
          }}
          textareaProps={{
            placeholder: t("placeholder"),
          }}
        />
      </div>
    </div>
  );
}
