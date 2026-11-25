# Kleen Data Room — Product & Engineering Specification Prompt

> **Use this prompt to design and build `Kleen Data Room`: an Apple-inspired Virtual Data Room (VDR) web application whose folder structure, files, and contents are dynamically mirrored from a designated Google Drive folder.**

---

## Prompt

Build a full-stack Virtual Data Room (VDR) web application named **Kleen Data Room**.

The application must deliver the enterprise capabilities and information architecture of **iDeals VDR** (`Documents`, hierarchical dot-indexing, secure `Document Viewer` with dynamic watermarks, `Quick Access`, `Search & Filters`, `Participants & Permissions Matrix`, `View As`, `Notes`, `Q&A`, `Due Diligence Checklist`, `Analytics Dashboard`, and `Audit Reports`), while introducing two defining requirements:

1. **Apple-Style Design Language (macOS / iCloud Drive / Apple HIG Aesthetic):**
   - Craft a refined, tactile, minimal interface inspired by native Apple applications (macOS Finder, Preview, and iCloud Drive).
   - **Adaptive Light & Dark Modes:**
     - *Light Mode:* Crisp `#FFFFFF` canvas, `#F5F5F7` secondary surfaces, translucent frosted-glass sidebars (`backdrop-filter: blur(20px) saturate(180%)`), delicate `1px` hairline borders (`rgba(0,0,0,0.08)`), subtle layered shadows, and Apple System Blue (`#007AFF`) primary accents.
     - *Dark Mode:* Deep `#1C1C1E` / `#141416` base, `#2C2C2E` elevated cards/popovers, translucent dark vibrancy rails, hairline dividers (`rgba(255,255,255,0.1)`), and `#0A84FF` accents.
   - **Typography & Micro-Interactions:**
     - Clean system/humanist typography (`SF Pro Display / Inter` for English, paired with `IBM Plex Sans Arabic / Cairo` for Arabic filenames and labels) with `tabular-nums` alignment for index numbers, file sizes, page counts, and dates.
     - Smooth spring-like transitions, hover highlights, clean pill badges, and keyboard shortcuts (`Shift+F`, `S` to favorite, `Ctrl/Cmd+C`, `N` to rename/annotate where permitted, arrow-key tree navigation).
   - **Bilingual Mixed-Direction Support (EN / AR):**
     - Seamlessly render mixed English and Arabic folder/file names (e.g., `1 الملف الاستثماري`, `4.3.5.6 2025 _ الاقرار الزكوى.pdf`) with proper bidirectional (`dir="auto"`) text alignment and an optional full UI language toggle (English / Arabic).

2. **Google Drive Live Mirroring Engine (Single Source of Truth):**
   - Instead of storing standalone uploaded files in a separate silo, connect **Kleen Data Room** directly to a specific **Google Drive Root Folder** (`GOOGLE_DRIVE_ROOT_FOLDER_ID`) via Google Drive API v3 (OAuth 2.0 / Service Account).
   - **Exact Structure & Content Reflection:**
     - Recursively mirror the exact folder tree, nested subfolders, and files inside the designated Google Drive folder—preserving hierarchy, names, sizes, MIME types, modification timestamps, and file contents.
     - Automatically convert or stream Google Workspace native files (Google Docs, Sheets, Slides) alongside PDFs, Office files (`.docx`, `.xlsx`, `.pptx`), images, and archives for seamless in-browser preview.
   - **Synchronization & Caching:**
     - Maintain a fast metadata index cache (database) synced with Google Drive via `Drive Changes API` / scheduled polling + an explicit **"Sync with Drive"** admin action showing last sync timestamp and sync status.
     - Any folder/file added, renamed, moved, or removed inside the target Google Drive folder is reflected automatically in **Kleen Data Room** while preserving VDR metadata (notes, permissions, view counts, audit logs, and favorites) mapped stably by Google Drive `fileId`.
   - **Automatic VDR Hierarchical Dot-Indexing:**
     - Parse existing numeric prefixes if present in Drive names (e.g., `1`, `4.3`, `4.3.5.6`) or dynamically assign clean dot-delimited decimal indices (`1`, `1.1`, `1.1.1`, `2`, `2.1`, …) matching the folder structure, with a **"Rebuild Index"** utility and **"Export Project Index"** (CSV / XLSX / PDF).

