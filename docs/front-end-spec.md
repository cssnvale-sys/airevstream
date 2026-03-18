# Front-End Specification: AiRevStream MPCAS Dashboard

## Design System Foundation

### Technology Stack
- **Framework**: Next.js 14+ (App Router) with TypeScript
- **UI Library**: shadcn/ui (Radix primitives + Tailwind CSS)
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: React Context + SWR for server state (lightweight, no Redux overhead for solo dev)
- **Real-Time**: WebSocket via socket.io-client for live updates
- **Charts**: Recharts (React-native, composable)
- **Calendar**: Custom built on date-fns (no heavy calendar library)
- **Drag & Drop**: @dnd-kit (lightweight, accessible)
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **Tables**: TanStack Table (headless, sortable, filterable, paginated)
- **Toast/Notifications**: sonner (lightweight toast library)

### Design Tokens

**Color Palette (Dark Mode Primary — Light Mode Supported)**

| Token | Dark Mode | Light Mode | Usage |
|---|---|---|---|
| `--bg-primary` | `#0a0a0b` | `#ffffff` | Page background |
| `--bg-secondary` | `#141416` | `#f8f9fa` | Card/panel background |
| `--bg-tertiary` | `#1c1c1f` | `#f0f1f3` | Hover states, nested panels |
| `--border` | `#2a2a2d` | `#e2e4e8` | Borders, dividers |
| `--text-primary` | `#f0f0f2` | `#0a0a0b` | Primary text |
| `--text-secondary` | `#9a9aa0` | `#6b6b74` | Secondary/muted text |
| `--accent-blue` | `#3b82f6` | `#2563eb` | Primary actions, links |
| `--accent-green` | `#22c55e` | `#16a34a` | Success, active, healthy |
| `--accent-amber` | `#f59e0b` | `#d97706` | Warning, pending |
| `--accent-red` | `#ef4444` | `#dc2626` | Error, danger, critical |
| `--accent-purple` | `#a855f7` | `#9333ea` | AI actions, assistant |

**Status Colors (Consistent Across All Views)**

| Status | Color | Token |
|---|---|---|
| Active / Healthy / Posted | Green | `--status-active` |
| Warming / Pending / Queued | Amber | `--status-pending` |
| Producing Content / In Progress | Blue | `--status-working` |
| Disabled / Failed / Error | Red | `--status-error` |
| Idle / Archived / Inactive | Gray | `--status-idle` |
| Needs Human Action | Purple | `--status-human` |

**Typography**

| Element | Font | Size | Weight |
|---|---|---|---|
| Page title | Inter | 24px / 1.5rem | 700 |
| Section heading | Inter | 18px / 1.125rem | 600 |
| Card title | Inter | 15px / 0.9375rem | 600 |
| Body text | Inter | 14px / 0.875rem | 400 |
| Small/caption | Inter | 12px / 0.75rem | 400 |
| Monospace (code/IDs) | JetBrains Mono | 13px / 0.8125rem | 400 |

**Spacing Scale**: 4px base unit. Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px.

**Border Radius**: `--radius-sm`: 6px, `--radius-md`: 8px, `--radius-lg`: 12px, `--radius-xl`: 16px.

**Shadows (Dark Mode)**:
- `--shadow-sm`: `0 1px 2px rgba(0,0,0,0.3)`
- `--shadow-md`: `0 4px 12px rgba(0,0,0,0.4)`
- `--shadow-lg`: `0 8px 24px rgba(0,0,0,0.5)`

