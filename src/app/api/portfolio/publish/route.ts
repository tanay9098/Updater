import type { NextRequest } from "next/server";
import { publishAnswer } from "@/lib/publishers/github-pages/handlers";
import { NO_STORE, handlerDeps, isSameOrigin, linkFor, requireAccount } from "@/lib/publishers/github-pages/server";
import { MAX_PUBLISH_BODY_BYTES } from "@/lib/validation/publication";

function refuse(status: number, message: string) {
  return Response.json({ ok: false, error: { code: "invalid_request", message } }, { status, headers: NO_STORE });
}

/**
 * Publishes the portfolio to the developer's `<login>.github.io` repository
 * (T10.9). Only an explicit Publish in the browser calls this. The body is
 * the public copy, validated again here before anything is written.
 * Answers with the commit Updater wrote; whether GitHub Pages built it is
 * read from `/api/portfolio/publish/status`.
 */
export async function POST(request: NextRequest) {
  const account = await requireAccount();
  if (account instanceof Response) return account;
  if (!isSameOrigin(request)) return refuse(403, "Requests must come from Updater's own pages.");

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_PUBLISH_BODY_BYTES) return refuse(413, "The portfolio is too large to publish in one request.");
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_PUBLISH_BODY_BYTES) return refuse(413, "The portfolio is too large to publish in one request.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return refuse(400, "The request wasn't valid JSON.");
  }

  const { status, body: answer } = await publishAnswer(handlerDeps(), await linkFor(request, account), body);
  return Response.json(answer, { status, headers: NO_STORE });
}
