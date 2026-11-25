import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getCurrentSession } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session || !session.isTrueAdmin) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const projectId = req.nextUrl.searchParams.get("state") || session.project.id;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/drive/oauth/callback";

  if (!code || !clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings?tab=google-drive&error=oauth_missing", req.url));
  }

  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    const db = getDb();
    db.prepare("UPDATE projects SET driveAuthMode = 'oauth', driveOAuthTokensJson = ?, updatedAt = ? WHERE id = ?").run(
      JSON.stringify(tokens),
      nowIso(),
      projectId
    );
    return NextResponse.redirect(new URL("/settings?tab=google-drive&connected=1", req.url));
  } catch {
    return NextResponse.redirect(new URL("/settings?tab=google-drive&error=oauth_failed", req.url));
  }
}