### Global Layout

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER (h: 56px, fixed)                                     │
│ ┌──────┬──────────────────────────────┬────────────────────┐ │
│ │ Logo │ Breadcrumb / Page Title      │ 🔔 Notif │ 👤 User│ │
│ └──────┴──────────────────────────────┴────────────────────┘ │
├────────┬────────────────────────────────────────────────────┤
│SIDEBAR │ MAIN CONTENT                                       │
│(w:240) │                                                     │
│        │                                                     │
│ 🏠 Home│                                                     │
│ 👥 Acct│                                                     │
│ 📅 Cal │                                                     │
│ ✨ Crea│                                                     │
│ 📚 Lib │                                                     │
│ 📊 Ana │                                                     │
│ 🏥 Sys │                                                     │
│ 💰 Aff │                                                     │
│ ⚙️ Set │                                                     │
│        │                                                     │
│        │                                                     │
│        ├────────────────────────────────────────────────────┤
│        │ AI ASSISTANT PANEL (collapsible, right edge)       │
│        │ (w: 380px when open)                               │
├────────┴────────────────────────────────────────────────────┤
│ STATUS BAR (h: 32px, fixed bottom)                          │
│ Server: ● Online | CPU: 45% | RAM: 120/512GB | Queue: 23   │
└─────────────────────────────────────────────────────────────┘
```

**Sidebar Navigation (240px, collapsible to 64px icon-only)**

| Icon | Label | Route | Badge |
|---|---|---|---|
| 🏠 | Home | `/` | — |
| 👥 | Accounts | `/accounts` | Account count |
| 📅 | Calendar | `/calendar` | Today's posts count |
| ✨ | Create | `/create` | — |
| 📚 | Library | `/library` | — |
| 📊 | Analytics | `/analytics` | — |
| 🏥 | System | `/system` | Error count (if any) |
| 💰 | Affiliate | `/affiliate` | — |
| ⚙️ | Settings | `/settings` | — |

**Sidebar Bottom Section:**
- Collapse/expand toggle
- Dark/light mode toggle
- System status indicator (green dot = healthy)

**Header (56px, fixed top)**
- Left: Logo + current page title (breadcrumb on nested pages)
- Center: Global search bar (Cmd+K shortcut, searches across accounts, content, channels)
- Right: Notification bell (badge count), user avatar/menu (settings, logout)

**Status Bar (32px, fixed bottom)**
- Server status indicator (online/offline)
- CPU / RAM / Storage usage (compact)
- Active workflow queue count
- Active browser sessions count
- Click to expand → System Health Dashboard

**AI Assistant Panel (380px, right edge, collapsible)**
- Toggle button: floating purple circle at bottom-right when collapsed
- When open: slides in from right, pushes content or overlays (configurable)
- Chat input at bottom, messages scrolling above
- Context indicator at top showing current page awareness
- Quick action buttons for common operations

---

## View 1: Home / Overview Dashboard

**Route**: `/`

**Purpose**: At-a-glance operational overview — the first thing the operator sees every day. Answer: "What needs my attention? How is everything performing? What's happening right now?"

### Wireframe Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Good morning, Akmauri                        March 16, 2026 │
├─────────────┬──────────────┬──────────────┬────────────────┤
│ PENDING     │ POSTED TODAY │ ACCOUNTS     │ REVENUE (MTD)  │
│ APPROVALS   │              │ HEALTHY      │                │
│   🟣 12     │   🟢 47      │  🟢 1,143    │  💰 $4,230     │
│ View queue →│ View cal →   │ 95.2% health │ +12% vs last   │
├─────────────┴──────────────┴──────────────┴────────────────┤
│                                                             │
│ ┌─ APPROVAL QUEUE (top 5) ───────────────────────────────┐ │
│ │ ▶️ Preview | Channel: FunnyHistory_EN | Type: Short     │ │
│ │   Score: 8.4 | Model: Veo3 | ✅ Approve  ❌ Reject 🔄 │ │
│ │ ▶️ Preview | Channel: TechReviews_ES | Type: Long      │ │
│ │   Score: 7.9 | Model: Kling | ✅ Approve  ❌ Reject 🔄 │ │
│ │ ... (3 more)                        View all (12) →     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ PUBLISHING TIMELINE (next 24h) ───────────────────────┐ │
│ │ ──●──────●────●──────────●────●──────●───────────●──── │ │
│ │  9am   10am  11am      1pm  2pm    4pm         8pm     │ │
│ │  YT     TT    IG       YT    TT    IG          YT      │ │
│ │  (3)    (5)   (2)      (4)   (3)   (2)         (1)     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ ACTIVE WORKFLOWS ──────────┬─ SYSTEM HEALTH ──────────┐ │
│ │ ● Content Production: 4     │ CPU ████████░░ 78%       │ │
│ │ ● Account Warming: 23       │ RAM ██████░░░░ 58%       │ │
│ │ ● Account Creation: 2       │ Storage █████░░░░░ 48%   │ │
│ │ ● Research: 1               │ Queue: 30 jobs           │ │
│ │                   View all →│ Browser: 12 sessions     │ │
│ └─────────────────────────────┴──────────────────────────┘ │
│                                                             │
│ ┌─ RECENT ACTIVITY FEED ─────────────────────────────────┐ │
│ │ 2m ago  ✅ Posted: "5 Credit Hacks" → TechReviews_EN   │ │
│ │ 5m ago  🎬 Generated: Short for FunnyHistory_ES        │ │
│ │ 8m ago  ⚠️ Account flagged: email_427@gmail.com (IG)   │ │
│ │ 12m ago 💰 Affiliate click: SockStore via FarmLife_EN   │ │
│ │ 15m ago 🔄 Warming complete: 8 accounts (batch 47)     │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

**KPI Cards Row** (4 cards, equal width)
- Each card: icon, metric value (large), label, trend indicator (vs previous period), click-through link
- Cards: Pending Approvals (purple), Posted Today (green), Accounts Healthy (green with percentage), Revenue MTD (with trend arrow)
- Real-time via WebSocket — values update without refresh

**Approval Queue Preview**
- Top 5 pending items, sorted by oldest first (or configurable: priority, score, channel)
- Each item: video thumbnail preview (click to play), channel name, content type, quality score, model used
- Inline action buttons: Approve (green), Reject (red), Regenerate (blue)
- "View all" link → full Approval Queue page
- Purple left-border on items needing human action

**Publishing Timeline**
- Horizontal timeline showing next 24 hours
- Dots represent scheduled posts, color-coded by platform (YT=red, TT=black, IG=gradient pink/orange, FB=blue)
- Hover on dot: tooltip with content title, channel, time
- Click: navigate to content detail
- Count badges showing how many posts per time slot

**Active Workflows**
- Compact list showing workflow categories and active counts
- Click category → filtered view in System Health Dashboard
- Color-coded status dots

**System Health Summary**
- CPU, RAM, Storage as progress bars with percentage
- Queue depth and browser session count
- Green/amber/red color based on thresholds
- Click → System Health Dashboard

**Recent Activity Feed**
- Chronological feed of system events
- Icon-coded by type: ✅ posted, 🎬 generated, ⚠️ alert, 💰 revenue, 🔄 warming, 🟣 approval needed
- Click any item → navigate to relevant detail view
- Auto-scrolling with WebSocket updates
- Configurable filters (show/hide event types)

---

## View 2: Account Manager

**Route**: `/accounts`

**Purpose**: Manage all email accounts, connected social accounts, channel identities, and assigned assets. The nerve center for the account infrastructure.

### Wireframe Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Accounts                              + Add Email  ⬆ Import │
├─────────────────────────────────────────────────────────────┤
│ 🔍 Search accounts...  │ Status: [All ▼] │ Platform: [All ▼]│
│ Niche: [All ▼] │ Tier: [All ▼] │ Health: [All ▼]           │
├───┬──────────────────┬────────┬─────────┬───────┬──────────┤
│ ☐ │ Email            │Socials │Channels │Health │ Status   │
├───┼──────────────────┼────────┼─────────┼───────┼──────────┤
│ ☐ │ acct001@gmail    │ 🎬📱📷 │ 3 ch    │ 🟢98% │ Active   │
│ ☐ │ acct002@gmail    │ 🎬📱   │ 2 ch    │ 🟡82% │ Warming  │
│ ☐ │ acct003@gmail    │ 🎬     │ 1 ch    │ 🔴45% │ Flagged  │
│ ☐ │ acct004@gmail    │ ──     │ 0 ch    │ ── ── │ Pending  │
│   │ ...              │        │         │       │          │
├───┴──────────────────┴────────┴─────────┴───────┴──────────┤
│ Showing 1-50 of 1,247  │ ◀ 1 2 3 ... 25 ▶  │ Per page: 50│
└─────────────────────────────────────────────────────────────┘
```

