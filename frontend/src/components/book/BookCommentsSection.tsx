"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  MessageSquare,
  Globe,
  Lock,
  Send,
  Trash2,
  Edit3,
  Check,
  X,
  Star,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { notesApi, socialApi, type BookNote, type PublicNote } from "@/lib/api/notes";

interface BookCommentsSectionProps {
  bookId: string;
  bookTitle: string;
  myNote: BookNote | null;
  publicNotes: PublicNote[] | undefined;
  userRating?: number | null;
  onMutateMyNote: (saved: BookNote | null, revalidate?: boolean) => Promise<unknown>;
  onMutatePublicNotes?: () => Promise<unknown>;
}

export default function BookCommentsSection({
  bookId,
  bookTitle,
  myNote,
  publicNotes,
  userRating,
  onMutateMyNote,
  onMutatePublicNotes,
}: BookCommentsSectionProps) {
  const locale = useLocale();
  const { user, isAuthenticated } = useAuth();

  const [commentText, setCommentText] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "mine">("all");
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (myNote) {
      setIsPublic(myNote.is_public);
    }
  }, [myNote]);

  const handleStartEdit = () => {
    if (!myNote) return;
    setCommentText(myNote.content);
    setIsPublic(myNote.is_public);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setCommentText("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanContent = commentText.trim();
    if (!cleanContent) return;

    setIsSubmitting(true);
    try {
      const saved = await notesApi.upsertNote(bookId, {
        content: cleanContent,
        is_public: isPublic,
      });
      await onMutateMyNote(saved, false);
      if (onMutatePublicNotes) {
        await onMutatePublicNotes();
      }
      setIsEditing(false);
      setCommentText("");
    } catch (err) {
      console.error("Error saving comment:", err);
      alert("No se pudo guardar el comentario. Inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Seguro que deseas eliminar tu comentario?")) return;
    setIsDeleting(true);
    try {
      await notesApi.deleteNote(bookId);
      await onMutateMyNote(null, false);
      if (onMutatePublicNotes) {
        await onMutatePublicNotes();
      }
      setIsEditing(false);
      setCommentText("");
    } catch (err) {
      console.error("Error deleting comment:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleExpand = (noteId: string) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [noteId]: !prev[noteId],
    }));
  };

  // Filter other readers' comments (exclude current user's note if it exists in public list)
  const otherComments = (publicNotes ?? []).filter((pn) => pn.id !== myNote?.id);
  const totalComments = (myNote ? 1 : 0) + otherComments.length;

  const userInitial = (user?.full_name || user?.email || "U")[0].toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-50 text-primary-600 rounded-xl">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              Conversación y Opiniones
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
              {totalComments}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Lee lo que opina la comunidad o guarda tus propias reflexiones sobre este libro.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filterTab === "all"
                ? "bg-white text-gray-900 shadow-xs"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Todos ({totalComments})
          </button>
          {myNote && (
            <button
              type="button"
              onClick={() => setFilterTab("mine")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterTab === "mine"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Mi apunte (1)
            </button>
          )}
        </div>
      </div>

      {/* ── Comment Composer (Social Input) ── */}
      {isAuthenticated ? (
        (!myNote || isEditing) ? (
          <form
            onSubmit={handleSubmit}
            className="bg-gray-50/80 rounded-2xl border border-gray-200/80 p-4 space-y-3.5 transition-all focus-within:bg-white focus-within:border-primary-300 focus-within:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0 mt-0.5">
                {userInitial}
              </div>

              <div className="flex-1 min-w-0">
                <textarea
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="¿Qué te pareció este libro? Comparte una reflexión, cita o comentario..."
                  className="w-full bg-transparent border-0 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0 resize-y leading-relaxed"
                  autoFocus={isEditing}
                />
              </div>
            </div>

            {/* Bottom bar: Visibility Toggle + Submit */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
              {/* Visibility selector */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                    isPublic
                      ? "bg-primary-50 text-primary-700 border border-primary-200 font-semibold"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <Globe className="h-3.5 w-3.5 text-primary-600" />
                  Público (Comunidad)
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                    !isPublic
                      ? "bg-amber-50 text-amber-800 border border-amber-200 font-semibold"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <Lock className="h-3.5 w-3.5 text-amber-600" />
                  Privado (Solo tú)
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2">
                {isEditing && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting || !commentText.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-40 transition"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isEditing ? "Guardar cambios" : "Publicar comentario"}
                </button>
              </div>
            </div>
          </form>
        ) : null
      ) : (
        <div className="bg-gray-50/80 rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800">Únete a la conversación</p>
              <p className="text-[11px] text-gray-500">Inicia sesión para dejar tu comentario o reseña.</p>
            </div>
          </div>
          <Link
            href={`/${locale}/auth/login`}
            className="px-4 py-2 bg-primary-600 text-white text-xs font-semibold rounded-xl hover:bg-primary-700 transition"
          >
            Iniciar Sesión
          </Link>
        </div>
      )}

      {/* ── Comments List / Feed ── */}
      <div className="space-y-4">
        {/* 1. User's Own Comment Card (if exists and not editing) */}
        {myNote && !isEditing && (
          <div className="bg-gradient-to-r from-primary-50/40 via-white to-white rounded-2xl border border-primary-200/80 p-4 sm:p-5 space-y-3 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
                  {userInitial}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">
                      {user?.full_name || user?.email}
                    </span>
                    <span className="text-[10px] font-bold text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded-md">
                      Tú
                    </span>
                    {myNote.is_public ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                        <Globe className="h-2.5 w-2.5" />
                        Público
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-100">
                        <Lock className="h-2.5 w-2.5" />
                        Privado para ti
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {new Date(myNote.updated_at).toLocaleDateString(locale, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Actions: Edit / Delete */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 hover:bg-primary-50 px-2.5 py-1 rounded-lg transition"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Editar</span>
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* User rating if exists */}
            {userRating && (
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-3.5 w-3.5 ${
                      userRating >= star
                        ? "fill-amber-400 text-amber-400"
                        : "text-gray-200"
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Comment Body */}
            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap pl-12">
              {myNote.content}
            </div>
          </div>
        )}

        {/* 2. Other Readers' Comments */}
        {filterTab === "all" && (
          otherComments.length > 0 ? (
            <div className="space-y-3">
              {otherComments.map((comment) => {
                const initial = (comment.author_display_name || "L")[0].toUpperCase();
                const isLong = comment.content.length > 280;
                const isExpanded = !!expandedNotes[comment.id];
                const preview = isLong && !isExpanded
                  ? comment.content.slice(0, 260) + "..."
                  : comment.content;

                return (
                  <div
                    key={comment.id}
                    className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 space-y-2.5 hover:border-gray-200 transition shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-500 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
                          {initial}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                              {comment.author_display_name}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              <Globe className="h-2.5 w-2.5 text-gray-400" />
                              Lector
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400">
                            {new Date(comment.updated_at).toLocaleDateString(locale, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap pl-11">
                      {preview}
                    </div>

                    {isLong && (
                      <div className="pl-11 pt-1">
                        <button
                          type="button"
                          onClick={() => toggleExpand(comment.id)}
                          className="text-xs font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 hover:underline transition"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3" />
                              Ver menos
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" />
                              Ver comentario completo
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : !myNote ? (
            <div className="text-center py-12 space-y-2 text-gray-400">
              <MessageSquare className="h-8 w-8 mx-auto text-gray-300 stroke-[1.5]" />
              <p className="text-sm font-medium text-gray-600">
                Aún no hay comentarios sobre este libro.
              </p>
              <p className="text-xs text-gray-400">
                ¡Sé el primero en compartir tu opinión o apunte personal!
              </p>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
