import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { KLEEN_DEFAULT_NDA_TEXT } from "./nda-template";

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
}

export function seedIfEmpty(db: DatabaseSync) {
  const row = db.prepare("SELECT COUNT(*) as c FROM projects").get() as { c: number } | undefined;
  if (row && row.c > 0) return;

  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync("kleen2026", 10);

  const adminId = id("usr");
  const investorId = id("usr");
  const advisorId = id("usr");

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, passwordHash, firstName, lastName, company, jobTitle, phone, language, timezone, passwordChangedAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertUser.run(adminId, "ahmed.badran@kleen.sa", passwordHash, "Ahmed", "Badran", "Kleen", "Data Room Administrator", "+966530262716", "en", "Asia/Riyadh", now, now, now);
  insertUser.run(investorId, "investor@partner-capital.sa", passwordHash, "Khalid", "Al-Mansoor", "Partner Capital", "Investment Principal", "", "en", "Asia/Riyadh", now, now, now);
  insertUser.run(advisorId, "counsel@legal-advisors.sa", passwordHash, "Sara", "Al-Harbi", "Legal Advisors LLP", "Senior Counsel", "", "en", "Asia/Riyadh", now, now, now);

  const projectId = id("prj");
  db.prepare(`
    INSERT INTO projects (
      id, name, slug, projectCode, status, projectType, storageLocation, themeColor,
      driveRootFolderName, driveAuthMode, lastSyncedAt, lastSyncStatus,
      adminEmail, adminPhone, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    "Kleen_2025",
    "kleen-2025",
    "5_39595",
    "Live",
    "Fundraising",
    "Google Drive Mirror",
    "#007AFF",
    "Kleen_2025 (Google Drive Mirror)",
    "demo",
    now,
    "synced",
    "ahmed.badran@kleen.sa",
    "+966530262716",
    "2025-03-12T09:00:00.000Z",
    now
  );

  const insertHistory = db.prepare(
    "INSERT INTO project_status_history (id, projectId, status, actorName, note, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertHistory.run(id("hist"), projectId, "Project created", "System", "Initial data room created", "2025-03-12T09:00:00.000Z");
  insertHistory.run(id("hist"), projectId, "Project reopened (Live)", "Ahmed Badran", "Live investor access enabled", "2026-02-09T10:30:00.000Z");

  const integrations = [
    ["chatgpt", "ChatGPT", "chatgpt.com"],
    ["claude", "Claude", "claude.ai"],
    ["harvey", "Harvey", "harvey.ai"],
    ["copilot", "MS Copilot", "m365.cloud.microsoft"],
    ["rogo", "Rogo", "rogo.ai"],
    ["emma", "Emma Legal", "emma.legal"],
    ["jurimesh", "Jurimesh", "jurimesh.com"],
    ["lextract", "Lextract", "lextract.ai"],
    ["prudentia", "Prudentia Sciences", "prudentiasciences.com"],
  ];
  const insertInt = db.prepare(
    "INSERT INTO project_integrations (id, projectId, key, name, domain, enabled) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const [key, name, domain] of integrations) {
    insertInt.run(id("int"), projectId, key, name, domain, 0);
  }

  const adminGroupId = id("grp");
  const investorGroupId = id("grp");
  const legalGroupId = id("grp");
  const insertGroup = db.prepare(`
    INSERT INTO groups (id, projectId, name, role, isDefaultAdmin, featurePermissionsJson, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertGroup.run(
    adminGroupId,
    projectId,
    "Administrators",
    "Administrator",
    1,
    JSON.stringify({
      projectSettings: true,
      recycleBin: true,
      qnaSetup: true,
      checklist: true,
      manageDocuments: true,
      managePermissions: true,
      createGroups: true,
      manageUsers: true,
      viewAllReports: true,
    }),
    now,
    now
  );
  insertGroup.run(
    investorGroupId,
    projectId,
    "Investor Group",
    "User",
    0,
    JSON.stringify({
      checklist: true,
      viewPermittedDocuments: true,
      viewOwnGroupUsers: true,
      viewOwnActivity: true,
      viewGroupActivity: false,
    }),
    now,
    now
  );
  insertGroup.run(
    legalGroupId,
    projectId,
    "Legal Advisors",
    "User",
    0,
    JSON.stringify({
      checklist: true,
      viewPermittedDocuments: true,
      viewOwnGroupUsers: true,
      viewOwnActivity: true,
      viewGroupActivity: true,
    }),
    now,
    now
  );

  const insertPart = db.prepare(`
    INSERT INTO project_participants (id, projectId, userId, groupId, status, lastSignInAt, addedBy, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPart.run(id("prt"), projectId, adminId, adminGroupId, "Engaged", now, "System", now, now);
  insertPart.run(id("prt"), projectId, investorId, investorGroupId, "Engaged", new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), "Ahmed Badran", now, now);
  insertPart.run(id("prt"), projectId, advisorId, legalGroupId, "Signed in", new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), "Ahmed Badran", now, now);

  const nodes = [
    ["demo-f1", null, "1 الملف الاستثماري", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "1", 1, "2026-05-05T10:00:00Z", null],
    ["demo-f2", null, "2 Investments Documents", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "2", 2, "2025-03-15T10:00:00Z", null],
    ["demo-f3", null, "3 Legal Documents", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "3", 3, "2025-03-15T10:00:00Z", null],
    ["demo-f4", null, "4 Financial Documents", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "4", 4, "2025-03-15T10:00:00Z", null],
    ["demo-f5", null, "5 Kleen Departments", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "5", 5, "2025-03-15T10:00:00Z", null],
    ["demo-f6", null, "6 Safe Notes", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "6", 6, "2025-03-15T10:00:00Z", null],
    ["demo-f7", null, "7 TEAM", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "7", 7, "2025-10-05T10:00:00Z", null],

    ["demo-1-1", "demo-f1", "1.1 Kleen Investment Deck 2026.pdf", 0, "application/pdf", "pdf", "PDF", 4820000, 12, "1.1", 1, "2026-05-05T10:00:00Z", "Kleen Investment Memorandum 2026\n\nExecutive Summary: Kleen operates a tech-enabled laundry and garment care network across Saudi Arabia with high unit economics, B2B hospitality contracts, and rapid subscription retention."],
    ["demo-1-2", "demo-f1", "1.2 ملخص العرض الاستثماري.pdf", 0, "application/pdf", "pdf", "PDF", 3150000, 8, "1.2", 2, "2026-05-04T10:00:00Z", "Kleen Arabic Investment Brief\n\nMirrored from Google Drive folder 1."],
    ["demo-1-3", "demo-f1", "1.3 Unit Economics & Expansion Roadmap.xlsx", 0, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx", "Spreadsheets", 1240000, 4, "1.3", 3, "2026-05-03T10:00:00Z", "Unit Economics Model\n\nCAC, LTV, Contribution Margin, and Hub Utilization."],

    ["demo-f2-1", "demo-f2", "2.1 Cap Table & Shareholders", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "2.1", 1, "2025-03-15T10:00:00Z", null],
    ["demo-f2-2", "demo-f2", "2.2 Company Profiles", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "2.2", 2, "2025-03-15T10:00:00Z", null],
    ["demo-2-1-1", "demo-f2-1", "2.1.1 Kleen Cap Table Q1 2026.xlsx", 0, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx", "Spreadsheets", 890000, 3, "2.1.1", 1, "2026-02-10T10:00:00Z", "Cap Table Summary — Authorized & Issued Shares."],
    ["demo-2-2-1", "demo-f2-2", "2.2.1 Kleen Corporate Profile.pdf", 0, "application/pdf", "pdf", "PDF", 5400000, 10, "2.2.1", 1, "2026-01-12T10:00:00Z", "Corporate Profile — Mission, Operations, and Milestones."],

    ["demo-f3-1", "demo-f3", "3.1 Commercial Registration & Articles", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "3.1", 1, "2025-03-15T10:00:00Z", null],
    ["demo-f3-2", "demo-f3", "3.2 Material Contracts & Leases", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "3.2", 2, "2025-03-15T10:00:00Z", null],
    ["demo-3-1-1", "demo-f3-1", "3.1.1 Commercial Registration Certificate.pdf", 0, "application/pdf", "pdf", "PDF", 640000, 2, "3.1.1", 1, "2025-04-01T10:00:00Z", "Official Commercial Registration and Articles of Association."],
    ["demo-3-2-1", "demo-f3-2", "3.2.1 Central Hub Lease Agreement.pdf", 0, "application/pdf", "pdf", "PDF", 2150000, 9, "3.2.1", 1, "2025-05-18T10:00:00Z", "Central Processing Hub Lease Agreement — 5-Year Term + Renewal."],

    ["demo-f4-1", "demo-f4", "4.1 Banks Statements", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "4.1", 1, "2025-03-15T10:00:00Z", null],
    ["demo-f4-2", "demo-f4", "4.2 Financial Models", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "4.2", 2, "2025-03-15T10:00:00Z", null],
    ["demo-f4-3", "demo-f4", "4.3 Financial Statements", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "4.3", 3, "2025-03-15T10:00:00Z", null],
    ["demo-f4-4", "demo-f4", "4.4 Sales Reports", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "4.4", 4, "2025-03-15T10:00:00Z", null],
    ["demo-f4-5", "demo-f4", "4.5 Valuation", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "4.5", 5, "2025-03-15T10:00:00Z", null],
    ["demo-f4-6", "demo-f4", "4.6 Salaries and Allowances", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "4.6", 6, "2025-03-15T10:00:00Z", null],

    ["demo-f4-3-4", "demo-f4-3", "4.3.4 Financial Statements 2024", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "4.3.4", 1, "2025-03-15T10:00:00Z", null],
    ["demo-f4-3-5", "demo-f4-3", "4.3.5 Financial Statements 2025", 1, "application/vnd.google-apps.folder", "folder", "Folder", 0, 0, "4.3.5", 2, "2026-03-10T10:00:00Z", null],
    ["demo-4-3-5-1", "demo-f4-3-5", "4.3.5.1 Audited Financial Statements 2025.pdf", 0, "application/pdf", "pdf", "PDF", 3920000, 11, "4.3.5.1", 1, "2026-03-10T10:00:00Z", "Audited Financial Statements FY 2025 — Income Statement, Balance Sheet, and Cash Flows."],
    ["demo-4-3-5-6", "demo-f4-3-5", "4.3.5.6 2025 _ الاقرار الزكوى.pdf", 0, "application/pdf", "pdf", "PDF", 1180000, 6, "4.3.5.6", 2, "2026-03-12T10:00:00Z", "FY 2025 Zakat Declaration & Tax Authority Filing."],
    ["demo-4-2-1", "demo-f4-2", "4.2.1 Kleen 5-Year Financial Model.xlsx", 0, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx", "Spreadsheets", 2450000, 6, "4.2.1", 1, "2026-04-02T10:00:00Z", "5-Year Financial Projections 2026-2030."],
    ["demo-4-5-1", "demo-f4-5", "4.5.1 Independent Valuation Report 2025.pdf", 0, "application/pdf", "pdf", "PDF", 2890000, 9, "4.5.1", 1, "2026-01-25T10:00:00Z", "DCF & Comparable Multiples Independent Valuation Report."],

    ["demo-f5-1", "demo-f5", "5.1 Operations & Fleet KPIs.pdf", 0, "application/pdf", "pdf", "PDF", 1750000, 5, "5.1", 1, "2026-02-18T10:00:00Z", "Operations, Turnaround SLA, and Delivery Fleet KPIs."],
    ["demo-f6-1", "demo-f6", "6.1 Standard SAFE Note Schedule.pdf", 0, "application/pdf", "pdf", "PDF", 980000, 4, "6.1", 1, "2025-11-20T10:00:00Z", "SAFE Note Conversion Caps & Discount Schedule."],
    ["demo-f7-1", "demo-f7", "7.1 Executive Leadership Bios.pdf", 0, "application/pdf", "pdf", "PDF", 1420000, 6, "7.1", 1, "2025-10-05T10:00:00Z", "Leadership Profiles — Founders & C-Suite Executives."],
    ["demo-f7-2", "demo-f7", "7.2 Organization Chart 2026.png", 0, "image/png", "png", "Images", 620000, 1, "7.2", 2, "2025-10-05T10:00:00Z", "Kleen 2026 Organization Structure."],
  ] as const;

  const insertNode = db.prepare(`
    INSERT INTO drive_nodes (
      id, projectId, driveFileId, parentDriveId, name, isFolder, mimeType, extension, category,
      sizeBytes, pageCount, dotIndex, sortOrder, driveModifiedAt, driveCreatedAt, demoContentText, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const nodeIdMap: Record<string, string> = {};
  for (const n of nodes) {
    const nid = id("nod");
    nodeIdMap[n[0]] = nid;
    insertNode.run(nid, projectId, n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9], n[10], n[11], n[11], n[12], now, now);
  }

  const insertPerm = db.prepare(`
    INSERT INTO document_permissions (id, projectId, groupId, nodeId, level, updatedBy, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const perms: [string, string, string][] = [
    [investorGroupId, nodeIdMap["demo-f1"], "pdf"],
    [investorGroupId, nodeIdMap["demo-f2"], "view"],
    [investorGroupId, nodeIdMap["demo-f3"], "view"],
    [investorGroupId, nodeIdMap["demo-f4"], "pdf"],
    [investorGroupId, nodeIdMap["demo-f5"], "view"],
    [investorGroupId, nodeIdMap["demo-f6"], "fence"],
    [investorGroupId, nodeIdMap["demo-f7"], "view"],
    [legalGroupId, nodeIdMap["demo-f3"], "original"],
    [legalGroupId, nodeIdMap["demo-f6"], "pdf"],
    [legalGroupId, nodeIdMap["demo-f4"], "view"],
  ];
  for (const [g, n, lvl] of perms) {
    insertPerm.run(id("prm"), projectId, g, n, lvl, "Ahmed Badran", now);
  }

  const insertNote = db.prepare(`
    INSERT INTO document_notes (id, projectId, nodeId, authorId, content, noteType, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertNote.run(id("not"), projectId, nodeIdMap["demo-f2"], adminId, "Updated cap table and investment briefs mirrored from Google Drive.", "Shared", now, now);
  insertNote.run(id("not"), projectId, nodeIdMap["demo-f7-1"], adminId, "Executive bios verified for investor review.", "Private", now, now);

  const insertLabel = db.prepare(
    "INSERT INTO label_definitions (id, projectId, groupName, type, valuesJson, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertLabel.run(id("lbl"), projectId, "Department", "Single", JSON.stringify(["Finance", "Legal", "Operations"]), now);
  insertLabel.run(id("lbl"), projectId, "Review Status", "Single", JSON.stringify(["Verified", "Pending Audit", "Confidential"]), now);

  const insertTerms = db.prepare(`
    INSERT INTO terms_of_access (id, projectId, title, type, displayMode, assignedGroupIds, content, enabled, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertTerms.run(
    id("trm"),
    projectId,
    "NDA_Kleen_Investor_Group",
    "NDA",
    "On first sign-in",
    JSON.stringify([investorGroupId]),
    KLEEN_DEFAULT_NDA_TEXT,
    1,
    now,
    now
  );
  insertTerms.run(
    id("trm"),
    projectId,
    "Disclaimer",
    "Disclaimer",
    "On first sign-in",
    JSON.stringify([legalGroupId]),
    "All materials provided in this Virtual Data Room are for due diligence evaluation purposes only and do not constitute an offer to sell securities.",
    0,
    now,
    now
  );

  const insertQna = db.prepare(`
    INSERT INTO qna_questions (id, projectId, code, subject, body, answer, status, priority, category, authorId, assignedTo, nodeId, isFaq, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertQna.run(
    id("qna"),
    projectId,
    "B100",
    "Clarification on Q4 Zakat filing & audited adjustments",
    "Could management confirm whether the Zakat provision in 4.3.5.6 aligns with the audited FY25 statements?",
    "Yes, the provision in the audited FY25 statements reflects the exact submitted Zakat declaration.",
    "Answered",
    "High",
    "Tax",
    investorId,
    "Administrators",
    nodeIdMap["demo-4-3-5-6"],
    1,
    now,
    now
  );
  insertQna.run(
    id("qna"),
    projectId,
    "B101",
    "Central Hub lease renewal options",
    "Are there automatic renewal terms after year 5 in the Central Hub Lease Agreement?",
    "",
    "Assigned",
    "Medium",
    "Legal",
    advisorId,
    "Administrators",
    nodeIdMap["demo-3-2-1"],
    0,
    now,
    now
  );

  const insertCheck = db.prepare(`
    INSERT INTO checklist_items (id, projectId, code, category, title, priority, status, assignedGroupId, linkedNodeId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertCheck.run(id("chk"), projectId, "DD-01", "Financial", "Audited Financial Statements (FY25)", "High", "Ready", investorGroupId, nodeIdMap["demo-4-3-5-1"], now, now);
  insertCheck.run(id("chk"), projectId, "DD-02", "Tax", "Annual Zakat Declaration 2025", "High", "Ready", investorGroupId, nodeIdMap["demo-4-3-5-6"], now, now);
  insertCheck.run(id("chk"), projectId, "DD-03", "Legal", "Commercial Registration & Articles", "Medium", "Ready", legalGroupId, nodeIdMap["demo-3-1-1"], now, now);
  insertCheck.run(id("chk"), projectId, "DD-04", "Corporate", "5-Year Financial Model & Valuation", "High", "In Progress", investorGroupId, nodeIdMap["demo-4-2-1"], now, now);

  const insertLog = db.prepare(`
    INSERT INTO activity_logs (id, projectId, userId, groupId, nodeId, actorName, actorEmail, groupName, category, action, description, durationSeconds, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const ts = Date.now();
  insertLog.run(id("log"), projectId, adminId, adminGroupId, null, "Ahmed Badran", "ahmed.badran@kleen.sa", "Administrators", "Drive sync", "Google Drive synced", "Mirrored folder tree Kleen_2025 (Read-Only Sync Mode)", 0, new Date(ts - 1000 * 60 * 15).toISOString());
  insertLog.run(id("log"), projectId, investorId, investorGroupId, nodeIdMap["demo-1-1"], "Khalid Al-Mansoor", "investor@partner-capital.sa", "Investor Group", "Documents", "Document viewed", "1.1 Kleen Investment Deck 2026.pdf (12 pages)", 420, new Date(ts - 1000 * 60 * 60 * 3).toISOString());
  insertLog.run(id("log"), projectId, investorId, investorGroupId, nodeIdMap["demo-4-3-5-1"], "Khalid Al-Mansoor", "investor@partner-capital.sa", "Investor Group", "Documents", "PDF downloaded", "4.3.5.1 Audited Financial Statements 2025.pdf (Watermarked)", 185, new Date(ts - 1000 * 60 * 60 * 4).toISOString());
  insertLog.run(id("log"), projectId, advisorId, legalGroupId, nodeIdMap["demo-3-2-1"], "Sara Al-Harbi", "counsel@legal-advisors.sa", "Legal Advisors", "Documents", "Document viewed", "3.2.1 Central Hub Lease Agreement.pdf", 260, new Date(ts - 1000 * 60 * 60 * 24).toISOString());
  insertLog.run(id("log"), projectId, adminId, adminGroupId, null, "Ahmed Badran", "ahmed.badran@kleen.sa", "Administrators", "Permissions", "Permissions assigned", "Target group: Investor Group | Folder: 4 Financial Documents | Level: PDF", 0, new Date(ts - 1000 * 60 * 60 * 48).toISOString());
}