### Account Detail Panel (Slide-in from right, or dedicated page)

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Accounts          acct001@gmail.com     ● Active  │
├─────────────────────────────────────────────────────────────┤
│ TABS: [Overview] [Channels] [Assets] [Content] [Analytics] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ── OVERVIEW TAB ──                                          │
│                                                             │
│ ┌─ CONNECTED SOCIALS ────────────────────────────────────┐ │
│ │ 🎬 YouTube    ● Active   2 channels   ↗ View          │ │
│ │ 📱 TikTok     ● Active   @handle      ↗ View          │ │
│ │ 📷 Instagram  ● Active   @handle      ↗ View          │ │
│ │ 📘 Facebook   ○ Not set up            [+ Create]       │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ NICHES ───────────────────────────────────────────────┐ │
│ │ [Comedy] [History] [Affiliate - Shirts]   [+ Add]      │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ ACCOUNT HEALTH ──────────────────────────────────────┐ │
│ │ Overall: 98%                                           │ │
│ │ Last login: 2h ago │ Last post: 4h ago                 │ │
│ │ Warming status: Idle │ Sessions today: 3               │ │
│ │ IP: 192.168.x.x (proxy verified ✅)                   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ── CHANNELS TAB ──                                          │
│                                                             │
│ ┌─ Channel: FunnyHistory_EN (YouTube) ───────────────────┐ │
│ │ Language: English │ Niche: Comedy, History              │ │
│ │ Avatars: 🧑 Marcus, 👩 Cleo │ Voice: Marcus_EN_v2     │ │
│ │ Affiliate Pool: [HistoryShirts] [BookStore] [+ Add]    │ │
│ │ Posting: 2/day │ Best time: 10am, 4pm EST              │ │
│ │ Subscribers: 12,400 │ Avg views: 8,200                 │ │
│ │ Cinema Bible: ✅ Created │ [Edit] [View]                │ │
│ │ Family: FunnyHistory_ES, FunnyHistory_FR               │ │
│ │ [Edit Channel] [View Content] [View Analytics]         │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ Channel: FunnyHistory_ES (YouTube) ───────────────────┐ │
│ │ Language: Spanish │ Family: FunnyHistory                │ │
│ │ Avatars: 🧑 Marcus_ES │ Voice: Marcus_ES_v1            │ │
│ │ ...                                                     │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ── ASSETS TAB ──                                            │
│                                                             │
│ ┌─ AI AVATARS ───────────────────────────────────────────┐ │
│ │ [Face] [Waist] [Body] [Body Back]                      │ │
│ │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                       │ │
│ │ │ 😀  │ │ 🧍  │ │ 🧍  │ │ 🧍  │  Marcus               │ │
│ │ └─────┘ └─────┘ └─────┘ └─────┘                       │ │
│ │ Traits: Male, 30s, brown hair, blue eyes               │ │
│ │ Voice: Marcus_EN_v2 (ElevenLabs)                       │ │
│ │ [Edit] [Regenerate] [Assign to Channel]                │ │
│ │                                                         │ │
│ │ [+ Create New Avatar]                                   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ BRANDING ─────────────────────────────────────────────┐ │
│ │ Logo: [img] │ Banner: [img] │ Colors: #xxx #xxx        │ │
│ │ Fonts: Inter │ Templates: 3 saved                      │ │
│ │ [Edit Branding]                                         │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ SCENERY / BACKGROUNDS ────────────────────────────────┐ │
│ │ [🏙️ City] [🌄 Nature] [🏠 Studio]  [+ Add]            │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ VOICE / SOUND PROFILES ───────────────────────────────┐ │
│ │ Marcus_EN_v2 (ElevenLabs) │ Marcus_ES_v1 (ElevenLabs)  │ │
│ │ [▶ Preview] [Edit] [+ Add New Voice]                    │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

**Account Table**
- TanStack Table with: search, multi-column filter, sort, pagination, row selection (checkboxes)
- Social account icons (YouTube/TikTok/IG/FB) with presence indicators
- Health score as colored percentage badge
- Status as colored pill badge
- Bulk actions on selected rows: assign niche, change status, start warming, export
- Click row → Account Detail Panel

**Account Detail Panel**
- Tabbed interface: Overview, Channels, Assets, Content, Analytics
- Overview: connected socials with status, niche tags (editable), health metrics
- Channels: all channel identities under this account with full profile, family relationships, cinema bible status
- Assets: avatar gallery with multi-angle views, branding package, scenery library, voice profiles
- Content: filtered content library showing only this account's content
- Analytics: account-specific performance metrics

