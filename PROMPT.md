# Kleen Data Room — Exhaustive Product, UI & Interaction Specification Prompt

> **Purpose:** Complete engineering and UI/UX specification prompt to build **Kleen Data Room** — an Apple-inspired Virtual Data Room (VDR) replicating the full feature set and button-by-button interactions of iDeals VDR, powered by a live **Google Drive Folder Mirroring Engine** as its single source of truth for folders, subfolders, files, and contents.

---

## 1. Core Concept & Architectural Differentiator (Google Drive Mirroring)

Build a full-stack Virtual Data Room web application named **Kleen Data Room**.

### 1.1 Google Drive Single-Source-of-Truth Mirroring
Instead of maintaining an isolated, manually uploaded file repository, **Kleen Data Room** connects directly to a designated **Google Drive Root Folder** (`GOOGLE_DRIVE_ROOT_FOLDER_ID`) via **Google Drive API v3** (OAuth 2.0 / Service Account):
- **Exact Structural & Content Reflection:** Recursively mirrors the exact folder hierarchy, nested subfolders, filenames, MIME types, file sizes, page counts (computed on sync for PDFs/docs), and modification timestamps from the target Google Drive folder, displaying them inside the Data Room interface identically to an enterprise VDR.
- **Google Workspace & Multi-Format Streaming:** Automatically renders PDFs, Office files (`.docx`, `.xlsx`, `.pptx`), Google Docs/Sheets/Slides (exported via Drive API to PDF/viewer-ready streams), images, and media through authenticated backend proxy endpoints—never exposing raw Google Drive sharing URLs to participants.
- **Fast Metadata Cache + Incremental Sync:** Stores mirrored node metadata (`driveFileId`, `parentDriveId`, `name`, `mimeType`, `sizeBytes`, `pageCount`, `dotIndex`, `driveModifiedAt`, `isFolder`) in PostgreSQL, kept up to date via `Drive Changes API` webhooks/scheduled polling plus an explicit **`Sync with Drive`** button. All VDR metadata (`permissions`, `notes`, `favorites`, `viewCounts`, `activityLogs`, `labels`) binds stably to `driveFileId` so Drive updates never break permissions or audit history.
- **Hierarchical Dot-Indexing (`Automatic indexing`):** Parses existing numeric prefixes in Drive names (e.g., `1 ...`, `4.3 ...`, `4.3.5.6 ...`) or auto-assigns clean dot-delimited decimal indices (`1`, `1.1`, `1.1.1`, `2`, …) matching the Drive tree.
- **Configurable Sync Mode (in `Settings > Google Drive Sync`):**
  - *Mirror Read-Only Mode (Default):* Google Drive is the master editor; Drive changes flow one-way into Kleen Data Room, and destructive file mutations (`Upload`, `Create folder`, `Rename`, `Move`, `Delete`) are hidden or clearly marked as Drive-managed.
  - *Two-Way Admin Sync Mode (Optional):* Admin file/folder actions (`Create folder`, `Upload`, `Rename`, `Move`, `Delete`) execute directly against the linked Google Drive folder via Drive API v3 and immediately reflect in the Data Room.

---

## 2. Visual Design Language (Apple Software Aesthetic — macOS / Apple HIG)

Apply a cohesive **Apple-native design system** inspired by **macOS Finder**, **Preview**, and **iCloud Drive**:
- **Adaptive Light & Dark Appearances (instant toggle):**
  - *Light Mode:* Crisp `#FFFFFF` primary canvas, `#F5F5F7` secondary surfaces, translucent frosted-glass navigation rails and popovers (`backdrop-filter: blur(20px) saturate(180%)`), subtle `1px` hairline dividers (`rgba(0, 0, 0, 0.08)`), soft ambient elevation shadows, and Apple System Blue (`#007AFF`) primary actions.
  - *Dark Mode:* Deep `#141416` / `#1C1C1E` base surfaces, `#2C2C2E` elevated cards/modals, dark translucent vibrancy sidebars, `rgba(255, 255, 255, 0.1)` hairlines, and `#0A84FF` accents.
- **Typography & Micro-Interactions:**
  - `SF Pro Display / Inter` paired with `IBM Plex Sans Arabic / Cairo` for seamless bilingual rendering (`dir="auto"` on filenames/folders supporting mixed Arabic & English such as `1 الملف الاستثماري` and `4.3.5.6 2025 _ الاقرار الزكوى.pdf`).
  - `font-variant-numeric: tabular-nums` across all indices, file sizes, page counts, timestamps, and analytics tables.
  - Spring-eased transitions, crisp macOS-style SF icons, compact pill badges, and keyboard navigation.

---

## 3. Global Shell, Left Navigation Rail & Top Header Controls

Implement a responsive three-pane shell:

