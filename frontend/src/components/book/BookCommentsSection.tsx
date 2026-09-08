"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  MessageSquare,
  Globe,
  Lock,
  Send,
  Trash2,
  Edit3,
  CornerDownRight,
  ChevronDown,
  ChevronUp,
  User,
  Star,
  X,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { notesApi, type BookNote, type PublicNote } from "@/lib/api/notes";

// Unified comment item representation for rendering
interface UnifiedComment {
  id: string;
  global_book_id: string;
  parent_id?: string | null;
  content: string;
  is_public: boolean;
  author_display_name: string;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
}

interface BookCommentsSectionProps {
  bookId: string;
  bookTitle: string;
  myNotes: BookNote[];
  publicNotes: PublicNote[];
  userRating?: number | null;
  onMutateMyNotes: () => Promise<unknown>;
  onMutatePublicNotes: () => Promise<unknown>;
}

export default function BookCommentsSection({
  bookId,
  bookTitle,
  myNotes,
  publicNotes,
  userRating,
  onMutateMyNotes,
  onMutatePublicNotes,
}: BookCommentsSectionProps) {
  const locale = useLocale();
  const { user, isAuthenticated } = useAuth();

  // New top-level comment state
  const [newCommentText, setNewCommentText] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Replying state: parentId -> reply text
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyIsPublic, setReplyIsPublic] = useState(true);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Editing state: noteId -> text
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Filter tabs: 'all' | 'mine' | 'private'
  const [filterTab, setFilterTab] = useState<"all" | "private">("all");
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  // Build unified comments list without duplicates
  const myNotesMap = new Map<string, BookNote>(myNotes.map((n) => [n.id, n]));
  const unifiedList: UnifiedComment[] = [];

  // Add all of current user's notes
  for (const n of myNotes) {
    unifiedList.push({
      id: n.id,
      global_book_id: n.global_book_id,
      parent_id: n.parent_id,
      content: n.content,
      is_public: n.is_public,
      author_display_name: user?.full_name || user?.email || "Tú",
      created_at: n.created_at,
      updated_at: n.updated_at,
      is_owner: true,
    });
  }

  // Add public notes from others (skip any that belong to current user to avoid duplicate)
  for (const pn of publicNotes) {
    if (!myNotesMap.has(pn.id)) {
      unifiedList.push({
        id: pn.id,
        global_book_id: pn.global_book_id,
        parent_id: pn.parent_id,
        content: pn.content,
        is_public: true,
        author_display_name: pn.author_display_name,
        created_at: pn.created_at,
        updated_at: pn.updated_at,
        is_owner: false,
      });
    }
  }

  // Sort chronologically (oldest top, or newest top)
  unifiedList.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Group top-level vs replies
  const topLevelComments = unifiedList.filter((c) => !c.parent_id);
  const repliesByParentId = new Map<string, UnifiedComment[]>();

  for (const c of unifiedList) {
    if (c.parent_id) {
      const list = repliesByParentId.get(c.parent_id) ?? [];
      list.push(c);
      repliesByParentId.set(c.parent_id, list);
    }
  }

  const privateNotesCount = myNotes.filter((n) => !n.is_public).length;
  const totalCommentsCount = unifiedList.length;

  const handleCreateTopLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newCommentText.trim();
    if (!content) return;

    setIsSubmittingNew(true);
    try {
      await notesApi.createNote(bookId, {
        content,
        is_public: newIsPublic,
        parent_id: null,
      });
      await onMutateMyNotes();
      await onMutatePublicNotes();
      setNewCommentText("");
    } catch (err) {
      console.error("Error creating comment:", err);
      alert("No se pudo publicar el comentario. Inténtalo de nuevo.");
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleCreateReply = async (parentId: string) => {
    const content = replyText.trim();
    if (!content) return;

    setIsSubmittingReply(true);
    try {
      await notesApi.createNote(bookId, {
        content,
        is_public: replyIsPublic,
        parent_id: parentId,
      });
      await onMutateMyNotes();
      await onMutatePublicNotes();
      setReplyingToId(null);
      setReplyText("");
    } catch (err) {
      console.error("Error creating reply:", err);
      alert("No se pudo publicar la respuesta.");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleStartEdit = (comment: UnifiedComment) => {
    setEditingId(comment.id);
    setEditText(comment.content);
    setEditIsPublic(comment.is_public);
  };

  const handleSaveEdit = async (noteId: string) => {
    const content = editText.trim();
    if (!content) return;

    setIsSubmittingEdit(true);
    try {
      await notesApi.updateNote(noteId, {
        content,
        is_public: editIsPublic,
      });
      await onMutateMyNotes();
      await onMutatePublicNotes();
      setEditingId(null);
      setEditText("");
    } catch (err) {
      console.error("Error updating comment:", err);
      alert("No se pudo actualizar el comentario.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm("¿Seguro que deseas eliminar este comentario? Se eliminarán también las respuestas asociadas.")) return;
    try {
      await notesApi.deleteNote(noteId);
      await onMutateMyNotes();
      await onMutatePublicNotes();
    } catch (err) {
      console.error("Error deleting comment:", err);
      alert("No se pudo eliminar.");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const userInitial = (user?.full_name || user?.email || "U")[0].toUpperCase();

  // Filtered comments according to active tab
  const displayedTopLevel = filterTab === "private"
    ? topLevelComments.filter((c) => c.is_owner && !c.is_public)
    : topLevelComments;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-8 space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-50 text-primary-600 rounded-xl">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              Conversación y Apuntes
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
              {totalCommentsCount}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Comenta, debate con la comunidad o crea múltiples apuntes personales.
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
            Todos ({totalCommentsCount})
          </button>
          {privateNotesCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterTab("private")}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterTab === "private"
                  ? "bg-white text-amber-800 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Lock className="h-3 w-3 text-amber-600" />
              Solo privados ({privateNotesCount})
            </button>
          )}
        </div>
      </div>

      {/* ── Main Composer for New Comment / Note ── */}
      {isAuthenticated ? (
        <form
          onSubmit={handleCreateTopLevel}
          className="bg-gray-50/80 rounded-2xl border border-gray-200/80 p-4 space-y-3 focus-within:bg-white focus-within:border-primary-300 focus-within:shadow-sm transition"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0 mt-0.5">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <textarea
                rows={3}
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Escribe un comentario, reseña o apunte personal..."
                className="w-full bg-transparent border-0 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0 resize-y leading-relaxed"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-200/60">
            {/* Visibility selector */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setNewIsPublic(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                  newIsPublic
                    ? "bg-primary-50 text-primary-700 border border-primary-200 font-semibold"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                <Globe className="h-3.5 w-3.5 text-primary-600" />
                Público (Comunidad)
              </button>
              <button
                type="button"
                onClick={() => setNewIsPublic(false)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                  !newIsPublic
                    ? "bg-amber-50 text-amber-800 border border-amber-200 font-semibold"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                <Lock className="h-3.5 w-3.5 text-amber-600" />
                Privado (Solo tú)
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmittingNew || !newCommentText.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-40 transition"
            >
              <Send className="h-3.5 w-3.5" />
              Publicar
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800">Únete a la conversación</p>
              <p className="text-[11px] text-gray-500">Inicia sesión para comentar o responder a otros lectores.</p>
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

      {/* ── Thread List ── */}
      <div className="space-y-4 pt-2">
        {displayedTopLevel.length === 0 ? (
          <div className="text-center py-12 space-y-2 text-gray-400">
            <MessageSquare className="h-8 w-8 mx-auto text-gray-300 stroke-[1.5]" />
            <p className="text-sm font-medium text-gray-600">
              {filterTab === "private"
                ? "No tienes apuntes privados en este libro."
                : "Aún no hay comentarios sobre este libro."}
            </p>
            <p className="text-xs text-gray-400">
              {filterTab === "private"
                ? "Puedes crear uno seleccionando 'Privado' al publicar."
                : "¡Sé el primero en compartir tu opinión o apunte!"}
            </p>
          </div>
        ) : (
          displayedTopLevel.map((comment) => {
            const replies = repliesByParentId.get(comment.id) ?? [];
            const isEditingThis = editingId === comment.id;
            const isReplyingThis = replyingToId === comment.id;
            const isLong = comment.content.length > 280;
            const isExpanded = !!expandedNotes[comment.id];
            const preview = isLong && !isExpanded
              ? comment.content.slice(0, 260) + "..."
              : comment.content;
            const initial = (comment.author_display_name || "L")[0].toUpperCase();

            return (
              <div
                key={comment.id}
                className={`rounded-2xl border p-4 sm:p-5 space-y-3 transition shadow-xs ${
                  comment.is_owner
                    ? comment.is_public
                      ? "bg-gradient-to-r from-primary-50/40 via-white to-white border-primary-200/80"
                      : "bg-amber-50/30 border-amber-200/70"
                    : "bg-white border-gray-100 hover:border-gray-200"
                }`}
              >
                {/* Comment Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs flex-shrink-0 ${
                        comment.is_owner
                          ? "bg-gradient-to-tr from-primary-600 to-indigo-600"
                          : "bg-gradient-to-tr from-gray-700 to-gray-500"
                      }`}
                    >
                      {initial}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                          {comment.author_display_name}
                        </span>
                        {comment.is_owner && (
                          <span className="text-[10px] font-bold text-primary-700 bg-primary-100 px-1.5 py-0.2 rounded">
                            Tú
                          </span>
                        )}
                        {comment.is_public ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                            <Globe className="h-2.5 w-2.5" />
                            Público
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-100">
                            <Lock className="h-2.5 w-2.5" />
                            Privado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(comment.created_at).toLocaleDateString(locale, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Comment Actions (Edit / Delete if owner) */}
                  {comment.is_owner && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(comment)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition"
                        title="Editar"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(comment.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Comment Content / Inline Editor */}
                {isEditingThis ? (
                  <div className="space-y-3 pt-1">
                    <textarea
                      rows={3}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full p-3 border border-primary-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                      autoFocus
                    />
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setEditIsPublic(!editIsPublic)}
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border ${
                          editIsPublic ? "bg-primary-50 text-primary-700 border-primary-200" : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        {editIsPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {editIsPublic ? "Público" : "Privado"}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(comment.id)}
                          disabled={isSubmittingEdit || !editText.trim()}
                          className="px-3.5 py-1 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 shadow-xs"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap pl-11">
                      {preview}
                    </div>

                    {isLong && (
                      <div className="pl-11">
                        <button
                          type="button"
                          onClick={() => toggleExpand(comment.id)}
                          className="text-xs font-semibold text-primary-600 hover:underline inline-flex items-center gap-1"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3" /> Ver menos
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" /> Ver completo
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Footer: Reply button */}
                {!isEditingThis && isAuthenticated && (
                  <div className="pl-11 pt-1 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingToId(isReplyingThis ? null : comment.id);
                        setReplyText("");
                        setReplyIsPublic(comment.is_public);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-primary-600 transition"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Responder {replies.length > 0 && `(${replies.length})`}
                    </button>
                  </div>
                )}

                {/* ── Inline Reply Composer ── */}
                {isReplyingThis && (
                  <div className="ml-11 mt-3 p-3 bg-gray-50/90 rounded-xl border border-gray-200/80 space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Respondiendo a <strong className="text-gray-700">@{comment.author_display_name}</strong></span>
                      <button
                        type="button"
                        onClick={() => setReplyingToId(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Escribe tu respuesta..."
                      className="w-full p-2.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus
                    />
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setReplyIsPublic(!replyIsPublic)}
                        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border ${
                          replyIsPublic ? "bg-primary-50 text-primary-700 border-primary-200" : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        {replyIsPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {replyIsPublic ? "Público" : "Privado"}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setReplyingToId(null)}
                          className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-200 rounded-lg"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCreateReply(comment.id)}
                          disabled={isSubmittingReply || !replyText.trim()}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-40"
                        >
                          <Send className="h-3 w-3" />
                          Responder
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Nested Replies Thread ── */}
                {replies.length > 0 && (
                  <div className="ml-6 sm:ml-11 mt-3 pl-4 border-l-2 border-primary-100 space-y-3">
                    {replies.map((reply) => {
                      const isEditingReply = editingId === reply.id;
                      const replyInitial = (reply.author_display_name || "L")[0].toUpperCase();

                      return (
                        <div
                          key={reply.id}
                          className="bg-white/90 p-3 rounded-xl border border-gray-100 space-y-2 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white flex-shrink-0 ${
                                  reply.is_owner ? "bg-primary-600" : "bg-gray-600"
                                }`}
                              >
                                {replyInitial}
                              </div>
                              <span className="font-semibold text-gray-900 text-xs">
                                {reply.author_display_name}
                              </span>
                              {reply.is_owner && (
                                <span className="text-[9px] font-bold text-primary-700 bg-primary-100 px-1 py-0.2 rounded">
                                  Tú
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400">
                                {new Date(reply.created_at).toLocaleDateString(locale, {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </span>
                            </div>

                            {reply.is_owner && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(reply)}
                                  className="p-1 text-gray-400 hover:text-primary-600 rounded"
                                  title="Editar"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(reply.id)}
                                  className="p-1 text-gray-400 hover:text-red-600 rounded"
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>

                          {isEditingReply ? (
                            <div className="space-y-2 pt-1">
                              <textarea
                                rows={2}
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full p-2 border border-primary-300 rounded-lg text-xs"
                                autoFocus
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 rounded"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(reply.id)}
                                  className="px-3 py-0.5 bg-primary-600 text-white text-xs font-semibold rounded"
                                >
                                  Guardar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-800 leading-relaxed pl-8 whitespace-pre-wrap">
                              {reply.content}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