---

### Core Layout & Navigation Architecture

Implement a responsive three-pane macOS-inspired application shell:

1. **Collapsible Left Navigation Rail:**
   - Top **Room Header / Switcher** displaying the **Kleen** brand mark and room title (`Kleen Data Room` / active Drive folder).
   - Primary navigation items with collapsible submenus:
     - **Dashboard** (`/dashboard`)
     - **Documents** (`/documents`) — sub-views: `All`, `Notes`, `External links`, `Signatures / Approvals`
     - **Due Diligence Checklist** (`/checklist`)
     - **Participants** (`/participants`)
     - **Permissions** (`/permissions`)
     - **Q&A** (`/qna`)
     - **Reports** (`/reports`) — sub-views: `Activity log`, `Documents overview`, `Engagement matrix`, `Sync & Storage`, `Permissions log`
     - **Settings** (`/settings`) — sub-views: `General`, `Google Drive Sync`, `Branding`, `Terms of Access`, `Watermarks`, `Security`
   - Collapse rail toggle (`<<`) to maximize workspace width.

2. **Top Unified Header Bar:**
   - Interactive **Breadcrumb Path** on the left (e.g., `Documents > All > 4 Financial Documents > 4.3 Financial Statements`) with smart middle-truncation for deep paths and clickable ancestor navigation.
   - Global utilities on the right:
     - **Drive Sync Indicator Pill** (shows synced state + quick refresh)
     - **Light / Dark Appearance Toggle**
     - **Help / Support Drawer**
     - **User Profile Menu** (shows user name, role, group, security settings, and sign out)

---

### Detailed Feature Specifications

#### 1. Documents Workspace (`/documents`)
- **Action & Search Toolbar:**
  - **Sync / Refresh from Drive** (for Admins) and optional **Open in Drive** shortcut (Admins only).
  - **Download** (downloads current selection or folder as `.zip`, subject to group download permissions).
  - **Project Index** dropdown: `Export Full Index (XLSX / CSV / PDF)`, `Export Custom Index`, `Rebuild Index`.
  - **View As** selector (Admins only): Instantly preview the Data Room as any participant group (e.g., `Investor Group`, `Advisors`, `Legal Reviewers`) to verify hidden folders, watermarks, and download restrictions.
  - **Search Bar + Filter Popover:** Instant search across document titles, folder names, notes, and Drive full-text search; filter popover with `Added / Modified Date`, `Viewed by`, `File type` (PDF, Spreadsheet, Document, Presentation, Image, Folder), `Favorites only`, `Has Notes`, and `Search scope` (`Current folder` vs `Entire Data Room`), plus `Clear all`.
- **Collapsible Quick Access & Folder Tree Panel:**
  - **Quick Access** filters: `Recently viewed`, `Newly uploaded / synced`, `Favorites`.
  - **Folder Tree** (`Collapse all` / expand chevrons): Smooth nested tree displaying dot-index + folder icon + title for every mirrored Google Drive folder. Clicking a chevron expands in-place; clicking a folder navigates the main table and updates breadcrumbs.