### 3.1 Left Navigation Rail (Collapsible via `<< Left panel toggle`)
- **Top Room Switcher (`Kleen Data Room v`):**
  - Displays the custom **Kleen** logo + active room name (`Kleen_2025` / `Kleen Data Room`).
  - Clicking opens a popover containing:
    - **`Search for project`** live filter input.
    - Active room item (`Kleen_2025`).
    - **`All projects`** link -> opens `/projects/all` with **`+ Create new project`** button, **Grid / List view toggle**, `Search for project` input, and project cards showing `Last session` timestamp + **Favorite star toggle**.
    - **`Create new project`** link -> opens `/projects/all/create` form (`Subscription details`: Account name, Storage tier `Up to 2 GB` / `2–250 GB` / `Over 250 GB`, Service term, Single/Multiple projects; `Details`: Name, Transaction Type grouped selector, Storage/Sync region, Administrators email chips; `Cancel` / `Create` with unsaved-changes confirmation modal `Leave without saving` -> `Back` / `Leave`).
- **Primary Navigation Sections:**
  1. **`Dashboard`** (`/dashboard`)
  2. **`Documents`** (`/documents`, expandable submenu): **`All`**, **`Notes`**, **`External links`**, **`Signatures`**
  3. **`Due diligence checklist`** (`/due-diligence-checklist`)
  4. **`Participants`** (`/participants`)
  5. **`Permissions`** (`/permissions/documents`)
  6. **`Q&A`** (`/qna`)
  7. **`Reports`** (`/reports`, expandable submenu): **`Activity log`**, **`Documents overview`**, **`Engagement matrix`**, **`Data storage`**, **`Permissions log`**, **`Subscriptions`**
  8. **`Settings`** (`/settings`, expandable into two groups):
     - **`Personal`**: **`Notifications`**
     - **`Project`**: **`General`**, **`Branding`**, **`Documents`**, **`Labels`**, **`Terms of access`**, **`Watermarks`**, **`Security`**, **`AI tools`**, **`Integrations`** (plus **`Google Drive Sync`**)
  9. **`Project archiving`** (`/archiving`)
  10. **`Recycle bin`** (`/recycle-bin`)

### 3.2 Top Header Bar (Breadcrumb & Global Utility Controls)
- **Left Side:** Interactive **Breadcrumb Trail** (e.g., `Documents > All > 4 Financial Documents > 4.3 Financial Statements`) with smart middle-truncation on deep nesting; clicking any segment navigates straight to that level.
- **Right Side Utility Buttons (each with exact behavior):**
  1. **Drive Sync Status Pill** (Kleen-specific): Displays `Synced • Xm ago`; clicking triggers an immediate delta sync via Google Drive API and shows sync progress/diagnostics.
  2. **Theme Toggle (`Light mode` / `Dark mode` icon):** Switches instantly between Light and Dark Apple themes and persists preference.
  3. **Help (`?` icon):** Opens the **Help Center Modal** containing:
     - Search input, **`Recommendations`** and **`Troubleshooting`** tabs, **`Status page`** link, **`Popular topics`**, **`Featured videos`**, copyable **`Project ID`**, and **`Ways to contact our support team`** (Live chat, support email, phone).
  4. **Download / Mobile & Desktop Access (device icon):** Opens modal offering Desktop Sync / Bulk App download links (`Windows / macOS`) and Mobile links (`iOS App Store / Google Play`).
  5. **User Profile Avatar (`AB`):** Opens dropdown showing Full Name, Role/Group, and 3 links:
     - **`Personal information`** (`/account/personal-information`): Read-only `Email`, editable `First name`, `Last name`, `Company`, `Job title (optional)`, `Phone number (optional)` with country-code selector, `Language` selector (EN/AR + multi-language), and `Time zone` (`Set time zone automatically` checkbox + zone dropdown).
     - **`Security settings`** (`/account/security`): `Password` (`Change` trigger + last-changed date), `2-step verification` toggle, active **`Sessions`** list (OS/browser, `Current session` badge, city/country, date, revoke option), connected **`Integrations`**, and **`Delete account`** button (with confirmation).
     - **`Archives`** (`/account/archives` in account sidebar): Lists downloadable/ordered offline archives + `+ Create offline backup`.
     - **`Sign out`**: Ends session and returns to branded login page.

---

## 4. Section-by-Section Functional & Button Specifications

### 4.1 `Dashboard` (`/dashboard`)
Two sub-tabs at the top: **`Activity`** and **`Documents`**.

#### A. `Dashboard > Activity` (`/dashboard/activity`)
- **Top Right Controls:**
  - **`Groups` filter dropdown (`N groups v`):** Search box + `All groups` toggle + collapsible checkboxes for `Administrator groups`, `User groups`, and `Deleted groups`. Dynamically updates all charts and table data.
  - **`Export` button -> `/dashboard/activity/export`:**
    - Left config panel: **File format** radio (`Presentation (PPTX)` | `PDF`), **Groups to include** selector (`Top 6 groups; remaining aggregated as 'Other'`), **Rank groups by** radio (`Total sign-ins` | `Views, downloads, and prints` | `Last sign-in`), **Included metrics** summary, optional **Logo** upload (`Add image`: PNG/JPG/SVG up to 1 MB appearing on every slide).
    - Right panel: **Live 2-Slide Visual Preview** (*Activity by groups* & *Engagement by groups*).
    - Footer: **`Cancel`** (returns without export) / **`Export`** (generates and downloads PPTX/PDF).
  - **`Subscribe` button -> `/dashboard/activity/subscribe`:**
    - Includes all `Export` configuration options plus **`Name`** input, **`Frequency of report delivery`** (`Daily` | `Weekly` | `Monthly` | `Custom`), and **`Start sending`** date & time inputs. **`Cancel`** / **`Subscribe`**.
