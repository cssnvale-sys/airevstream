# Comprehensive QA Audit — Verified Fix Plan

## Context

Following the Session 46 QA fix commit (14 fixes: confirm dialogs, modal Escape handlers, error states), a full-system userflow audit was conducted across all 20 pages, 10+ modals, and 186 API routes using 3 parallel Explore agents.

**Audit outcome**: Most pages are solid. 5 pages are missing error states, 1 page still uses browser `confirm()`, 3 custom dialogs on content detail lack keyboard handlers, and experiments is missing pagination controls.

**False positives dismissed** (verified by reading actual code):
- Content detail `res.data.id` — CORRECT per apiPost envelope pattern
- Channels page "missing pagination" — HAS pagination (lines 177-198)
- Accounts page "missing error" — HAS error state (lines 1079-1083)
- Custom reject dialog "should be ConfirmDialog" — Intentionally custom (needs textarea)

---

## Wave 1: Add Error States (5 pages, 5 fixes)

All follow the same pattern: destructure `error` + `mutate` from hook, add error banner with retry before loading check.

### 1a. channels/page.tsx — Add error state
**File**: `apps/web/src/app/channels/page.tsx`
**Problem**: Line 50 — `{ data: rawData, isLoading }` does not destructure `error`. No error banner rendered.
**Fix**: Destructure `error, mutate`. Add error banner with retry button before `isLoading` check (line 104). Import `AlertTriangle, RefreshCw` from lucide-react.

### 1b. series/page.tsx — Add error state
**File**: `apps/web/src/app/series/page.tsx`
**Problem**: Line 33 — `{ data: rawData, isLoading, mutate }` does not destructure `error`. No error banner.
**Fix**: Add `error` to destructure. Add error banner before `isLoading` check (line 89). Import `AlertTriangle, RefreshCw`.

### 1c. experiments/page.tsx — Add error state
**File**: `apps/web/src/app/experiments/page.tsx`
**Problem**: Line 39 — `{ data: rawData, isLoading, mutate }` does not destructure `error`. No error banner.
**Fix**: Add `error` to destructure. Add error banner before `isLoading` check (line 95). Import `AlertTriangle, RefreshCw`.

### 1d. assets/page.tsx — Add error state
**File**: `apps/web/src/app/assets/page.tsx`
**Problem**: Avatar/scenery hooks at lines 431-434 don't destructure `error`. No error banner in either tab.
**Fix**: Destructure `error: avatarsError` and `error: sceneryError` from respective hooks. Add error banner inside each tab content section before loading check. Import `AlertTriangle, RefreshCw`.

### 1e. assets/[assetId]/page.tsx — Add error state
**File**: `apps/web/src/app/assets/[assetId]/page.tsx`
**Problem**: Line 227 — `{ data: rawData, isLoading, mutate }` does not destructure `error`. If API fails, page shows "Character not found" (line 340) instead of an error message.
**Fix**: Add `error` to destructure. Differentiate between `error` (API failure → show retry) and `!avatar` (deleted → show not found).

### Error banner template (consistent across all 5):
```tsx
{error ? (
  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center">
    <AlertTriangle size={24} className="text-red-400 mx-auto mb-2" />
    <p className="text-red-400 font-medium mb-1">Failed to load [entity]</p>
    <p className="text-sm text-text-secondary mb-3">Something went wrong. Please try again.</p>
    <button onClick={() => mutate()} className="btn-secondary btn-sm inline-flex items-center gap-2">
      <RefreshCw size={14} /> Retry
    </button>
  </div>
) : isLoading ? (
```

---

## Wave 2: Replace confirm() + Dialog Keyboard Handlers (2 files, 7 fixes)

### 2a. assets/[assetId]/page.tsx — Replace confirm() with ConfirmDialog for slot image delete (line 113)
**Problem**: `if (!confirm(\`Remove the ${SLOT_LABELS[slot]} image?\`)) return;`
**Fix**: Add `deleteOpen` state to SlotCard. Replace confirm() call with `setDeleteOpen(true)`. Render ConfirmDialog. Import ConfirmDialog.

