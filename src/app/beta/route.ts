import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { BETA_COOKIE } from "@/lib/beta";

const BETA_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function matchesBetaCode(code: string, expected: string): boolean {
  const codeBuffer = Buffer.from(code);
  const expectedBuffer = Buffer.from(expected);
  return codeBuffer.length === expectedBuffer.length && timingSafeEqual(codeBuffer, expectedBuffer);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  if (requestUrl.searchParams.get("leave") === "1") {
    const response = NextResponse.redirect(new URL("/?beta=left", requestUrl.origin));
    response.cookies.set(BETA_COOKIE, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      httpOnly: false,
    });
    return response;
  }

  const expected = process.env.BETA_CODE || "72db54486afc95ad";
  const code = requestUrl.searchParams.get("code") ?? "";
  if (!matchesBetaCode(code, expected)) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  const response = NextResponse.redirect(new URL("/?beta=joined", requestUrl.origin));
  response.cookies.set(BETA_COOKIE, "1", {
    path: "/",
    maxAge: BETA_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
  });
  return response;
}