- **KPI & Visualization Cards:**
  - **Context Line:** `Since project creation | Created on <date> | <relative age>`.
  - **3 KPI Cards:** `Total sign-ins`, `Signed-in participants` (`X of Y (%)` with `?` tooltip), `Accessed files` (`X of Y (%)`).
  - **Card 1 — `Participants` Funnel Bar:** Segmented horizontal bar & legend counts (`Invited`, `Signed in`, `Engaged`, `Deactivated`, `Deleted`), **`↗` external button** (opens `/participants` in a new tab), and **`How is this calculated?`** popover.
  - **Card 2 — `Unique files accessed` Chart:** Grouped vertical bars per group (`Accessed` vs `Not accessed`, `%` + `X/Y`) with dashed total-files threshold line, **`↗` button**, and **`How is this calculated?`** popover.
  - **Card 3 — `Group engagement by` Chart:**
    - Metric segmented buttons: **`File actions`** (stacked `Views`, `Downloads`, `Prints`), **`Signed in`** (`Selected period` vs `Since creation`), **`Viewing time`** (duration per group).
    - **`Daily trend`** toggle button: Switches chart to a time-series daily trend line/bar graph.
    - **`All time v`** date-range filter: Calendar grid + `Past week` / `Past month` quick presets.
    - **`↗` button** + **`How is this calculated?`** popover.
- **Group Engagement Table:**
  - Columns: `Group`, `Signed in`, `Sign-ins`, `Last sign-in`, `Viewing time`, `Accessed / permitted files` (percentage + progress bar).
  - **`Customize columns` icon button:** Popover with checkboxes to show/hide each of the 6 columns.
  - **Inline Row Expansion (`>` chevron):** Clicking a group row expands all individual members inside that group showing status pill (`Engaged`, `Signed in`, `Invited`), `Sign-ins`, `Last sign-in`, `Viewing time`, and `Accessed / permitted files`.

#### B. `Dashboard > Documents` (`/dashboard/documents`)
- **Top Filter:** **`All folders v`** dropdown with `Search` input and expandable mirrored Drive folder tree to scope all cards/charts/table to a specific folder.
- **4 Clickable Status Cards** (clicking any card opens a **Right Slide-Over Drawer** with tabbed item lists and direct document links):
  1. **`Permissions`**: `X files Not assigned` | `Y files Not accessed` (drawer tabs: `Not assigned` / `Not accessed`).
  2. **`Clean up`**: `X folders Empty` | `Y files Duplicated` (drawer tabs: `Empty` / `Duplicated` detecting duplicate filenames/hashes across the mirrored Drive tree).
  3. **`Redaction`**: `X files Drafted` | `Y files Redacted`.
  4. **`Signatures`**: `X files Signed` | `Y files Pending`.
- **`Overview` Card:** Total `Project index` (`X folders | Y files`) and `Recycle bin` (`A folders | B files`).
- **`Summary` Donut Chart Card:** Total storage (e.g., `491.95 MB Total`) broken down by category (`PDF`, `Documents`, `Spreadsheets`, `Images`, `Presentations`, `Other`). Clicking any chart segment opens a right drawer listing all files of that type with size, page count, and last activity.
- **Documents Activity Table:**
  - Mode dropdown: **`By folders`** vs **`By files`**.
  - **`Customize columns` popover:** **`Include subitems`** toggle + checkboxes (`Index`, `Name`, `Folders`, `Files`, `Size`, `Actions`, `Last activity`).

---

### 4.2 `Documents` (`/documents`) — All Sub-Tabs, Quick Access & Action Menus

#### Left Sidebar Panel (inside Documents)
- **Collapsible `Quick access` (`Collapse quick filters` toggle):**
  - **`Recently viewed` (`/documents/recent`):** Groups items chronologically (`Today`, `Last 7 days`), adds a clickable **`Location`** column showing parent index + folder name.
  - **`Newly uploaded` (`/documents/uploads`):** Lists recently synced/added Drive files (with clear empty state when none).
  - **`Favorites` (`/documents/favorites`):** Lists starred folders/files (toggled via `S` shortcut or context menu).
- **Collapsible Mirrored Drive Folder Tree (`Collapse all` button):**
  - Root node (`Kleen_2025` / Drive Root Folder) + all nested subfolders with expand/collapse chevrons (`>`), dot-indices, and folder icons. Expanding chevrons reveals subfolders without changing the current table; clicking a folder name navigates into it, updates the breadcrumb, and prepends a **`Back to <Parent Folder>`** row at the top of the table.

#### Left Rail Sub-Tabs under `Documents`
1. **`All` (`/documents/all`):** Main workspace described below.
2. **`Notes` (`/documents/notes`):**
   - Toolbar: **`Export`** button, **`Search`** box, **`Filter`** popover (`Note type`, `Updated by`, `Clear all`), **`Customize columns`** (`Index`, `Name`, `Note`, `Note type`, `Replies`, `Location`, `Updated by`, `Created on`, `Updated on`, `Document ID`).
   - Table: Displays every annotation across accessible documents with note privacy badge (`Private` / `Shared`), author avatar, clickable document `Location`, and timestamps.
