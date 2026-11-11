import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveGatewayBaseUrl(): string {
  const configured =
    process.env.API_GATEWAY_INTERNAL_URL ||
    process.env.BACKEND_GATEWAY_URL ||
    (process.env.DOCKER ? "http://api-gateway:8080" : "http://localhost:8080");
  return configured.replace(/\/+$/, "");
}

async function proxyToGateway(
  request: NextRequest,
  context: { params: { path: string[] } }
): Promise<Response> {
  const pathSegments = context.params?.path ?? [];
  const targetPath = pathSegments.map(encodeURIComponent).join("/");
  const targetUrl = `${resolveGatewayBaseUrl()}/${targetPath}${request.nextUrl.search}`;

  const forwardHeaders = new Headers();
  const hopByHop = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
  ]);

  request.headers.forEach((value, key) => {
    if (!hopByHop.has(key.toLowerCase())) {
      forwardHeaders.set(key, value);
    }
  });

  // Inject fallback development auth and tenant headers if not present
  if (!forwardHeaders.has("authorization")) {
    forwardHeaders.set("authorization", "Bearer dev_token_deltix");
  }
  if (!forwardHeaders.has("x-tenant-id")) {
    forwardHeaders.set("x-tenant-id", "org_prod_442");
  }
  if (!forwardHeaders.has("x-user-id")) {
    forwardHeaders.set("x-user-id", "usr_dev_finance");
  }

  const hasBody = !["GET", "HEAD"].includes(request.method.toUpperCase());
  const body = hasBody ? await request.arrayBuffer() : undefined;

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: "manual",
    });

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        !hopByHop.has(lower) &&
        lower !== "content-encoding" &&
        lower !== "content-length"
      ) {
        responseHeaders.append(key, value);
      }
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach API Gateway";
    return Response.json(
      {
        error: "GATEWAY_UNREACHABLE",
        message,
      },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  return proxyToGateway(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  return proxyToGateway(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  return proxyToGateway(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  return proxyToGateway(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  return proxyToGateway(request, context);
}

export async function OPTIONS(
  request: NextRequest,
  context: { params: { path: string[] } }
) {
  return proxyToGateway(request, context);
}
