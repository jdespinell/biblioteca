import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = (
  process.env.INTERNAL_API_URL || "http://backend:8000/api"
).replace(/\/$/, "");

const HOP_BY_HOP_HEADERS = new Set([
  "host",
  "connection",
  "transfer-encoding",
  "content-length",
  "content-encoding",
  "keep-alive",
]);

async function handler(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = (params.path || []).join("/");
  const search = req.nextUrl.search || "";
  const targetUrl = `${BACKEND_URL}/${path}${search}`;

  const headers = new Headers();
  req.headers.forEach((val, key) => {
    const lowerKey = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lowerKey)) {
      headers.set(key, val);
    }
  });

  try {
    let body: BodyInit | undefined = undefined;
    if (!["GET", "HEAD"].includes(req.method)) {
      body = await req.arrayBuffer();
    }

    const backendRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: "follow",
    });

    const resHeaders = new Headers();
    backendRes.headers.forEach((val, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== "set-cookie" && !HOP_BY_HOP_HEADERS.has(lowerKey)) {
        resHeaders.set(key, val);
      }
    });

    // Handle 204 No Content or 304 Not Modified (cannot have body in NextResponse)
    if (backendRes.status === 204 || backendRes.status === 304) {
      const emptyRes = new NextResponse(null, {
        status: backendRes.status,
        statusText: backendRes.statusText,
        headers: resHeaders,
      });
      forwardCookies(backendRes, emptyRes);
      return emptyRes;
    }

    const resBody = await backendRes.arrayBuffer();
    const response = new NextResponse(resBody, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: resHeaders,
    });

    forwardCookies(backendRes, response);
    return response;
  } catch (err) {
    console.error(`[API Proxy Error] ${req.method} ${targetUrl}:`, err);
    return NextResponse.json(
      { detail: `Error de conexión con el backend: ${String(err)}` },
      { status: 502 }
    );
  }
}

function forwardCookies(backendRes: Response, clientRes: NextResponse) {
  if (typeof backendRes.headers.getSetCookie === "function") {
    const cookies = backendRes.headers.getSetCookie();
    for (const cookie of cookies) {
      clientRes.headers.append("set-cookie", cookie);
    }
  } else {
    const rawCookie = backendRes.headers.get("set-cookie");
    if (rawCookie) {
      clientRes.headers.set("set-cookie", rawCookie);
    }
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;