3. **`External links` (`/documents/shared-links`):**
   - Manage controlled external share links (columns: `Index`, `Name`, `Access type`, `Notifications`, `Visits`, `Feedback`, `Created on`, `Status` on/off switch, `Customize columns`). Clicking a link opens link analytics & expiration/passcode settings.
4. **`Signatures` (`/documents/signatures`):**
   - Tracks e-signature requests (`Name`, `Status`, `Signers`, `Created on`), with a 3-step onboarding empty state (`1 Go to all documents` CTA button, `2 Select signers`, `3 Monitor progress`).

#### `Documents > All` Toolbar Buttons & Click Behaviors
1. **`Sync with Drive` (or `+ Add` dropdown in Two-Way Mode):**
   - In *Read-Only Mirror Mode*: Primary **`Sync with Drive`** button pulls latest Drive Changes and refreshes the tree/table.
   - In *Two-Way Admin Sync Mode*, **`+ Add`** opens a dropdown with:
     - **`Create folder (Shift + F)`**: Inserts an inline `Enter folder name` input row at the top of the table (Enter creates folder in Google Drive & mirrors; Escape cancels).
     - **`Create folder structure`**: Navigates to a **3-step wizard** (`/documents/create-folder-structure`: `1 Upload file` XLSX/CSV -> `2 Check detected structure` -> `3 Preview your structure`) to batch-create folders inside the Google Drive root.
     - **`Upload from computer >`**: Submenu (`Files` / `Folder`) uploading directly to the corresponding Google Drive folder.
     - **`Connect / Import from Google Drive`**: Opens the Drive Folder Linker / Sync diagnostics drawer.
2. **`Download` button:** Downloads selected files/folders (or current folder) as individual files or a structured `.zip`, subject to group download permissions (`Original`, `PDF` with watermark, or `Encrypted`—or disabled with tooltip if group has `View`/`Fence` only).
3. **`Project index` dropdown:**
   - *Export*:
     - **`Full project index`**: Immediately exports the complete hierarchical index (XLSX/CSV/PDF) reflecting all visible items for the user's permission level.
     - **`Custom project index`**: Opens modal with **`Contents`** radio (`Files and folders` | `Only files` | `Only folders`), **`Recycle bin`** toggle, **`Documents uploaded from`** toggle + date picker, **`Cancel`** / **`Export`**.
   - *Manage*:
     - **`Rebuild index`**: Opens warning modal (*"Rebuilding index will cause complete and non-reversible renumbering of all contents of this folder. Would you like to proceed?"*, **`Cancel`** / **`Confirm`**).
     - **`Bulk rename`**: Pattern-based batch renaming across selected items (synced to Drive if Two-Way mode enabled).
4. **Toolbar `...` (`Documents more menu`):**
   - Displays contextual actions for the current folder or selection: `Open in new browser tab`, `Copy link`, `Share`, `View reports`, `Add to favorites (S)`, `Copy (Ctrl+C)`, `Move (Ctrl+X)`, `Rename (N)`, `Delete (Delete)`.
5. **`View as` button:**
   - Opens modal listing all participant groups with `Search`, expandable member lists, info notice, `Cancel`, and **`View`**.
   - Selecting a group enters **Live Preview Mode**: shows a prominent top Apple-blue banner `"Viewing documents as <Group Name>"` with an **`X` Exit** button; restricts sidebar tabs, hides hidden folders/files, hides admin note counts, and enforces that group's download/watermark/fence rules so admins can verify exact investor experience.
6. **`Search` Bar & Filter Popover (filter sliders icon):**
   - Live search input + Filter popover containing:
     - **`Added on`**: Calendar date picker + `Today`, `Yesterday`, `Past week` presets.
     - **`Viewed by`**: Checkboxes `Viewed by me`, `Not viewed by me`, `Viewed by my group`, `Not viewed by my group`.
     - **`File type`**: Searchable hierarchical checkboxes for `Folders` and `Files` grouped by `Spreadsheets` (`XLS`, `XLSX`, `XLSM`, `CSV`), `Documents` (`PDF`, `DOC`, `DOCX`, `TXT`, `RTF`), `Images` (`JPG`, `PNG`, `SVG`, etc.), `Presentations` (`PPT`, `PPTX`), `Video` (`MP4`, `MOV`, etc.), `Web files` (`HTML`, `XML`), `Emails` (`EML`, `MSG`), and `Additional formats` (`DWG`, `Other`).
     - **`Redaction`**: Filter by redaction state (`All`, `Drafted`, `Redacted`).
     - **`Search area`**: `Titles`, `Documents' content`, `Titles and documents' content`.
     - **`Clear all`** button.
7. **`Customize columns` button (far right of table header):**
   - **`Folders first`** toggle (ON by default).
   - Drag-to-reorder handles + checkboxes:
     - *Locked/Default*: `Index`, `Name`
     - *Default Visible*: `Size` (shows `X subfolders / Y files` for folders; `KB/MB` + `N pages` for files), `Added on`, `Notes` (clickable pill badge showing count; clicking opens the Notes drawer)
     - *Optional Toggleable*: `Viewed on`, `Permission`, `ID` (Drive file ID), `Redaction`.