### 2b. assets/[assetId]/page.tsx — Replace confirm() with ConfirmDialog for avatar delete (line 317)
**Problem**: `if (!confirm('Delete this character permanently?')) return;`
**Fix**: Add `deleteAvatarOpen` state. Replace confirm() with `setDeleteAvatarOpen(true)`. Render ConfirmDialog with danger variant.

### 2c. content/[id]/page.tsx — Add Escape handler to reject dialog (line 557-602)
**Problem**: Custom reject dialog has no Escape key handler. Backdrop onClick exists but isn't guarded during `acting`.
**Fix**: Add `useEffect` Escape handler guarded by `acting`. Guard backdrop: `onClick={() => !acting && (setRejectOpen(false), setRejectReason(''))}` (already partially there, verify guard).

### 2d. content/[id]/page.tsx — Add Escape handler to repurpose dialog (line 604-657)
**Problem**: Backdrop onClick exists (`onClick={() => setRepurposeOpen(false)}`), no Escape handler, not guarded during `acting`.
**Fix**: Add `useEffect` Escape handler guarded by `acting`. Guard backdrop click.

### 2e. content/[id]/page.tsx — Add Escape handler to distribute dialog (line 660-739)
**Problem**: Same as 2d — no Escape handler, not guarded.
**Fix**: Same pattern.

### 2f. content/[id]/page.tsx — Fix "Go Back" button on error state (line 211)
**Problem**: `onClick={() => router.back()}` — if user navigated directly to URL, back goes to external page or nowhere.
**Fix**: Change to `<Link href="/library" className="btn-secondary">Back to Library</Link>`.

### 2g. content/[id]/page.tsx — Consolidate Escape handlers
**Problem**: 3 separate dialogs each need an Escape handler. Adding 3 separate useEffects is messy.
**Fix**: Add a single `useEffect` that handles Escape for whichever dialog is open (rejectOpen, repurposeOpen, distributeOpen), guarded by `acting`.

---

## Wave 3: Experiments Pagination (1 file, 1 fix)

### 3a. experiments/page.tsx — Add pagination controls
**File**: `apps/web/src/app/experiments/page.tsx`
**Problem**: Line 39 fetches all experiments with no limit param. Line 172-176 shows total count but no page navigation. If >50 experiments, all loaded at once.
**Fix**:
- Add `page` state (like channels/page.tsx)
- Pass `page=${page}&limit=20` to useExperiments
- Cast response for meta access (same pattern as channels)
- Add Prev/Next pagination controls after table (copy from channels pattern)

---

## File Summary

| Wave | Files | Fixes | Focus |
|------|-------|-------|-------|
| 1 | 5 (channels, series, experiments, assets, assets/[id]) | 5 | Error states with retry |
| 2 | 2 (assets/[assetId], content/[id]) | 7 | confirm()→ConfirmDialog, Escape handlers, back link |
| 3 | 1 (experiments) | 1 | Pagination controls |
| **Total** | **8 files** | **13 fixes** | |

**No new files needed. No database migrations.**

## Components to Reuse
- `ConfirmDialog` — `apps/web/src/components/ui/confirm-dialog.tsx`
- `AlertTriangle`, `RefreshCw` from lucide-react
- Pagination pattern from `channels/page.tsx` lines 177-198
- Escape handler pattern from `AddEpisodeModal` or `ConfirmDialog`

## Verification

After each wave:
```bash
turbo build --force      # All 14 packages compile
turbo test               # All tests pass
npm run audit            # All 33 audit tests pass
```

Manual checks:
- Wave 1: Disconnect API → each page shows error banner with retry. Click retry → data loads.
- Wave 2: Delete image/avatar shows ConfirmDialog. Escape closes all content detail dialogs. "Back to Library" link works from direct URL.
- Wave 3: Create >20 experiments → pagination controls appear. Prev/Next navigate correctly.
