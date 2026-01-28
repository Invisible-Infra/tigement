# Tigement User Manual (EN)

Welcome to Tigement – a time and task management workspace. This manual walks you through core concepts and everyday workflows.

## Table of contents
- [Purpose & Planning Philosophy](#purpose)
- [Introduction & Concepts](#concepts)
- [Getting Started](#getting-started)
- [Workspace Basics](#workspace-basics)
- [Planning Workflow (Day tables)](#planning-workflow)
- [Automatic Scheduling & Calculations](#automatic)
- [Mobile UX](#mobile-ux)
- [Task Groups](#task-groups)
- [Notebooks](#notebooks)
- [Export (CSV / Markdown Review)](#export)
- [Payments & Premium](#payments)
- [Forgot Password](#forgot-password)
- [Archiving Tables](#archiving)
- [Settings & Profile](#settings)
- [Data Backup & Recovery](#backup-recovery)
- [Shortcuts & Tips](#shortcuts)

<a id="purpose"></a>
## Purpose & Planning Philosophy
Tigement is optimized for planning a realistic day. You write tasks with durations, and the app lays them out on a timeline. Instead of micro‑managing start times, you focus on the order and how long each task should take. Tigement then calculates start/finish automatically, keeps a running total, and helps you iterate quickly.

<a id="concepts"></a>
## Introduction & Concepts
- Tables: two types – Day (dated schedule) and TODO (backlog). Each table contains tasks.
- Tasks: have a title, optional start/finish (Day), duration, selection state, group and optional notes (notebook).
- **End-to-End Encryption**: All workspace data is encrypted on your device before syncing. Only you can decrypt it with your password. Even the server owner cannot see your tasks, notes, or any workspace content.
- Sync: logged-in users can cloud-sync encrypted workspaces.

<a id="getting-started"></a>
## Getting Started
1. Register and log in.
2. Add a Day or TODO table from the right sidebar.
3. Add tasks; on Day tables, times auto-chain from the table start time.
4. Use the hamburger on mobile to open the sidebar.

<a id="workspace-basics"></a>
## Workspace Basics
- Reorder tasks:
  - Desktop: drag anywhere in the row.
  - Mobile: drag using ▲/▼ icons (scroll is locked during drag).
- Select tasks with the checkbox; use Bulk Actions to add group or delete.
- Pagination on mobile: fixed bar with Previous/Next and a dropdown to jump.
- Caret placement fix: click inside task title sets cursor precisely where you click.

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

<a id="export"></a>
## Export
- CSV Export/Import in sidebar.
- Markdown “Export Review” on each table – generates `YYMMDD-title.md` with bullet list of tasks, times, and total.

<a id="payments"></a>
## Payments & Premium
- BTCPay checkout with coupons.
- Webhooks handle activation; idempotent processing avoids duplicates.
- Keep BTCPay behind Cloudflare allow rules when needed.

<a id="forgot-password"></a>
## Forgot Password
- Use “Forgot password?” on login, receive email, open the link to reset.

<a id="archiving"></a>
## Archiving Tables
- Use the table actions menu (⋮) → Archive.
- Archived tables disappear from workspace but are stored and listed in Archived Tables (sidebar).
- Restore from the Archived Tables menu (shows date/name and task count).

<a id="settings"></a>
## Settings & Profile
- Profile button opens Profile & Security (2FA, iCal, Advanced Encryption).
- **End-to-End Encryption**: Your workspace data is encrypted with a key derived from your password before leaving your device. This means:
  - Your data is unreadable on the server – even the server administrator cannot access your tasks, notes, or any workspace content
  - Only you can decrypt your data using your password
  - If you forget your password, your encrypted data cannot be recovered (make sure to use a password manager)
  - You can set a custom encryption key in Advanced settings for additional security
- Settings keeps workspace preferences (theme, time/date format, timers, pickers).
- **Themes**: Choose from Light (Modern), Classic (Retro), Dark, Terminal (Hacker), or ZX Spectrum (authentic Sinclair ZX Spectrum 8-bit aesthetic with bright cyan and black).
- **Duration Presets**: Configure quick-select buttons in the duration picker. Enter comma-separated minutes (e.g., "15, 30, 60, 120"). Clicking a preset applies the duration immediately without needing to press "Done".

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

<a id="shortcuts"></a>
## Shortcuts & Tips
- Undo / Redo available in the sidebar.
- Time picker toggles between inline editing and picker.
- Use Select All checkbox in the header row to select/deselect all tasks.