8. **Multi-Select Bulk Bar & Row Context (`...` / Right-Click) Menus:**
   - Selecting row checkboxes displays `Selected: N` in the toolbar with `Download`, `Add to Favorites`, `Copy Link`, and `...` bulk actions.
   - **Folder Row Context Menu:** `Download >` (`Encrypted`, `PDF`, `Original`), `Open in new browser tab`, `Copy link`, `Share >` (`Manage permissions`, `Send notifications`), `View reports >` (`Activity log`, `Documents overview`, `Engagement matrix`, `Permissions log`), `Add >` (`Label`, `Note`, `To favorites · S`), and (if Two-Way Sync enabled) `Copy · Ctrl+C`, `Move · Ctrl+X`, `Rename · N`, `Delete · Delete`.
   - **File Row Context Menu:** Same as folder plus **`View`**, **`Print`**, **`Edit >`** (`Redact`, `Upload new version`), **`Copy link >`** (`Internal access` | `External sharing`), and **`Share >`** includes `Request signature` and `Create external link`.

---

### 4.3 Secure Document Viewer (`Kleen Viewer`)
Clicking any file (or `View`) opens a dedicated distraction-free viewer (in a new tab or full-viewport Apple Preview-style modal) streaming the file from the backend:
- **Dynamic Watermark Overlay:** Renders tiled diagonal/grid/corner watermarks per `Settings > Watermarks` (`Project name`, `Viewer Email`, `Full Name`, `Live Timestamp`, custom text, opacity, color).
- **Top Viewer Bar:**
  - **`Open containing folder`** icon (navigates back to the parent folder in `Documents`).
  - File icon + **Document switcher dropdown** (shows file title & lets you switch sibling files in the folder).
  - **`Fence View` toggle:** Enables a horizontal privacy slit overlay over a darkened mask that tracks pointer/scroll to block full-screen capture.
  - **`Download` button** (respects group permission: PDF watermarked vs Original vs disabled).
  - **`Print` button** (prints with watermark when permitted).
  - **`Notes` toggle** (opens/focuses the Notes tab in the left panel).
  - **`Redact` button** (admin/permitted redaction tool to draw & save black redaction boxes onto PDF copies).
  - **`Light / Dark mode` toggle**.
- **Collapsible Left Inspector Panel (4 Icon Tabs):**
  1. **`Outline`**: PDF bookmarks / table of contents tree (disabled gracefully if absent).
  2. **`Thumbnails`**: Scrollable clickable thumbnails (`1`..`N`) for rapid page jumping.
  3. **`Links`**: Extracted clickable URLs & internal page links found in the document.
  4. **`Notes`**: Search notes input, filter icon, **`+ Add note`** button (creates note with text + `Private` / `Shared` visibility toggle), and list of existing notes with author avatar, date, privacy icon, and replies.
- **In-Document Search (Top-Right Magnifying Glass):** Opens floating search bar with **`Exact phrase`** and **`Case sensitive`** toggles, match count, next/prev navigation, and highlighted results.
- **Bottom Floating Glass Control Pill:**
  - **`Customize` (gear icon):** Auto-hide behavior (`Hide when not required`).
  - **`Zoom out (-)`**, **`Zoom in (+)`**, **Zoom percentage dropdown** (`50%`–`200%`), **`Fit to width`**, **`Fit to page`**, **Page layout toggles** (single page vs continuous scroll), and **`Rotate pages`**.
  - **Bottom-Right Page Indicator (`1 / N`):** Clickable input to jump directly to any page.

---

### 4.4 `Due diligence checklist` (`/due-diligence-checklist`)
- **Empty State:** Centered card with **`+ Choose file`** button triggering file upload (XLSX/CSV) to import a structured checklist.
- **Populated State:** Interactive checklist table (`#`, `Category`, `Item`, `Priority`, `Status`, `Assigned Group`, `Linked Drive Documents`) allowing admins to link checklist rows directly to mirrored Google Drive folders/files and track completion percentage.

---

### 4.5 `Participants` (`/participants`)
- **Top Toolbar Buttons:**
  1. **`Add participants` -> 2-Step Wizard (`/participants/add`):**
     - *Step 1 (`1 General`)*: Multi-email chip input (`comma/space/enter` separated) + **`Specify full names of participants`** toggle (switches to per-row `Email` + `Full name` + `+ Add another participant`); **`Group`** searchable picker (`Administrator groups`, `User groups`, plus inline **`+ Create group`**); **`Invitation language`** selector (16 languages including `English`, `العربية`); **`Document notifications`** toggle; **`Cancel`** / **`Next`**.
     - *Step 2 (`2 Project access`)*: Set access start/end dates, 2FA requirement, and send invitations.
  2. **`Create group` -> 3- or 4-Step Wizard (`/participants/create-group`):**
     - Group `Name` input + **Role radio cards**:
       - **`Administrator`** (`Full management` — 3 steps: `Feature permissions`, `Project access`, `Participants`).
       - **`User`** (`Limited access` — 4 steps: `Feature permissions`, `Document permissions`, `Project access`, `Participants`).
       - **`Custom`** (`Limited management` — 4 steps, adds `Available groups` multi-select dropdown).
     - Granular feature toggles grouped under `Project management` (`Settings & archiving`, `Recycle bin`, `Q&A setup`, `Checklist`), `Documents` (`View/manage`, `Permissions`, `AI search`), `Participants` (`Create/manage users`), `Reports` (`View activity`), and `Integrations` (per-tool AI switches).
     - **`Cancel`** (shows `Leave without saving` confirmation if edited) / **`Next`**.
  3. **`Import` -> 3-Step Bulk Wizard (`/participants/add-bulk`):**
     - `1 Get template` (**`Get template`** download button) -> `2 Fill out template` -> `3 Import file` (drag-and-drop or **`Choose file`**).
  4. **`Export`:** Immediately exports the participants & groups spreadsheet.
  5. **`View reports` dropdown:** Links to `Activity log`, `Documents overview`, `Engagement matrix`, `Permissions log`.
  6. **`Search` + Filter popover:** Filter by `Role` (`Administrator`, `User`, `Custom`), `Project access` (`Enabled`, `From`, `Till`, `Deactivated`, `Expired`), `Last sign-in` (calendar + presets), and `Clear all`.
