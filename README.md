# Kleen Data Room

An Apple-inspired Virtual Data Room (VDR) web application built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **SQLite (`node:sqlite`)**, and **Google Drive API v3 (`drive.readonly`)**.

## Key Capabilities
- **Read-Only Google Drive Mirroring:** Connects to a designated Google Drive folder (`GOOGLE_DRIVE_ROOT_FOLDER_ID`) via Service Account, OAuth 2.0, or API Key and mirrors its exact folder hierarchy, subfolders, filenames (including mixed Arabic/English RTL/LTR), sizes, and file streams into the Data Room.
- **Apple Software Aesthetic (macOS HIG):** Adaptive Light & Dark appearances, frosted-glass navigation rails (`backdrop-filter`), tabular numbers, and Finder/Preview-inspired UX.
- **Kleen Viewer:** Built-in PDF/document viewer with configurable diagonal/grid/corner dynamic watermarks, Fence View privacy slit, Zoom/Rotate/Page jumper, In-Document Search, Thumbnails, Outline, and Private/Shared Notes.
- **Enterprise VDR Suite:**
  - `Dashboard` (`Activity` & `Documents` analytics, Export & Subscribe)
  - `Documents` (`All`, `Notes`, `External links`, `Signatures`, Quick Access, `View as` group preview, `Project index` XLSX export, `Rebuild index`)
  - `Participants` & `Permissions` (7-level cumulative segmented permissions matrix + `Set permissions by file type`)
  - `Q&A` & `Due diligence checklist`
  - `Reports` (`Activity log`, `Documents overview`, `Engagement matrix`, `Data storage`, `Permissions log`, `Subscriptions`)
  - `Settings` (`General`, `Google Drive Sync`, `Branding`, `Documents`, `Labels`, `Terms of access` NDA gate, `Watermarks`, `Security`, `AI tools`, `Integrations`)
  - `Project archiving` & `Recycle bin`

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`. The SQLite database (`data/kleen.db`) is initialized and seeded automatically on first launch.

### Demo Accounts (Password: `kleen2026`)
- **Administrator:** `ahmed.badran@kleen.sa`
- **Investor Group:** `investor@partner-capital.sa`
- **Legal Advisors:** `counsel@legal-advisors.sa`

## Connecting Your Real Google Drive Folder
1. Sign in as Administrator and go to **Settings → Google Drive Sync**.
2. Paste your Google Drive Folder URL or Folder ID.
3. Choose an authentication mode (`Service Account JSON`, `OAuth 2.0`, or `API Key`).
4. Click **Save & Sync Now** — Kleen Data Room mirrors your Drive folder in strict **Read-Only Mode** (`drive.readonly`).

See [PROMPT.md](./PROMPT.md) for the full product and interaction specification.
