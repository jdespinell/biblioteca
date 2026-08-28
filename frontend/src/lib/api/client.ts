const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface FetchOptions extends RequestInit {
  skipRedirectOn401?: boolean;
  _isRetry?: boolean;
}

let isRefreshing = false;
let refreshSubscribers: ((success: boolean) => void)[] = [];

function subscribeTokenRefresh(cb: (success: boolean) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(success: boolean) {
  refreshSubscribers.forEach((cb) => cb(success));
  refreshSubscribers = [];
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const { skipRedirectOn401 = false, _isRetry = false, ...fetchOptions } = options;

  const response = await fetch(url, {
    ...fetchOptions,
    credentials: "include", // Critical: sends HttpOnly cookies
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const isAuthEndpoint =
      path.includes("/v1/auth/login") ||
      path.includes("/v1/auth/register") ||
      path.includes("/v1/auth/refresh");

    // Silent token refresh on 401
    if (response.status === 401 && !_isRetry && !isAuthEndpoint) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${BASE_URL}/v1/auth/refresh`, {
            method: "POST",
            credentials: "include",
          });
          const success = refreshRes.ok;
          isRefreshing = false;
          onRefreshed(success);
          if (success) {
            return apiFetch<T>(path, { ...options, _isRetry: true });
          }
        } catch {
          isRefreshing = false;
          onRefreshed(false);
        }
      } else {
        const refreshed = await new Promise<boolean>((resolve) => {
          subscribeTokenRefresh(resolve);
        });
        if (refreshed) {
          return apiFetch<T>(path, { ...options, _isRetry: true });
        }
      }

      if (!skipRedirectOn401 && typeof window !== "undefined") {
        const locale = window.location.pathname.split("/")[1] || "es";
        window.location.href = `/${locale}/auth/login`;
      }
    }

    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText };
    }

    const message =
      (errorData as { detail?: string })?.detail ?? "An error occurred";

    throw new ApiError(response.status, message, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { method: "GET", ...options }),

  post: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  put: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  patch: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  delete: <T>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { method: "DELETE", ...options }),
};

export const apiClient = api;