- **Participants Table & Inline Controls:**
  - Header: Select-all checkbox, **`Expand all`** toggle (expands all groups to reveal member rows), sortable columns (`Group`, `Role`, `Project access`, `Last sign-in`, `Users`), and **`Customize columns`** (adds optional `2FA required`, `Document notifications`).
  - **Bulk Selection Bar (`Selected: N`):** `Delete`, `Deactivate`, `Export`, `...` menu.
  - **Group Row `...` Menu:** `Add participants`, `Open permissions and settings`, `View reports >`, `Resend invitation`, `Send document updates >` (`Never`, `Every 30 minutes`, `Hourly`, `Daily in the morning`, `Daily in the afternoon`), `Move to group`, `Deactivate`, `Delete` (admin group omits `Deactivate`/`Delete`).
  - **Clicking a Group -> Group Detail Page (`/participants/group/<id>`):**
    - 4 tabs: **`Feature permissions`**, **`Document permissions`** (includes **`Copy from another group`** modal to clone permissions from any existing group), **`Project access`** (`Start/End date`, `2-step verification`, `Allowed IP addresses`), and **`Participants`** (`+ Add participants`).
  - **Clicking a User -> User Detail Page (`/participants/user/<id>`):**
    - Status pill, company, added-by metadata, last sign-in, and 2 tabs: **`General`** (`Group`, `Document notifications` toggle) and **`Project access`** (`Access period` dates, `2-step verification` toggle, `Allowed IP addresses` toggle).

---

### 4.6 `Permissions` (`/permissions/documents`)
- **Synchronized Dual Views (left-pane switcher):**
  - **`Groups` view (`/permissions/documents/by-groups`):** Left pane selects a Group; right pane renders the mirrored Google Drive folder/file tree with permission bars.
  - **`By documents` view (`/permissions/documents/by-documents`):** Left pane selects a Drive Folder/File; right pane lists `All groups` + each user group (expandable to preview members) with its permission bar.
- **Top Toolbar Buttons:**
  1. **`Set permissions by file type`:** Modal with banner (*"Applies to current files only"*), **`File types`** multi-select (same 8 format categories), **`Permission`** selector (`No access`, `Fence`, `View`, `Encrypted`, `PDF`, `Original`, `Manage`), checkbox **`Apply also to files that currently have no access`**, **`Groups`** multi-select, `Cancel` / `Apply`.
  2. **`Export`:** Generates and downloads the full permissions matrix report.
  3. **`View as`:** Opens the group preview modal (same as in `Documents`).
  4. **`Permissions log`:** Opens `/reports/permissions` in a new tab.
- **7-Level Segmented Permission Bar (Direct Single-Click Control):**
  - Hovering any row reveals a red **`X` (`No access`)** button followed by 7 cumulative clickable segments: **`Fence` | `View` | `Encrypted` | `PDF` | `Original` | `Upload` | `Manage`**.
  - Clicking any segment sets that ceiling and highlights all lower cumulative tiers in blue (`Upload` is disabled/striped on individual file rows; mixed permissions across groups on `All groups` display neutral/unfilled bars).
  - Row `...` menus offer `Open group settings` / `Open in documents` and quick links to all 4 reports.

---

### 4.7 `Q&A` (`/qna`)
- **Onboarding Setup State (`/qna/setup`):** Displays `Welcome to Q&A` onboarding card (*Structured communication*, *Faster responses*, *Secure access*) with **`Set up Q&A`** button (configures Q&A workflows, experts, and auto-approval rules) and `Learn more`.
- **Active Q&A Workspace:**
  - **Left Quick Access Panel:** `All`, `Action required`, `Assigned`, `Unanswered`, `Answered`, `FAQ`, plus customizable **`Category`** list (`Finance`, `Tax`, `R&D`, `Legal`, `HR`, `Accounting` with gear settings icon).
  - **Questions Table:** Columns `#` (e.g., `B100`), `Subject`, `Status` (`Draft`, `Submitted`, `Assigned`, `To approve`, `Answered`, `Rejected`, `Closed`), `Author`, `Priority`, `Category`, `Linked Document/Folder` (clicking navigates to the mirrored Drive item), plus `Customize columns`, `+ Ask question`, search, filters, and `Export Q&A`.