**Avatar Management (within Assets tab)**
- Grid of avatar angles (face, face-to-waist, full body front, full body back)
- Click angle → full-size view with generation metadata
- Edit: opens avatar creation wizard (trait selection → generate 3 variations → select → iterate)
- Regenerate: creates new variations with locked traits
- Assign to Channel: dropdown of available channels

**Add Email Modal**
- Single add: email + password fields
- Bulk import: CSV/JSON file upload with column mapping
- Preview of imported accounts before confirmation

---

## View 3: Content Calendar

**Route**: `/calendar`

**Purpose**: Visual overview of all scheduled, posted, and pending content across all channels and platforms. Drag-and-drop rescheduling. The operator's publishing command center.

### Wireframe Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Content Calendar                    [Day] [Week] [Month]    │
├─────────────────────────────────────────────────────────────┤
│ Filters: Account [All▼] Channel [All▼] Language [All▼]     │
│          Platform [All▼] Niche [All▼]  Status [All▼]       │
│          Color by: [Language ▼]                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ── WEEK VIEW (default) ──                                   │
│                                                             │
│         Mon 14    Tue 15    Wed 16    Thu 17    Fri 18      │
│ ┌──────┬─────────┬─────────┬─────────┬─────────┬─────────┐ │
│ │ 8am  │         │         │ 🟢 YT   │         │         │ │
│ │      │         │         │ FunHist  │         │         │ │
│ ├──────┼─────────┼─────────┼─────────┼─────────┼─────────┤ │
│ │ 10am │ 🟢 TT   │ 🟡 YT   │ 🟢 TT   │ 🟢 IG   │ 🟡 YT  │ │
│ │      │ Tech_EN │ FunH_ES │ Tech_EN │ Cook_EN │ Farm_EN│ │
│ ├──────┼─────────┼─────────┼─────────┼─────────┼─────────┤ │
│ │ 12pm │ 🟢 IG   │         │ 🟣 YT   │ 🟢 TT   │         │ │
│ │      │ Cook_EN │         │ PENDING │ Cook_EN │         │ │
│ ├──────┼─────────┼─────────┼─────────┼─────────┼─────────┤ │
│ │ 2pm  │ 🟢 TT   │ 🟢 TT   │ 🟢 IG   │         │ 🟢 TT  │ │
│ │      │ FunH_EN │ Tech_ES │ FunH_EN │         │ Tech_EN│ │
│ ├──────┼─────────┼─────────┼─────────┼─────────┼─────────┤ │
│ │ 4pm  │         │ 🟢 IG   │ 🟢 TT   │ 🟢 YT   │ 🟢 IG  │ │
│ │      │         │ Farm_EN │ Farm_EN │ FunH_EN │ Cook_EN│ │
│ └──────┴─────────┴─────────┴─────────┴─────────┴─────────┘ │
│                                                             │
│ 🟢 Posted  🟡 Scheduled  🟣 Needs Approval  🔴 Failed      │
│                                                             │
│ ┌─ LANGUAGE VARIANT GROUP (expandable) ──────────────────┐ │
│ │ FunnyHistory "Caesar's Day Off" (Mar 16, 10am)         │ │
│ │  🇬🇧 EN: Posted → FunnyHistory_EN (YT)                 │ │
│ │  🇪🇸 ES: Scheduled 11am → FunnyHistory_ES (YT)         │ │
│ │  🇫🇷 FR: Pending approval → FunnyHistory_FR (YT)        │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Interactions
- **Drag & drop**: Move content cards between time slots to reschedule
- **Click card**: Opens content detail/preview modal
- **Hover card**: Tooltip with title, channel, platform, status, quality score
- **Language variant grouping**: Toggle to group family variants together; expand to see individual variants
- **Color-coding**: Configurable — by language, by platform, by channel, by status
- **Day view**: Hour-by-hour detail for a single day
- **Month view**: Compact grid showing post counts per day with color intensity

---

## View 4: Content Creation Wizard

**Route**: `/create`

**Purpose**: Step-by-step guided content creation. The operator's primary workflow for producing new content. Must feel guided, not overwhelming.

### Wireframe Layout — Step-by-step Flow

