import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { response, user, isAdmin } = await updateSession(request);
  if (!user) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (!isAdmin) return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
