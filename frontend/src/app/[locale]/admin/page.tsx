"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  BookOpen,
  Library,
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  MoreVertical,
  KeyRound,
  Trash2,
  Loader2,
  ArrowLeft,
  Crown,
  Lock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { adminApi, type AdminUser, type AdminStats } from "@/lib/api/admin";

export default function AdminPage() {
  const locale = useLocale();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedUserForPwd, setSelectedUserForPwd] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const isSuperuser = isAuthenticated && !!user?.is_superuser;

  const { data: stats, mutate: mutateStats } = useSWR<AdminStats>(
    isSuperuser ? "/admin/stats" : null,
    adminApi.getStats
  );

  const { data: users, mutate: mutateUsers, isLoading: usersLoading } = useSWR<AdminUser[]>(
    isSuperuser ? ["/admin/users", search] : null,
    () => adminApi.getUsers(search)
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated || !user?.is_superuser) {
    return (
      <div className="max-w-md mx-auto my-16 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center space-y-4">
        <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Acceso Restringido</h1>
        <p className="text-sm text-gray-500">
          Esta sección está protegida y es exclusiva para administradores del sistema.
        </p>
        <div className="pt-2">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al Inicio
          </Link>
        </div>
      </div>
    );
  }

  const handleToggleActive = async (targetUser: AdminUser) => {
    if (targetUser.id === user.id) {
      alert("No puedes desactivar tu propia cuenta.");
      return;
    }
    setUpdatingId(targetUser.id);
    try {
      await adminApi.updateUser(targetUser.id, { is_active: !targetUser.is_active });
      await mutateUsers();
      await mutateStats();
    } catch (err: unknown) {
      alert((err as { message?: string })?.message || "Error al actualizar estado");
    } finally {
      setUpdatingId(null);
      setActiveMenuId(null);
    }
  };

  const handleToggleSuperuser = async (targetUser: AdminUser) => {
    if (targetUser.id === user.id) {
      alert("No puedes revocar tus propios permisos de administrador.");
      return;
    }
    const action = targetUser.is_superuser ? "quitar el rol de Administrador a" : "hacer Administrador a";
    if (!confirm(`¿Estás seguro de que deseas ${action} ${targetUser.email}?`)) return;

    setUpdatingId(targetUser.id);
    try {
      await adminApi.updateUser(targetUser.id, { is_superuser: !targetUser.is_superuser });
      await mutateUsers();
      await mutateStats();
    } catch (err: unknown) {
      alert((err as { message?: string })?.message || "Error al cambiar rol");
    } finally {
      setUpdatingId(null);
      setActiveMenuId(null);
    }
  };

  const handleDeleteUser = async (targetUser: AdminUser) => {
    if (targetUser.id === user.id) {
      alert("No puedes eliminar tu propia cuenta.");
      return;
    }
    if (!confirm(`⚠️ ATENCIÓN: ¿Seguro que deseas eliminar definitivamente la cuenta de ${targetUser.email} y todos sus libros/notas asociados? Esta acción no se puede deshacer.`)) {
      return;
    }

    setUpdatingId(targetUser.id);
    try {
      await adminApi.deleteUser(targetUser.id);
      await mutateUsers();
      await mutateStats();
    } catch (err: unknown) {
      alert((err as { message?: string })?.message || "Error al eliminar usuario");
    } finally {
      setUpdatingId(null);
      setActiveMenuId(null);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPwd) return;
    if (newPassword.length < 8) {
      setPwdMsg({ type: "error", text: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }

    try {
      await adminApi.resetPassword(selectedUserForPwd.id, newPassword);
      setPwdMsg({ type: "success", text: "Contraseña actualizada exitosamente." });
      setNewPassword("");
      setTimeout(() => {
        setSelectedUserForPwd(null);
        setPwdMsg(null);
      }, 1500);
    } catch (err: unknown) {
      setPwdMsg({ type: "error", text: (err as { message?: string })?.message || "Error al resetear contraseña." });
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              Superuser
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Supervisa usuarios, gestiona privilegios de acceso y visualiza estadísticas de la plataforma.
          </p>
        </div>

        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-3.5 py-2 rounded-xl hover:bg-gray-50 transition w-fit shadow-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a la App
        </Link>
      </div>

      {/* Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-medium">Usuarios</span>
              <Users className="h-4 w-4 text-primary-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{stats.total_users}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {stats.active_users} activos · {stats.superusers} admin
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-medium">Catálogo Global</span>
              <BookOpen className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{stats.total_global_books}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Libros indexados</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-medium">Libros Personales</span>
              <Library className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{stats.total_user_books}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">En bibliotecas de usuarios</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-medium">Notas Totales</span>
              <FileText className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{stats.total_notes}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{stats.public_notes} públicas en Discover</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2 col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-medium">Seguridad</span>
              <Lock className="h-4 w-4 text-indigo-500" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-indigo-600">JWT + RLS</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Cookies HttpOnly + BCrypt</p>
            </div>
          </div>
        </div>
      )}

      {/* User Management Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Cuentas y Usuarios Registrados</h2>
            <p className="text-xs text-gray-500">Administra cuentas, activa/desactiva o asigna permisos</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por correo o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>
        </div>

        {usersLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : !users || users.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-xs">
            No se encontraron usuarios coincidentes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50/80 text-gray-500 font-semibold uppercase tracking-wider text-[10px] border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">Usuario</th>
                  <th className="py-3 px-4">Rol</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Libros / Notas</th>
                  <th className="py-3 px-4">Registro</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const initial = (u.full_name || u.email)[0].toUpperCase();
                  const isCurrent = u.id === user.id;

                  return (
                    <tr key={u.id} className="hover:bg-gray-50/60 transition">
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs ${
                            u.is_superuser ? "bg-gradient-to-tr from-indigo-600 to-purple-600" : "bg-gradient-to-tr from-gray-600 to-gray-500"
                          }`}>
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">
                              {u.full_name || "Sin nombre registrado"}
                              {isCurrent && (
                                <span className="ml-1.5 text-[10px] font-bold text-primary-600 bg-primary-50 px-1.5 py-0.2 rounded">
                                  Tú
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-gray-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        {u.is_superuser ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            <Crown className="h-3 w-3 text-indigo-600" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
                            Lector
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="h-3 w-3" />
                            Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-md">
                            <XCircle className="h-3 w-3" />
                            Inactiva
                          </span>
                        )}
                      </td>

                      {/* Counts */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-gray-800">{u.user_books_count}</span> libros ·{" "}
                        <span className="font-medium text-gray-800">{u.notes_count}</span> notas
                      </td>

                      {/* Registration Date */}
                      <td className="py-3.5 px-4 text-[11px] text-gray-400">
                        {new Date(u.created_at).toLocaleDateString(locale, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right relative">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUserForPwd(u);
                              setNewPassword("");
                              setPwdMsg(null);
                            }}
                            title="Cambiar contraseña"
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>

                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setActiveMenuId(activeMenuId === u.id ? null : u.id)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {activeMenuId === u.id && (
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-30 text-left">
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(u)}
                                  disabled={isCurrent || updatingId === u.id}
                                  className="w-full px-3.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between disabled:opacity-40"
                                >
                                  <span>{u.is_active ? "Desactivar cuenta" : "Activar cuenta"}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleToggleSuperuser(u)}
                                  disabled={isCurrent || updatingId === u.id}
                                  className="w-full px-3.5 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50 flex items-center justify-between disabled:opacity-40"
                                >
                                  <span>{u.is_superuser ? "Quitar rol Admin" : "Hacer Admin"}</span>
                                  <Crown className="h-3 w-3 text-indigo-600" />
                                </button>

                                <div className="border-t border-gray-100 my-1" />

                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  disabled={isCurrent || updatingId === u.id}
                                  className="w-full px-3.5 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center justify-between disabled:opacity-40"
                                >
                                  <span>Eliminar usuario</span>
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reset Password Modal */}
      {selectedUserForPwd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Restablecer Contraseña</h3>
                <p className="text-xs text-gray-400 truncate">{selectedUserForPwd.email}</p>
              </div>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nueva Contraseña</label>
                <input
                  type="password"
                  placeholder="Mínimo 8 caracteres..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {pwdMsg && (
                <div
                  className={`text-xs p-2 rounded-lg ${
                    pwdMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {pwdMsg.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPwd(null)}
                  className="px-3.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-sm"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