```
STEP INDICATOR:
[1. Channel ✅] → [2. Concept ●] → [3. Script] → [4. Storyboard] → [5. Generate] → [6. Review]

┌─────────────────────────────────────────────────────────────┐
│ Create Content                                    Step 2/6  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ── STEP 1: SELECT CHANNEL ──                                │
│                                                             │
│ Channel: [FunnyHistory_EN          ▼]                       │
│                                                             │
│ ┌─ CHANNEL IDENTITY (auto-loaded) ───────────────────────┐ │
│ │ Language: English │ Niche: Comedy, History               │ │
│ │ Avatars: Marcus, Cleo │ Tone: Comedic, irreverent       │ │
│ │ Affiliate Pool: HistoryShirts, BookStore                 │ │
│ │ Cinema Bible: ✅ Loaded │ Last post: 2h ago              │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ── STEP 2: CONCEPT & CONFIGURATION ──                       │
│                                                             │
│ Topic/Concept: [Caesar's last day - played for comedy    ]  │
│                                                             │
│ Content Type:  [Short-form video ▼]                         │
│ Platform:      [YouTube Shorts ▼] [TikTok ▼] [Reels ▼]    │
│ Duration:      [30-60 seconds ▼]                            │
│ Video Style:   [Animated comedic ▼]                         │
│                                                             │
│ ┌─ AFFILIATE INTEGRATION ────────────────────────────────┐ │
│ │ Include affiliate? [Yes ▼]                              │ │
│ │ Product: [HistoryShirts - Roman Collection ▼]           │ │
│ │ Mode: [○ Dedicated product video                       │ │
│ │        ● Commercial break embed]                        │ │
│ │ Frequency: [1 mention ▼]                                │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ MULTI-LANGUAGE ───────────────────────────────────────┐ │
│ │ Generate for language family? [Yes ▼]                   │ │
│ │ ✅ English (FunnyHistory_EN)                            │ │
│ │ ✅ Spanish (FunnyHistory_ES)                            │ │
│ │ ✅ French  (FunnyHistory_FR)                            │ │
│ │ Video mode: [● Separate videos per language             │ │
│ │              ○ Single video, multi-language audio]       │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ AI Suggestions: 💡 "Roman comedy shorts avg 12% higher     │
│ engagement when using the 'dramatic irony' hook pattern.    │
│ Marcus as Caesar has a 8.7 avg quality score."              │
│                                                             │
│                              [← Back]  [Next: Script →]    │
│                                                             │
│ ── STEP 3: SCRIPT ──                                        │
│                                                             │
│ ┌─ GENERATED SCRIPT ─────────────────────────────────────┐ │
│ │ [HOOK - 0:00-0:03] (TENSION)                           │ │
│ │ Marcus (as Caesar): "Friends, Romans, countrymen..."    │ │
│ │                                                         │ │
│ │ [INTRO - 0:03-0:08] (INTIMATE)                         │ │
│ │ Marcus: "...lend me your ears. Actually, keep them.     │ │
│ │ Today's been rough."                                    │ │
│ │                                                         │ │
│ │ [CONTENT - 0:08-0:25] (MOMENTUM)                       │ │
│ │ ...                                                     │ │
│ │                                                         │ │
│ │ [AFFILIATE - 0:25-0:32] (CALM)                         │ │
│ │ Marcus: "Speaking of Roman fashion... today's toga is   │ │
│ │ brought to you by HistoryShirts.com..."                 │ │
│ │                                                         │ │
│ │ [CTA - 0:32-0:35] (POWER)                              │ │
│ │ Marcus: "Subscribe or I'll cross the Rubicon again."    │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ Beat tags visible │ Timing visible │ Affiliate marked       │
│ [✏️ Edit script] [🔄 Regenerate] [✅ Approve & continue]   │
│                                                             │
│ ── STEP 4: STORYBOARD ──                                    │
│                                                             │
│ ┌─ STORYBOARD EDITOR ───────────────────────────────────┐ │
│ │                                                         │ │
│ │ Shot 1 (0:00-0:03)  Shot 2 (0:03-0:08)  Shot 3 ...    │ │
│ │ ┌─────────────┐    ┌─────────────┐    ┌────────────┐  │ │
│ │ │ [img] [img] │    │ [img] [img] │    │ [img] [img]│  │ │
│ │ │  [img]      │    │  [img]      │    │  [img]     │  │ │
│ │ │ 3 variations│    │ 3 variations│    │ 3 variations│ │ │
│ │ └─────────────┘    └─────────────┘    └────────────┘  │ │
│ │                                                         │ │
│ │ ── TIMELINE ──                                          │ │
│ │ |▓▓▓|░░░░░|▓▓▓▓▓▓▓▓▓▓|░░░|▓▓▓▓|░░|▓▓▓|              │ │
│ │ S1   S2    S3          S4   S5   S6  S7                │ │
│ │                                                         │ │
│ │ Camera: [85mm CU ▼] │ Transition: [Cut ▼]              │ │
│ │ Style reco: "Use slow push-in for emotional beat"       │ │
│ │ Duration reco: "YT Shorts optimal at 32-45s"            │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ [✏️ Edit shots] [🔄 Regenerate all] [✅ Approve storyboard]│
│                                                             │
│ ── STEP 5: GENERATE ──                                      │
│                                                             │
│ ┌─ GENERATION PROGRESS ──────────────────────────────────┐ │
│ │ Generating video plates...                              │ │
│ │ ████████████░░░░░░░░░░░░░░ 45%                         │ │
│ │                                                         │ │
│ │ Shot 1: ✅ Complete (Veo3, $0.80)                       │ │
│ │ Shot 2: ✅ Complete (Veo3, $0.60)                       │ │
│ │ Shot 3: 🔄 Generating... (Kling)                        │ │
│ │ Shot 4: ⏳ Queued                                       │ │
│ │ ...                                                     │ │
│ │                                                         │ │
│ │ Audio: ✅ Dialogue generated (ElevenLabs)                │ │
│ │ Audio: ✅ SoundPlan created                              │ │
│ │ Audio: 🔄 Rendering via Remotion...                     │ │
│ │                                                         │ │
│ │ Est. cost: $4.20 │ Est. time: 3m remaining              │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ── STEP 6: REVIEW & APPROVE ──                              │
│                                                             │
│ ┌─ FINAL PREVIEW ────────────────────────────────────────┐ │
│ │ ┌───────────────────────────────┐                       │ │
│ │ │                               │  Title: Caesar's Day  │ │
│ │ │        VIDEO PLAYER           │  Channel: FunnyHist_EN│ │
│ │ │        (with audio)           │  Duration: 35s        │ │
│ │ │                               │  Quality: 8.4/10      │ │
│ │ │                               │  Cost: $4.20          │ │
│ │ └───────────────────────────────┘  Model: Veo3+Kling    │ │
│ │                                                         │ │
│ │ Platforms: YT Shorts ✅ │ TikTok ✅ │ Reels ✅           │ │
│ │ Affiliate: HistoryShirts ✅ (commercial break @ 0:25)   │ │
│ │ Languages: EN ✅ │ ES 🔄 generating │ FR 🔄 generating  │ │
│ │                                                         │ │
│ │ [✅ Approve & Schedule] [❌ Reject] [🔄 Regenerate]     │ │
│ │ [✏️ Edit & Revise] [💬 Add Feedback]                    │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## View 5: Content Library

**Route**: `/library`

**Purpose**: Searchable archive of all generated content assets — text, images, videos, voice-overs.

### Wireframe Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Content Library                              [Grid] [List]  │
├─────────────────────────────────────────────────────────────┤
│ 🔍 Search content...                                        │
│ Type: [All▼] Status: [All▼] Channel: [All▼] Model: [All▼] │
│ Date: [All time ▼]  Sort: [Newest ▼]                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│ │▶ thumb │ │▶ thumb │ │🖼 thumb│ │📝 text │ │▶ thumb │   │
│ │        │ │        │ │        │ │        │ │        │   │
│ │Caesar  │ │Tech    │ │Avatar  │ │Script  │ │Farm    │   │
│ │Short   │ │Review  │ │Marcus  │ │Draft   │ │Reel    │   │
│ │🟢Posted│ │🟡Sched │ │🟢Saved │ │🟡Draft │ │🟣Pend  │   │
│ │⭐ 8.4  │ │⭐ 7.9  │ │──      │ │──      │ │⭐ 8.1  │   │
│ │Veo3    │ │Kling   │ │ComfyUI │ │Claude  │ │Sora    │   │
│ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘   │
│                                                             │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│ │...     │ │...     │ │...     │ │...     │ │...     │   │
│ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘   │
│                                                             │
│ Showing 1-20 of 3,847  │ ◀ 1 2 3 ... 193 ▶               │
└─────────────────────────────────────────────────────────────┘
```