---

### 4.8 `Reports` (`/reports`) — All 6 Sub-Tabs
1. **`Activity log` (`/reports/activity-log`):**
   - Scope dropdown (`Report on`): `All actions`, `Users and groups`, `Project`, `Documents`.
   - Filters: `Period` (calendar + `Past week` / `Past month`), `Action` (hierarchical tree: `Documents`, `Participants`, `Permissions`, `Q&A`, `Reports`, `Project settings`, `Project archiving`, plus `Drive sync`), `Author` (searchable group/user tree), `Clear all`.
   - Right controls: **`Export`** (`Download report` | `Email report`), **`Subscribe`** (schedule wizard `/reports/activity-log/subscribe` with `Name`, `Frequency` Daily/Weekly/Monthly/Custom, `Reporting period`, `Start sending`), **`Customize columns`** (`Date and time`, `Author`, `Group`, `Action`, `Description`).
   - **Row Click Behavior:** Opens a **Right-Side Activity Details Drawer** showing action title, author card & group pill, quick filter/subscribe/copy icons, and structured event metadata.
2. **`Documents overview` (`/reports/documents-overview`):**
   - Top controls: `Period`, **`Overview on`** (`All participants` or specific group), `Export`, `Subscribe`.
   - Left pane: Searchable mirrored Drive folder tree to scope the overview.
   - Main pane: **`Top 10 files` horizontal carousel** (`Hide/Show` toggle, `Sort by`: `Time viewed` | `Number of views` | `Recently viewed`, `Most` | `Less` segmented switch), **`Summary` card** (`total viewing time`, `avg. viewing time`, `total views`, `participants engaged`), **`Dynamics of viewing time` chart** (monthly bars + avg daily line), and **Participants breakdown table** (`Participants`, `Group`, `Views`, `Time spent`, `avg. viewing time`, `Last activity`).
3. **`Engagement matrix` (`/reports/engagement-matrix`):**
   - Top controls: `Period`, **`Include deleted groups`** toggle, `Export`, `Subscribe`.
   - Dual view toggle (`Groups` vs `By documents` in left-pane header):
     - *Groups view*: Select groups on left -> right heatmap table (`Index`, `Name`, `Files`, `% engaged`, blue heatmap columns `Total`, `Views`, `Downloads`, `Prints`) with `By folders` / `By files` switch & `Customize columns`.
     - *By documents view*: Select Drive folder/file on left (with `Include subitems` toggle) -> right table (`Group`, `Users`, `Total`, `Views`, `Downloads`, `Prints`).
4. **`Data storage` (`/reports/data-storage`):**
   - Top controls: `Unit` radio (`GB` | `MB`), `Export`, `Subscribe`.
   - Cards & Charts: `Summary` Donut Chart by file category, `Over the period` historical storage line chart (with date-range selector), and `Storage table` (`Index`, `Name`, `# Files`, `Size`, `By folders`/`By files`, `Customize columns`).
5. **`Permissions log` (`/reports/permissions`):**
   - Top controls: `Period`, `Target group` tree filter, `Author` tree filter, `Export`, `Subscribe`.
   - Left Drive folder tree filter + right chronological audit table (`Date and time`, `Author`, `Target group`, `Description` of granted/revoked permission changes).
6. **`Subscriptions` (`/reports/subscriptions`):**
   - Lists all scheduled recurring report subscriptions with frequency, next run, recipients, pause/resume toggle, edit, and delete (plus empty-state CTA `Go to activity log`).

---

### 4.9 `Settings` (`/settings`) — Personal & Project Sub-Tabs

#### A. `Settings > Personal > Notifications` (`/settings/personal/notifications`)
- Toggle switches: **`Uploaded and deleted documents`** (ON/OFF) and **`Data storage reached the limit`** (ON/OFF).

#### B. `Settings > Project` (All 9 Sub-Tabs + Google Drive Sync)
1. **`General` (`/settings/project/general`):**
   - Left column: Editable **Project Name** (inline pencil -> Save/Cancel), **Project URL slug**, **Status dropdown** (`Live`, `Locked`, `Archived`, `Closed`) + **`Status history`** (`Show more` / `Show less`), and **`General info`** (`Project ID`, `Project type`, `Storage / Sync Region`, `Administrator's contacts`).
   - Right column: **`Locking`** card (`Lock project` -> modal with `Unlock rights` admin multi-select + `Cancel` / `Confirm & lock`), **`Archiving`** card (`Archive project` + `Create offline backup v`: `Downloadable archive` | `USB archive`), and **`Closure`** card (`Close project`).
2. **`Google Drive Sync` (`/settings/project/google-drive`, Kleen-specific):**
   - Connect Google account / Service Account, paste or browse **Target Google Drive Folder URL / ID**, choose **`Mirror Read-Only`** vs **`Two-Way Admin Sync`**, configure auto-sync interval / webhook status, exclusion patterns (e.g., `.DS_Store`, temp files), view **Last Synced Timestamp & Sync Log**, and click **`Sync Now`** or **`Re-index All`**.
