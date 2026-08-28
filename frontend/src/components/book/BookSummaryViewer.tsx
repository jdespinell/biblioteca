"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronUp } from "lucide-react";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default.Markdown),
  {
    ssr: false,
    loading: () => <div className="h-14 bg-gray-50 rounded-lg animate-pulse" />,
  }
);

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

interface BookSummaryViewerProps {
  content: string;
  maxChars?: number;
  collapsible?: boolean;
  className?: string;
}

export default function BookSummaryViewer({
  content,
  maxChars = 280,
  collapsible = true,
  className = "",
}: BookSummaryViewerProps) {
  const isLong = collapsible && content.length > maxChars;
  const [isExpanded, setIsExpanded] = useState(!isLong);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative">
        <div
          data-color-mode="light"
          className={`prose prose-sm prose-slate max-w-none text-gray-800 bg-gray-50/70 p-4 rounded-xl border border-gray-100/90 leading-relaxed overflow-hidden transition-all duration-300 ${
            !isExpanded ? "max-h-32" : "max-h-none"
          }`}
        >
          <MDPreview
            source={content}
            remarkPlugins={[remarkMath]}
            rehypePlugins={[
              [rehypeSanitize, sanitizeSchema],
              rehypeKatex,
            ]}
          />
        </div>

        {/* Gradient fade overlay when collapsed */}
        {isLong && !isExpanded && (
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-gray-50 via-gray-50/80 to-transparent pointer-events-none rounded-b-xl" />
        )}
      </div>

      {/* Ver más / Ver menos Button */}
      {isLong && (
        <div className="flex justify-end pt-0.5">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 hover:underline transition"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Ver menos
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Ver más...
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