**Grid view**: Thumbnail cards with title, status badge, quality score, AI model attribution
**List view**: Table with columns — thumbnail, title, type, channel, model, score, status, date, performance metrics
**Click**: Opens content detail with full preview, generation metadata, performance history, version history

---

## View 6: Analytics Dashboard

**Route**: `/analytics`

**Purpose**: Business intelligence — revenue, costs, engagement, audience growth, competitive benchmarking. Data-driven decision making.

### Wireframe Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Analytics                     Period: [Last 30 days ▼]      │
│                               Compare: [Previous period ▼]  │
├─────────────┬──────────────┬──────────────┬────────────────┤
│ REVENUE     │ TOTAL COST   │ PROFIT       │ CONTENT        │
│ $12,450     │ $3,200       │ $9,250       │ 342 pieces     │
│ ↑ 18%       │ ↓ 5%         │ ↑ 24%        │ ↑ 12%          │
├─────────────┴──────────────┴──────────────┴────────────────┤
│                                                             │
│ TABS: [Revenue] [Engagement] [Content] [Costs] [Audience]  │
│                                                             │
│ ── REVENUE TAB ──                                           │
│                                                             │
│ ┌─ REVENUE OVER TIME (line chart) ───────────────────────┐ │
│ │     $500 ─                    ╱╲                        │ │
│ │     $400 ─              ╱───╱  ╲──╱╲                   │ │
│ │     $300 ─        ╱────╱            ╲──                │ │
│ │     $200 ─  ╱────╱                                     │ │
│ │     $100 ─╱                                            │ │
│ │           Mar 1    Mar 8    Mar 15                      │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ REVENUE BY CHANNEL ─────┬─ REVENUE BY PRODUCT ────────┐ │
│ │ FunnyHistory_EN  $2,100  │ HistoryShirts      $3,400   │ │
│ │ TechReviews_EN   $1,800  │ BookStore           $2,100   │ │
│ │ CookingWith_EN   $1,200  │ SockStore           $1,800   │ │
│ │ ...              ...     │ ...                 ...      │ │
│ │           [View all →]   │           [View all →]       │ │
│ └──────────────────────────┴─────────────────────────────┘ │
│                                                             │
│ ┌─ ROI BY CONTENT TYPE ──────────────────────────────────┐ │
│ │ Short-form video: Cost $1.20 avg → Revenue $8.40 = 7x  │ │
│ │ Long-form video:  Cost $4.80 avg → Revenue $22.10 = 4.6x│ │
│ │ Image post:       Cost $0.30 avg → Revenue $1.20 = 4x  │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ [📤 Export CSV] [📤 Export PDF]                             │
└─────────────────────────────────────────────────────────────┘
```

**Sub-tabs**: Revenue, Engagement (views/likes/shares/comments by platform), Content (production metrics, quality scores, model performance), Costs (per-model, per-workflow, per-account breakdowns), Audience (growth, demographics, behavioral patterns)

---

## View 7: System Health Dashboard

**Route**: `/system`

**Purpose**: Real-time monitoring of all system components, resource usage, active workflows, errors, and alerts.

### Wireframe Layout

```
┌─────────────────────────────────────────────────────────────┐
│ System Health                              All Systems: 🟢  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─ RESOURCE USAGE ───────────────────────────────────────┐ │
│ │ CPU  ████████████░░░░░░░░ 62%   │ Target: <95%        │ │
│ │ RAM  ██████████░░░░░░░░░░ 48%   │ 246/512 GB          │ │
│ │ Disk █████░░░░░░░░░░░░░░░ 31%   │ 4.9/16 TB           │ │
│ │ Net  ████░░░░░░░░░░░░░░░░ 22%   │ 45 Mbps / 1 Gbps   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ SERVICES ─────────────────────────────────────────────┐ │
│ │ PostgreSQL      🟢 Running │ 12GB RAM │ 234 conn       │ │
│ │ Next.js         🟢 Running │ 3GB RAM  │ Port 3000      │ │
│ │ Workflow Engine  🟢 Running │ 6GB RAM  │ 30 jobs queue  │ │
│ │ Ollama          🟢 Running │ 80GB RAM │ 2 models loaded│ │
│ │ Playwright      🟢 Running │ 15GB RAM │ 8 sessions     │ │
│ │ BullMQ Workers  🟢 Running │ 5GB RAM  │ 4 workers      │ │
│ │ MinIO           🟢 Running │ 2GB RAM  │ 4.9TB used     │ │
│ │ AI Assistant    🟢 Running │ 4GB RAM  │ Active         │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ ACTIVE WORKFLOWS ────────────┬─ RECENT ERRORS ────────┐ │
│ │ ● Content Production    4     │ ⚠️ 2h ago: Kling API   │ │
│ │   ├ Video render: 35%  ETA 4m │    timeout (retried ✅) │ │
│ │   ├ Script gen: Done          │ 🔴 5h ago: acct_427    │ │
│ │   ├ Audio mix: Queued         │    IG login failed      │ │
│ │   └ Thumbnail: Queued         │    [View] [Resolve]     │ │
│ │ ● Account Warming      23    │                         │ │
│ │ ● Account Creation     2     │ Errors today: 3         │ │
│ │ ● Research             1     │ Resolved: 2             │ │
│ │                   View all → │ Open: 1      View all → │ │
│ └───────────────────────────────┴────────────────────────┘ │
│                                                             │
│ ┌─ ALERTS ───────────────────────────────────────────────┐ │
│ │ 🟡 WARN: Proxy pool below 50 IPs (was 100)            │ │
│ │          [Acknowledge] [Snooze 1h] [View details]      │ │
│ │ 🟢 INFO: Daily backup completed successfully            │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## View 8: Affiliate Manager