- **Finder-Style Documents Table:**
  - Inside nested folders, display a clean `Back to <Parent Folder>` row at the top.
  - **Default Columns:**
    - Selection checkbox (header select-all)
    - `Index` (tabular monospace/sans decimal index)
    - `Name` (crisp file-type SF-style icon + title + optional `New` / `Favorite` star indicator)
    - `Size` (shows `X subfolders / Y files` for folders, and `MB/KB` + `N pages` for files)
    - `Added on` (formatted date, synced from Drive)
    - `Notes` (compact numeric pill badge when notes exist; clicking opens the Notes drawer)
  - **Customize Columns Menu:** `Folders first` toggle (ON by default), drag-to-reorder columns, locked `Index` & `Name`, and toggleable optional columns: `Viewed on`, `Permission`, `Drive ID`, `File Type`.
  - **Selection & Context Menus:**
    - Selecting rows activates a floating/toolbar `Selected: N` bar with `Download`, `Add to Favorites`, `Copy Link`, and `Clear Selection`.
    - Row hover actions (`View`, `Download`, `...` menu) and right-click context menu (`View`, `Download`, `Print`, `Copy Link`, `Share`, `Add Note`, `Add to Favorites`, `View Activity Report`).

#### 2. Secure Built-In Document Viewer (`Kleen Viewer`)
Clicking any document opens a dedicated, distraction-free Apple Preview-style viewer (modal or dedicated viewer tab) streamed securely through the backend from Google Drive:
- **Dynamic Security Overlay:**
  - **Tiled Diagonal Watermark** (configurable per group/room): Renders `Kleen Data Room`, viewer's `email`, viewer's `full name`, and `live timestamp` across pages.
  - **Fence View Mode:** When enabled by permissions, displays a darkened privacy mask with a movable horizontal reading slit that follows the cursor/scroll to deter full-page screen capture.
- **Top Viewer Bar:**
  - `Open containing folder`, file type icon + document switcher dropdown, `Fence View` toggle, `Download` (if permitted), `Print` (if permitted, stamped with watermark), `Notes` panel toggle, `Light/Dark` viewer canvas toggle, and `Close`.
- **Collapsible Left Inspector Panel (4 Tabs):**
  1. `Outline` (PDF table of contents / bookmarks).
  2. `Thumbnails` (clickable visual page previews).
  3. `Links` (extracted hyperlinks / references inside the document).
  4. `Notes` (search & filter notes, `+ Add note` with private/shared visibility toggle, author, and timestamp).
- **In-Document Search:** Top-right search trigger supporting `Exact phrase`, `Case sensitive`, match counter, and jump-to-highlight.
- **Bottom Floating Frosted Glass Pill:**
  - `Customize` (auto-hide toolbar option), `Zoom Out`, `Zoom In`, zoom percentage selector (`Fit width`, `Fit page`, `50%`–`200%`), `Single / Continuous scroll` toggle, `Rotate`, and a floating `Page X / Y` indicator with direct page jump.

#### 3. Access Control, Participants & Permissions Matrix
- **Participants (`/participants`):**
  - Invite users via email, organize them into **Groups** (e.g., `Administrators`, `Investor Group`, `Legal Counsel`, `Auditors`), assign `Role` (`Administrator`, `Participant / Viewer`, `Collaborator`), toggle `Project access` (`Enabled` / `Disabled`), and track `Last sign-in`.
  - Optional **Terms of Access / NDA Gate**: Require first-time participants to accept customizable confidentiality terms before entering the Data Room.
- **Granular Permissions Matrix (`/permissions`):**
  - Dual views: **By Groups** and **By Documents** (mapped to Drive folder/file IDs with inheritance from parent folders and explicit per-item overrides).
  - Granular permission levels per folder/file:
    - `None / Hidden` (folder/file is completely invisible to that group, and excluded from their search & index exports)
    - `Fence` (view only behind Fence View)
    - `View` (on-screen watermarked view only, no download/print)
    - `Download PDF` (watermarked PDF export)
    - `Download Original` (native file download from Drive)
    - `Manage` (edit notes/Q&A/metadata)
  - Batch **Set permissions by file type** and full **Permissions Log**.

#### 4. Analytics Dashboard & Audit Reports
- **Dashboard (`/dashboard`):**
  - Tabs: `Activity`, `Documents`, and `Groups Overview`, with `Export` button.
  - KPI Cards: `Room age`, `Total sign-ins`, `Signed-in participants` (`X of Y / %`), `Accessed files` (`X of Y / %`).
  - Visual Charts (clean Apple-style minimal charts): Participant engagement funnel (`Invited`, `Signed in`, `Engaged`, `Inactive`), `Group engagement` (`File actions`, `Viewing time`, `Daily trend`), and per-group breakdown table.
