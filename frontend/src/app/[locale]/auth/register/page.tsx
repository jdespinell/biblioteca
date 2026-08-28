"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { BookOpen, Loader2 } from "lucide-react";
import { useState } from "react";
import { authApi } from "@/lib/api/auth";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api/client";

const registerSchema = z
  .object({
    full_name: z.string().min(2, "Mínimo 2 caracteres"),
    email: z.string().email("Email inválido"),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/\d/, "Debe contener al menos un número"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const { mutate } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
  });

  const onSubmit = async (data: RegisterForm) => {
    setApiError(null);
    try {
      const user = await authApi.register({
        email: data.email,
        password: data.password,
        full_name: data.full_name,
      });
      await mutate(user, false);
      window.location.href = `/${locale}`;
    } catch (e) {
      if (e instanceof ApiError) {
        setApiError(e.message);
      } else {
        setApiError("Error al registrar la cuenta. Intenta de nuevo.");
      }
    }
  };

  const onInvalid = (formErrors: Record<string, { message?: string }>) => {
    const firstKey = Object.keys(formErrors)[0];
    if (firstKey && formErrors[firstKey]?.message) {
      setApiError(formErrors[firstKey].message);
    }
  };

  const fields = [
    {
      name: "full_name" as const,
      label: t("name"),
      type: "text",
      placeholder: "Tu nombre completo",
    },
    {
      name: "email" as const,
      label: t("email"),
      type: "email",
      placeholder: t("emailPlaceholder"),
    },
    {
      name: "password" as const,
      label: t("password"),
      type: "password",
      placeholder: t("passwordPlaceholder"),
    },
    {
      name: "confirm_password" as const,
      label: t("confirmPassword"),
      type: "password",
      placeholder: "Repite tu contraseña",
    },
  ];

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-2xl mb-4">
            <BookOpen className="h-8 w-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t("register")}</h1>
          <p className="text-gray-500 mt-1">Crea tu biblioteca personal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
            {fields.map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {field.label}
                </label>
                <input
                  {...register(field.name)}
                  type={field.type}
                  placeholder={field.placeholder}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent transition ${
                    errors[field.name]
                      ? "border-red-400 focus:ring-red-400 bg-red-50/10"
                      : "border-gray-200 focus:ring-primary-500"
                  }`}
                />
                {errors[field.name] && (
                  <p className="mt-1 text-xs text-red-500 font-medium">
                    {errors[field.name]?.message}
                  </p>
                )}
              </div>
            ))}

            {apiError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                {apiError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("registerButton")}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-500">
            {t("hasAccount")}{" "}
            <Link
              href={`/${locale}/auth/login`}
              className="text-primary-600 font-medium hover:text-primary-700"
            >
              {t("login")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