**Route**: `/affiliate`

**Purpose**: Manage affiliate products, channel pool assignments, link tracking, storefronts, and revenue per product.

### Wireframe Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Affiliate Manager                         [+ Add Product]   │
├─────────────────────────────────────────────────────────────┤
│ TABS: [Products] [Channel Pools] [Links] [Storefronts]     │
│       [Performance]                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ── PRODUCTS TAB ──                                          │
│                                                             │
│ 🔍 Search products...  │ Category: [All▼] │ Status: [All▼] │
│                                                             │
│ ┌────┬──────────────┬──────────┬────────┬────────┬────────┐│
│ │    │ Product      │ Category │ Commis.│ Clicks │Revenue ││
│ ├────┼──────────────┼──────────┼────────┼────────┼────────┤│
│ │ 🖼 │HistoryShirts │ Apparel  │ 15%    │ 2,340  │ $1,200 ││
│ │ 🖼 │BookStore Pro │ Education│ 8%     │ 1,890  │ $890   ││
│ │ 🖼 │SockStore     │ Apparel  │ 12%    │ 456    │ $230   ││
│ └────┴──────────────┴──────────┴────────┴────────┴────────┘│
│                                                             │
│ ── CHANNEL POOLS TAB ──                                     │
│                                                             │
│ Channel: [FunnyHistory_EN ▼]                                │
│                                                             │
│ ┌─ ASSIGNED PRODUCTS ────────────────────────────────────┐ │
│ │ ✅ HistoryShirts (15% commission)        [Remove]      │ │
│ │ ✅ BookStore Pro (8% commission)          [Remove]      │ │
│ │                                                         │ │
│ │ 💡 Auto-suggested based on niche:                      │ │
│ │ ○ AncientArtifacts.com (10% commission)   [+ Add]      │ │
│ │ ○ HistoryPodcastPro (12% commission)      [+ Add]      │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ── PERFORMANCE TAB ──                                       │
│                                                             │
│ ┌─ PRODUCT × CHANNEL PERFORMANCE MATRIX ─────────────────┐ │
│ │           │ FunHist_EN │ Tech_EN │ Cook_EN │ Farm_EN   │ │
│ │ HistShirt │ $890  ⭐   │ $120    │ $45     │ $15       │ │
│ │ BookStore │ $340       │ $450 ⭐ │ $100    │ $0        │ │
│ │ SockStore │ $30        │ $15     │ $85     │ $100 ⭐   │ │
│ │                                                         │ │
│ │ ⭐ = Best performing channel for this product           │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## View 9: Settings

**Route**: `/settings`

**Purpose**: System configuration, AI service management, proxy settings, notification preferences, and system maintenance.

### Key Settings Sections

