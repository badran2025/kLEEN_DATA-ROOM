import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getCurrentSession } from "@/lib/auth";

export async function GET() {
  const session = await getCurrentSession();
  if (!session || !session.isTrueAdmin) {
    return NextResponse.json({ error: "Admin session required" }, { status: 403 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/drive/oauth/callback";

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not configured in .env. Use Service Account JSON or API Key in Settings > Google Drive Sync, or set OAuth credentials in .env.",
      },
      { status: 400 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.readonly"],
    state: session.project.id,
  });

  return NextResponse.redirect(url);
}