3. **`Branding` (`/settings/project/branding`):**
   - **`Logo`** uploader (PNG/JPG `256×256` with hover Edit/Delete), **`Theme color`** (9 Apple-harmonized accent swatches), **`Login page background`** (`1920×1080` uploader with hover Edit/Delete), **`Customize invitations`** alias toggle, and **Live `Login page preview`** card on the right.
4. **`Documents` (`/settings/project/documents`):**
   - 3 auto-saving toggles: **`Automatic indexing`** (ON), **`Versioning`** (ON), **`Publishing`** (OFF — hides newly synced/added documents until explicitly published).
5. **`Labels` (`/settings/project/labels`):**
   - Manage customizable label groups (`Group` name, `Type`: `Single` | `Multiple`, color-coded `Values`) via **`+ Add labels`** modal, assignable to documents for quick filtering.
6. **`Terms of access` (`/settings/project/terms-of-access`):**
   - **`+ Create new terms`** (`Terms of access` type dropdown: `NDA`, `Terms and conditions`, `Confidentiality agreement`, `Disclaimer`, `Custom title`; `Display` radio: `On first sign-in` | `On each sign-in`; `Assigned groups` selector; rich-text editor; `Cancel` / `Create`), **`Download accepted terms`** export button, and Terms table with `Status` toggle + hover **`Edit`**, **`Preview` (eye -> opens `Previewing as a user` modal with confirmation checkbox & `Accept`)**, and **`Delete`** buttons.
7. **`Watermarks` (`/settings/project/watermarks`):**
   - Master **`Display watermarks`** toggle, **`When`** checkboxes (`Viewing`, `Printing`, `Downloading PDF or encrypted file`), **`Color`** swatches (Gray, Red, Blue), **`Opacity`** slider + numeric input (`0%–100%`, default `45%`), **`Position`** layout buttons (`Corner/Edge`, `Tiled Grid`, `Diagonal`), and **`Details`** checkboxes (`Project name`, `Email`, `Full name`, `Date and time`, `Company`, `Group`, `IP address`, `Custom text`).
8. **`Security` (`/settings/project/security`):**
   - Policy toggles: **`Support access`**, **`2-step verification`** (project-wide enforcement), **`Allowed domains`**, **`Allowed IP addresses`**, **`Email verification`** (OTP confirmation).
9. **`AI tools` (`/settings/project/ai-tools`):**
   - Master **`AI tools`** toggle (*"No training on your data"*) + **`AI redaction`**, **`AI search`** (in-viewer Q&A & document summaries), **`AI translation`**, and **`Similar questions in Q&A`**.
10. **`Integrations` (`/settings/project/integrations`):**
    - **`Google Drive`** (primary live storage integration) + toggleable external AI/workspace connectors (`ChatGPT`, `Claude`, `MS Copilot`, etc.) scoped to authorized participant groups.

---

### 4.10 `Project archiving` (`/archiving`) & `Recycle bin` (`/recycle-bin`)
- **Project Archiving (`/archiving`):**
  - **`Online archive`** card (`Archive project` -> `/archiving/archive-online`: `Duration` selector, `Access rights` participant picker, summary & `Cancel` / `Archive project`).
  - **`Offline backup`** card: Expandable **`Downloadable archive`** (`+ Create archive` builds downloadable ZIP with full folder structure + index) and **`USB archive`** (`Place order` 3-step wizard: `1 Archives`, `2 Recipients`, `3 Confirmation`).
  - **`Project closure`** card (`Close project` -> `/archiving/close`: `Now` vs `Later` scheduler, `Reason` dropdown, NPS feedback scale `1–10`, `Cancel` / `Close project`).
- **Recycle bin (`/recycle-bin`):**
  - Empty state when clean; when items are deleted, lists deleted folders/files with `Restore` and `Empty recycle bin` / permanent delete actions (synced appropriately with Google Drive Trash when Two-Way mode is active).

---

## 5. Recommended Technical Stack & Security Guarantees

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS + Framer Motion (Apple-grade transitions) + PDF.js (custom secure canvas viewer with live diagonal watermark & Fence View overlay) + Recharts / Visx (Apple-minimalist analytics charts).
- **Backend & Database:** Next.js Route Handlers / Server Actions + PostgreSQL + Prisma/Drizzle ORM storing mirrored Drive nodes, permissions, notes, Q&A, checklists, subscriptions, and detailed duration-aware activity logs.
- **Google Drive Integration:** Official `googleapis` Drive v3 client using incremental `changes.list` page tokens + periodic reconciliation; all file downloads, thumbnails, and PDF streams flow exclusively through authenticated server routes checking group permissions, NDA acceptance, IP/2FA rules, and applying watermarks before bytes reach the browser.

---

## 6. Acceptance Criteria
1. Every tab, sub-tab, modal, drawer, and button behavior specified in Sections 3 & 4 is implemented cleanly with zero dead buttons.
2. UI adheres strictly to the **Apple-style Light & Dark aesthetic** with fluid RTL/LTR Arabic + English filename support.
3. Connecting a Google Drive folder (`GOOGLE_DRIVE_ROOT_FOLDER_ID`) mirrors its complete folder hierarchy, subfolders, and files into `Documents` with automatic dot-indexing, live search, filters, `View as`, and secure watermarked viewing.
4. Full activity logging captures sign-ins, document views (with duration), downloads, prints, and permission edits in real time.