```
┌─────────────────────────────────────────────────────────────┐
│ Settings                                                    │
├─────────────────────────────────────────────────────────────┤
│ TABS: [General] [AI Services] [Proxies] [Notifications]    │
│       [Security] [Data] [Appearance]                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ── AI SERVICES TAB ──                                       │
│                                                             │
│ ┌─ REGISTERED SERVICES ──────────────────────────────────┐ │
│ │ OpenAI GPT-4     🟢 Healthy  │ $0.03/1K tok │ [Edit]  │ │
│ │ Claude Sonnet    🟢 Healthy  │ $0.003/1K    │ [Edit]  │ │
│ │ Ollama Llama3    🟢 Local    │ Free         │ [Edit]  │ │
│ │ Veo3             🟢 Healthy  │ $0.20/sec    │ [Edit]  │ │
│ │ ElevenLabs       🟡 Degraded │ $0.30/1K chr │ [Edit]  │ │
│ │ ComfyUI          🟢 Local    │ Free         │ [Edit]  │ │
│ │                                                         │ │
│ │ [+ Add Service] [🔄 Health Check All]                   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ FALLBACK CHAINS ──────────────────────────────────────┐ │
│ │ Text:  Ollama → Claude → GPT-4 → DeepSeek              │ │
│ │ Image: ComfyUI → DALL-E → Midjourney → Flux             │ │
│ │ Video: Veo3 → Kling → Sora → Runway                    │ │
│ │ Voice: ElevenLabs → OpenAI TTS → PlayHT                │ │
│ │ [Edit Chains]                                           │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ── NOTIFICATIONS TAB ──                                     │
│                                                             │
│ ┌─ ALERT CHANNELS ──────────────────────────────────────┐ │
│ │ Dashboard: ✅ Always on                                 │ │
│ │ Email: ✅ akmauri@... │ Critical + Warning              │ │
│ │ Slack: ✅ #alerts channel │ All alerts                  │ │
│ │ SMS: ○ Not configured │ [Configure]                    │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ ESCALATION POLICY ───────────────────────────────────┐ │
│ │ Step 1: Dashboard + Slack (immediate)                   │ │
│ │ Step 2: Email (after 15 min unacknowledged)             │ │
│ │ Step 3: SMS (after 30 min unacknowledged)               │ │
│ │ [Edit Policy]                                           │ │
│ └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Responsive Design Breakpoints

| Breakpoint | Width | Layout Changes |
|---|---|---|
| Desktop XL | ≥1440px | Full layout with AI panel open by default |
| Desktop | ≥1024px | Full layout, AI panel collapsed by default |
| Tablet | ≥768px | Sidebar collapsed to icons, AI panel overlay |
| Mobile | <768px | Sidebar hidden (hamburger menu), full-width content, AI panel full-screen overlay |

### Mobile-Specific Adaptations
- Bottom navigation bar replaces sidebar (5 primary items: Home, Calendar, Create, Library, More)
- Cards stack vertically
- Tables switch to card-based list view
- Charts simplified (fewer data points, larger touch targets)
- Swipe gestures for approval (swipe right = approve, swipe left = reject)
- Pull-to-refresh on all data views

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+K` | Global search |
| `Cmd+N` | New content (opens Create wizard) |
| `Cmd+/` | Toggle AI Assistant panel |
| `Cmd+Shift+A` | Go to Approval Queue |
| `Cmd+1-9` | Navigate to sidebar items (1=Home, 2=Accounts, etc.) |
| `A` | Approve (in approval queue) |
| `R` | Reject (in approval queue) |
| `G` | Regenerate (in approval queue) |
| `←/→` | Previous/next item in approval queue |
| `Esc` | Close modal/panel |

---

## Real-Time Update Strategy

**WebSocket Events (via socket.io)**

| Event | Updates | Views Affected |
|---|---|---|
| `workflow:progress` | Workflow completion %, ETA | Home, System, Create (Step 5) |
| `content:status` | Content status change | Calendar, Library, Home |
| `account:health` | Account health change | Accounts, Home |
| `alert:new` | New system alert | System, notification bell |
| `approval:new` | New item in approval queue | Home badge, notification |
| `revenue:update` | New affiliate click/conversion | Analytics, Affiliate, Home |
| `system:metrics` | CPU/RAM/disk/network updates | Status bar, System |

**Update Strategy**: Optimistic UI updates where possible (approve → immediately update UI, reconcile with server response). Reconnection with exponential backoff on WebSocket disconnect. Fallback to polling (30s interval) if WebSocket unavailable.

---

## Accessibility Requirements

- WCAG 2.1 AA compliance minimum
- All interactive elements keyboard-navigable
- Screen reader support via proper ARIA labels
- Color is never the only indicator (always paired with icons or text)
- Focus indicators visible on all interactive elements
- Minimum touch target: 44×44px on mobile
- Reduced motion preference respected (disable animations when `prefers-reduced-motion` is set)

---

## Component Library (shadcn/ui Extensions)

### Custom Components Needed (Built on shadcn/ui Primitives)

| Component | Base | Purpose |
|---|---|---|
| `StatusBadge` | Badge | Consistent status colors across all views |
| `KPICard` | Card | Metric + trend + link used on Home and Analytics |
| `ChannelIdentityCard` | Card | Full channel profile summary |
| `AvatarGallery` | Custom | Multi-angle avatar display with generation controls |
| `ApprovalCard` | Card | Content preview + approve/reject/regenerate actions |
| `ContentThumbnail` | Card | Grid item for Content Library |
| `BeatTagBadge` | Badge | Emotional preset tags in script editor |
| `TimelineBar` | Custom | Horizontal publishing timeline on Home |
| `FilterBar` | Custom | Multi-filter row used across tables and calendar |
| `StoryboardEditor` | Custom | Drag-and-drop shot editor with timeline |
| `CinemaBibleEditor` | Custom | Tabbed editor for Look/Character/Environment/Prompt bibles |
| `AIChatWidget` | Custom | Floating AI assistant with context awareness |
| `ResourceBar` | Custom | CPU/RAM/Storage indicators in status bar and System view |

---

**Document Version**: 1.0
**Created**: March 16, 2026
**Author**: Sally (UX Expert Agent)
**Status**: Draft — Awaiting Review