- **Reports (`/reports`):**
  - **Activity Log:** Real-time audit trail recording sign-ins, folder opens, document views (with exact **viewing duration in seconds/minutes**), downloads, prints, note additions, and Drive sync events; filterable by `Action`, `Author/User`, and `Date range`, with `CSV/XLSX Export`.
  - **Documents Overview & Engagement Matrix:** Heatmap/matrix showing which participant groups viewed which documents and for how long.

#### 5. Q&A, Notes & Due Diligence Checklist
- **Q&A Module (`/qna`):** Structured investor Q&A workflow where participants submit questions linked directly to a specific mirrored document or folder, with `Category`, `Priority`, `Status` (`Open`, `In Review`, `Answered`, `Closed`), internal vs external visibility, and exportable Q&A log.
- **Due Diligence Checklist (`/checklist`):** Importable/manageable checklist items (e.g., Legal, Financial, Tax, HR) that can be linked directly to mirrored Google Drive folders/files to show deal readiness percentage.
- **Centralized Notes (`/documents/notes`):** Unified view of all annotations across documents (filtered by user permissions).

#### 6. Settings & Google Drive Connection (`/settings`)
- **Google Drive Sync Settings:**
  - Connect/authenticate Google Drive account or Service Account.
  - Select or paste the **Target Google Drive Folder URL / ID**.
  - Configure sync mode (`Auto-sync via Drive Webhooks + 5-min fallback` or `Manual Sync`), file exclusion rules (e.g., ignore `.DS_Store` or `~$` temp files), and inspect sync diagnostics/errors.
- **Branding, Watermarks & Security:**
  - Upload custom brand logo (`Kleen`), customize room title/colors, configure watermark text/opacity/angle, enforce 2FA/session timeout/IP rules, and toggle offline archive export.

---

### Suggested Technical Architecture

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS + Framer Motion (subtle Apple-grade transitions) + Lucide / SF-style iconography + PDF.js / custom canvas renderer for secure watermarked & fenced document viewing.
- **Backend & Auth:** Next.js API Routes / Server Actions (or dedicated Node/TypeScript API) with NextAuth / Auth.js (Email magic link + OAuth + optional 2FA) and role-based middleware that never exposes raw Google Drive public URLs to unauthorized viewers (all file bytes & previews stream through authenticated server endpoints that enforce group permissions and watermarks).
- **Database:** PostgreSQL (via Prisma or Drizzle ORM) storing:
  - Mirrored Drive tree cache (`drive_nodes`: `driveFileId`, `parentId`, `name`, `mimeType`, `size`, `pageCount`, `dotIndex`, `driveModifiedAt`, `isFolder`, `syncStatus`)
  - `groups`, `users`, `group_memberships`, `permissions`
  - `notes`, `favorites`, `qna_threads`, `checklist_items`, `activity_logs`, `room_settings`
- **Google Drive Integration:** `googleapis` (Drive v3) using incremental `changes.list` page tokens for fast delta syncs + full recursive reconciliation job, plus server-side PDF conversion/streaming for Google Docs/Sheets/Slides.

---

### Deliverables & Quality Bar
1. Clean, modular codebase with strict TypeScript types and zero exposed Google Drive credentials on the client.
2. Responsive, pixel-polished Apple-inspired UI in both **Light** and **Dark** modes with smooth RTL/LTR mixed-text rendering.
3. End-to-end working **Google Drive Folder Mirror** (syncing folder hierarchy, file list, sizes, dates, and live document streaming into the Data Room UI).
4. Functional secure `Kleen Viewer` with live dynamic watermark, zoom/page controls, thumbnails, in-doc search, and notes.
5. Role-based permissions (`View as` preview, group matrix) and real-time `Activity Log` / `Dashboard` tracking.
