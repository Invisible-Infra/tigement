# Tigement User Manual (EN)

Welcome to Tigement – a time and task management workspace. This manual walks you through core concepts and everyday workflows.

## Table of contents
- [Purpose & Planning Philosophy](#purpose)
- [Introduction & Concepts](#concepts)
- [Getting Started](#getting-started)
- [Workspace Basics](#workspace-basics)
- [Spaces (Tab Groups)](#spaces)
- [Planning Workflow (Day tables)](#planning-workflow)
- [Automatic Scheduling & Calculations](#automatic)
- [Mobile UX](#mobile-ux)
- [Task Groups](#task-groups)
- [Notebooks](#notebooks)
- [Diary](#diary)
- [Statistics](#statistics)
- [Export (CSV / Markdown Review)](#export)
- [Payments & Premium](#payments)
- [Table Sharing](#table-sharing)
- [iCal Subscription](#ical)
- [OAuth & Sign-In](#oauth)
- [Forgot Password](#forgot-password)
- [Archiving Tables](#archiving)
- [Settings & Profile](#settings)
- [Data Backup & Recovery](#backup-recovery)
- [AI Assistant](#ai-assistant)
- [API Tokens](#api-tokens)
- [Onboarding & Tutorial](#onboarding)
- [Shortcuts & Tips](#shortcuts)

<a id="purpose"></a>
## Purpose & Planning Philosophy
Tigement is optimized for planning a realistic day. You write tasks with durations, and the app lays them out on a timeline. Instead of micro‑managing start times, you focus on the order and how long each task should take. Tigement then calculates start/finish automatically, keeps a running total, and helps you iterate quickly.

<a id="concepts"></a>
## Introduction & Concepts
- Tables: two types – Day (dated schedule) and LIST (backlog). Each table contains tasks.
- Tasks: have a title, optional start/finish (Day), duration, selection state, group and optional notes (notebook).
- **End-to-End Encryption**: All workspace data is encrypted on your device before syncing. Only you can decrypt it with your password. Even the server owner cannot see your tasks, notes, or any workspace content.
- Sync: premium users can cloud-sync encrypted workspaces across devices.

<a id="getting-started"></a>
## Getting Started
The planner workspace requires registration. You can try the onboarding video and interactive tutorial without an account; register or log in at the end to use the app.
1. Register and log in (email/password or OAuth: Google, GitHub, Apple, X, Facebook).
2. Add a Day or LIST table from the right sidebar.
3. Add tasks; on Day tables, times auto-chain from the table start time.
4. Use the hamburger on mobile to open the sidebar.

<a id="workspace-basics"></a>
## Workspace Basics
- Reorder tasks:
  - Desktop: drag anywhere in the row.
  - Mobile: drag using ▲/▼ icons (scroll is locked during drag).
- Select tasks with the checkbox; use Bulk Actions to add group or delete. When moving a task to another tab (drag or Move menu), all selected tasks move together.
- Pagination on mobile: fixed bar with Previous/Next and a dropdown to jump.
- Caret placement fix: click inside task title sets cursor precisely where you click.
- **View modes**: All-in-one (freeform canvas) or Spaces (days on left, LIST spaces on right). Switch in the sidebar.
- **Zoom**: Desktop only – 50% to 200%. Split view in Spaces: draggable divider between days and LIST panels.

<a id="spaces"></a>
## Spaces (Tab Groups)
- Organize LIST tables by project, context, or category. Each space has a name, icon, and color.
- In Spaces view: days appear on the left, LIST spaces on the right. Assign each LIST table to a space or "All Spaces."
- Filter workspace by space in All-in-one view. Split position (left/right panel width) is saved in settings.

<a id="planning-workflow"></a>
## Planning Workflow (Day tables)
1. Create a Day table – it has a date and a starting time for the first task.
2. Add tasks in the order you intend to do them.
3. Set a realistic duration for each task (e.g., 00:30, 01:15). Use duration presets for quick selection (click a preset to apply instantly).
4. Tigement computes the start/finish for every task by chaining durations from the table start time.
5. Reorder tasks to see an updated day plan instantly.
6. Use the time sum in the header to validate workload (e.g., keep the day near 8h).

Tip: If you need a hard start for the first task, set the table start time. Everything else will follow from durations.

<a id="automatic"></a>
## Automatic Scheduling & Calculations
- Chained times: finish of task N becomes start of task N+1.
- Editing duration updates all following times.
- Total duration: shown in the Day table header (“Time sum”).
- Visual time hints:
  - If a task name starts with a time (e.g., “09:30 Stand‑up”), the app indicates whether it matches the computed start.
  - Mismatch is highlighted so you can reconcile expectations vs reality.
- Mobile safety: drag is restricted to ▲/▼ icons; scrolling is locked while dragging to avoid accidental moves.
- Task name autocomplete: when typing a task name, the browser suggests existing task titles from your workspace.

<a id="mobile-ux"></a>
## Mobile UX
- Drag limited to ▲/▼; long-press task title opens “Move to table”.
- Haptic feedback when the move menu opens.
- Scroll lock during drag to prevent accidental scrolling.

<a id="task-groups"></a>
## Task Groups
- Each task can have a group with icon and color.
- Click the group icon (or dot) to change group; create custom groups with icon/color.
- Task name background reflects the group color (auto-contrasted text).
- Bulk Actions → Add selected to group.

<a id="notebooks"></a>
## Notebooks
- Workspace notebook: general notes.
- Task notebooks: per-task notes. Click the book icon.
- Markdown supported (headings, lists, tables, code blocks with syntax highlighting).
- Notebooks open as draggable windows you can move around.

<a id="diary"></a>
## Diary
- Daily journal with dated entries. Full markdown support.
- Create entries from the Diary list; click to open. Edit/Preview toggle. Export individual entries to Markdown.
- Draggable diary window on desktop.

<a id="statistics"></a>
## Statistics
- Overview: total tables, tasks (active/archived), duration, archived tables.
- Task groups: count, tasks by group, duration by group.
- Storage: browser (localStorage) and server (premium).
- Export Filtered Data: filter by task group and date range (all, last 7/30 days, this month, custom).

<a id="export"></a>
## Export
- CSV Export/Import in sidebar.
- Markdown “Export Review” on each table – generates `YYMMDD-title.md` with bullet list of tasks, times, and total.

<a id="payments"></a>
## Payments & Premium
- BTCPay checkout with coupons. Multiple payment methods: BTCPay, Stripe, PayPal (if enabled).
- Referral coupons: premium users earn coupons when purchasing; share or use for free premium time.
- Webhooks handle activation; idempotent processing avoids duplicates.
- Keep BTCPay behind Cloudflare allow rules when needed.

<a id="table-sharing"></a>
## Table Sharing (Premium)
- E2EE share tables by email. Recipients get View or Edit permission.
- Share button in table header. Recipients see "Shared with me" in sidebar.
- Non-premium recipients can view shared tables and pull updates, but edit requires premium.
- View-only: open table, no editing. Edit: live-edit in SharedTableEditorModal or add to workspace and push changes.
- Pull changes: owner and recipient can pull updates. Conflict resolution when multiple recipients edit.

<a id="ical"></a>
## iCal Subscription (Premium)
- Live calendar feed URL for Google Calendar, Apple Calendar, Outlook.
- Profile → Apps & calendar → enable iCal subscription, copy URL.
- Privacy: data stored unencrypted on server for the feed. Opt-in only.

<a id="oauth"></a>
## OAuth & Sign-In
- Sign in with Google, GitHub, Apple, X, or Facebook (if enabled by your instance).
- OAuth users: set encryption passphrase on first login. Remember it – it unlocks your data.
- "Trust device 30 days" skips 2FA for that session.

<a id="forgot-password"></a>
## Forgot Password
- Use “Forgot password?” on login, receive email, open the link to reset.

// ... Previous content remains unchanged

<a id="archiving"></a>
## Archiving Tables
- Use the table actions menu (⋮) → Archive.
- You can also click the Delete (×) control in the table header and choose **Archive table** in the modal instead of deleting permanently.
- Archived tables disappear from workspace but are stored and listed in Archived Tables (sidebar).
- Restore from the Archived Tables menu (shows date/name and task count).

// ... Following content remains unchanged

<a id="settings"></a>
## Settings & Profile
- Profile button opens Profile & Security (2FA, iCal, Advanced Encryption).
- **End-to-End Encryption**: Your workspace data is encrypted with a key derived from your password before leaving your device. This means:
  - Your data is unreadable on the server – even the server administrator cannot access your tasks, notes, or any workspace content
  - Only you can decrypt your data using your password
  - If you forget your password, your encrypted data cannot be recovered (make sure to use a password manager)
  - You can set a custom encryption key in Advanced settings for additional security
- Settings keeps workspace preferences (theme, time/date format, timers, pickers).
- **Conditional default tasks** (Premium): Add rules in Settings to automatically create tasks when you add new tables. For example, "When creating a new Day table, if the day is Monday, add task '8:00 Review' with duration 30 minutes." You can also set task group, note, and pre-select tasks. Rules can use day of week, day of month, month, or custom expressions. When adding an expression condition, expand "Expression reference" for variables, operators, and clickable examples. Configure in Settings → Conditional Default Tasks.
- **Timer**: Countdown for the current task. Your choice to show or hide the Timer is remembered across page reloads. On mobile, the Timer button in the bottom bar toggles the Timer panel on or off.
- **Duration Presets**: Configure quick-select buttons in the duration picker. Enter comma-separated minutes (e.g., "15, 30, 60, 120"). Clicking a preset applies the duration immediately without needing to press "Done".
- **Session & browser data behavior**:
  - **Anonymous (no account)** – Data created in this browser stays locally until you clear it (no login session, no automatic wipe).
  - **Logged-in (free / non‑premium)** – When your session expires or you log out, Tigement clears login tokens and encryption keys and stops sync, but keeps your encrypted/local data (tables, notebooks, diary, archives, AI history/config) in the browser for offline use. The workspace will look empty/locked until you log in again on that device.
  - **Logged-in (premium)** – When your session expires or you log out, Tigement clears login tokens, encryption/sharing keys **and** browser-stored workspace data (tables, notebooks, diary, archives, pinned items, AI history/config, etc.) from that device. Your data remains safely stored on the server and is re-synced after you log in again. If you stay offline long enough for the session to expire, unsynced local work on that device may be lost when you reconnect unless you download a JSON backup beforehand (Profile → Data Backup → Download Backup).

<a id="backup-recovery"></a>
## Data Backup & Recovery

### Data Backup
- In Profile menu → Security section → **Data Backup**, click "Download Backup"
- Exports all your data (tables, settings, task groups, notebooks, archived tables) as a readable JSON file
- Filename format: `tigement-backup-YYYY-MM-DD-HHMMSS.json`
- Available to all users (free and premium)
- **Important**: Regularly backup your data, especially if you use a custom encryption key

### Decryption Failure Protection
If your encryption key doesn't match the server data (e.g., after changing your password or setting a custom key on a different device), Tigement will:

1. **Block sync operations** to prevent data loss
2. **Automatically open Profile menu** with a warning banner
3. **Offer two recovery options**:
   - **Enter Custom Key**: If you're using a custom encryption key, enter it to restore access. The app will automatically retry sync.
   - **Force Overwrite**: ⚠️ **Warning**: This permanently deletes all encrypted data on the server. Only use this if you're certain you want to overwrite server data with your current local data.

**Why this happens:**
- If you reset your account password via "Forgot Password", the new password becomes the encryption key
- If you had a custom encryption key before, the new password won't decrypt old data
- Always set your custom encryption key again after a password reset, or use the same password that was used when the data was encrypted

**Best practices:**
- Use a password manager to remember your encryption password
- Set a custom encryption key and use it consistently across all devices
- Regularly download backups to have a local copy of your data
- If you reset your password, immediately set your custom encryption key again (if you were using one)

<a id="ai-assistant"></a>
## AI Assistant
- Bring Your Own AI (BYOA): connect OpenAI, Anthropic, or custom (Ollama, LM Studio). Your API keys, your privacy.
- Profile → AI Assistant: configure provider, API key, model, mode (Preview/Automatic).
- Workspace menu → AI Assistant: type requests (e.g. "Move Monday tasks to Tuesday"). Preview mode: review changes before applying. Undo window: revert AI actions within configurable time.
- AI History: view past AI actions and undo recent changes.

<a id="api-tokens"></a>
## API Tokens
- Profile → Developer & advanced → API Tokens. Generate tokens for CLI and integrations.
- Scopes: workspace:read, workspace:write. Optional: enable decryption for CLI.
- Token format: `tig.PREFIX.TEK`. Save immediately – tokens cannot be retrieved again.

<a id="onboarding"></a>
## Onboarding & Tutorial
- First-run welcome modal and interactive tutorial. Shown automatically on first load (unless disabled).
- Help → Tutorial / Onboarding to re-open. Tutorial runs in sandbox – no user data modified.
- Steps: day start time, task names, durations, reordering, moving tasks between tables.
- Help → Reset onboarding / Enable onboarding again to reset flags.

<a id="shortcuts"></a>
## Shortcuts & Tips
- Undo / Redo available in the sidebar.
- Time picker toggles between inline editing and picker.
- Use Select All checkbox in the header row to select/deselect all tasks.

---
This manual is versioned with the repository. For the latest online version, open “User Manual” in the app sidebar.

