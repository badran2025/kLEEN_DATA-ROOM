import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDb, plain } from "./db";
import type { GroupDto, ProjectDto, UserDto } from "./types";

const SESSION_COOKIE = "kleen_vdr_session";

function getSecretKey() {
  const secret = process.env.AUTH_SECRET || "kleen-data-room-local-dev-secret-2026";
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  email: string;
  projectId: string;
  viewAsGroupId?: string | null;
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

function toBool(v: unknown): boolean {
  return v === 1 || v === true;
}

export function mapProject(row: Record<string, unknown>): ProjectDto {
  return {
    ...(row as unknown as ProjectDto),
    customInvitations: toBool(row.customInvitations),
    autoIndexing: toBool(row.autoIndexing),
    versioning: toBool(row.versioning),
    publishing: toBool(row.publishing),
    supportAccess: toBool(row.supportAccess),
    twoFactorRequired: toBool(row.twoFactorRequired),
    emailVerification: toBool(row.emailVerification),
    aiToolsEnabled: toBool(row.aiToolsEnabled),
    aiRedaction: toBool(row.aiRedaction),
    aiSearch: toBool(row.aiSearch),
    aiTranslation: toBool(row.aiTranslation),
    aiSimilarQna: toBool(row.aiSimilarQna),
    watermarkEnabled: toBool(row.watermarkEnabled),
    watermarkOnView: toBool(row.watermarkOnView),
    watermarkOnPrint: toBool(row.watermarkOnPrint),
    watermarkOnDownload: toBool(row.watermarkOnDownload),
    isFavorite: toBool(row.isFavorite),
  };
}

export function mapGroup(row: Record<string, unknown>): GroupDto {
  return {
    ...(row as unknown as GroupDto),
    isDefaultAdmin: toBool(row.isDefaultAdmin),
    accessEnabled: toBool(row.accessEnabled),
    require2fa: toBool(row.require2fa),
    docNotifications: toBool(row.docNotifications),
    isDeleted: toBool(row.isDeleted),
  };
}

export function mapUser(row: Record<string, unknown>): UserDto {
  return {
    id: String(row.id),
    email: String(row.email),
    firstName: String(row.firstName),
    lastName: String(row.lastName),
    company: String(row.company || ""),
    jobTitle: String(row.jobTitle || ""),
    phone: String(row.phone || ""),
    language: String(row.language || "en"),
    timezone: String(row.timezone || "Asia/Riyadh"),
    autoTimezone: toBool(row.autoTimezone),
    twoFactorEnabled: toBool(row.twoFactorEnabled),
    passwordChangedAt: String(row.passwordChangedAt),
    notifyDocChanges: toBool(row.notifyDocChanges),
    notifyStorageLimit: toBool(row.notifyStorageLimit),
  };
}

export async function getCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const db = getDb();
  const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.userId) as Record<string, unknown> | undefined;
  if (!userRow) return null;

  const projectRow =
    (db.prepare("SELECT * FROM projects WHERE id = ?").get(payload.projectId) as Record<string, unknown> | undefined) ??
    (db.prepare("SELECT * FROM projects ORDER BY createdAt ASC LIMIT 1").get() as Record<string, unknown> | undefined);
  if (!projectRow) return null;

  const partRow = db
    .prepare("SELECT * FROM project_participants WHERE projectId = ? AND userId = ?")
    .get(String(projectRow.id), String(userRow.id)) as Record<string, unknown> | undefined;
  if (!partRow || !toBool(partRow.accessEnabled)) return null;

  const actualGroupRow = db
    .prepare("SELECT * FROM groups WHERE id = ?")
    .get(String(partRow.groupId)) as Record<string, unknown> | undefined;
  if (!actualGroupRow || toBool(actualGroupRow.isDeleted)) return null;

  const actualGroup = mapGroup(plain(actualGroupRow));
  let effectiveGroup = actualGroup;
  let isViewingAs = false;

  if (payload.viewAsGroupId && actualGroup.role === "Administrator") {
    const previewRow = db
      .prepare("SELECT * FROM groups WHERE id = ? AND projectId = ? AND isDeleted = 0")
      .get(payload.viewAsGroupId, String(projectRow.id)) as Record<string, unknown> | undefined;
    if (previewRow) {
      effectiveGroup = mapGroup(plain(previewRow));
      isViewingAs = true;
    }
  }

  return {
    user: mapUser(plain(userRow)),
    project: mapProject(plain(projectRow)),
    participation: plain(partRow),
    actualGroup,
    effectiveGroup,
    isViewingAs,
    isAdmin: effectiveGroup.role === "Administrator",
    isTrueAdmin: actualGroup.role === "Administrator",
  };
}
