# Tab Revolver Player V1 — Implementation Tasks

Parent PRD: V1 Design Decisions (resolved 2026-05-22 via design interview)

Backend repo: `../tab-revolver-web/`
Electron repo: `./` (greenfield — delete existing code, start fresh)

---

## Task 1: Greenfield scaffold

- [x] Finished

### What to build

Initialize a fresh Electron + React project using electron-vite as the build tool. The app should boot, create a BrowserWindow, and render a React 19 component with Tailwind CSS v4 and shadcn/ui initialized. Delete all existing code first — this is a clean slate.

**Stack versions:**
- Electron 35+
- React 19
- TypeScript 5.8
- Vite 6 (via electron-vite)
- Tailwind CSS v4
- shadcn/ui (latest)

The scaffold should include:
- electron-vite config with separate main/preload/renderer entries
- TypeScript configs for main and renderer
- Tailwind v4 setup (CSS-first config, no PostCSS plugin)
- shadcn/ui initialized with a dark theme matching signage aesthetic (bg: #0a0a0a)
- Basic index.html + main.tsx mounting a React root
- A "Hello World" component confirming React + Tailwind render correctly
- .gitignore for node_modules, dist, out, release
- package.json with correct scripts (dev, build, preview)

### Acceptance criteria

- [x] `npm run dev` boots Electron and shows a React-rendered window
- [x] Tailwind utility classes work in components
- [x] shadcn/ui Button component renders correctly
- [x] TypeScript compilation has zero errors
- [x] electron-vite HMR works (edit React component, see changes without restart)
- [x] All existing code from the old scaffold is removed

### Blocked by

None — can start immediately

### User stories addressed

- Project foundation for all subsequent work

---

## Task 2: IPC bridge + secure preload

- [x] Finished

### What to build

Create the secure IPC communication layer between main and renderer processes. This is the backbone of all Electron-specific features.

**Preload script (`src/preload/index.ts`):**
- contextBridge.exposeInMainWorld with typed API
- Methods: `invoke(channel, ...args)`, `send(channel, ...args)`, `on(channel, callback)`
- Only expose whitelisted channels

**Type definitions (`src/shared/ipc.ts`):**
- Typed IPC channel names as const enum or string union
- Request/response types per channel
- Channels to define (handlers come later):
  - `get-monitors` → Display[]
  - `set-display` → void
  - `show-website` → void
  - `hide-website` → void
  - `get-system-memory` → { total: number, free: number }
  - `store-get` / `store-set` → electron-store operations
  - `app-restart` → void
  - `toggle-kiosk` → void

**Main process window config:**
- contextIsolation: true
- nodeIntegration: false
- sandbox: true
- webSecurity: true

### Acceptance criteria

- [x] Preload script exposes typed IPC API on `window.electronAPI`
- [x] TypeScript types shared between main and renderer
- [x] contextIsolation is enabled, nodeIntegration is disabled
- [x] Renderer cannot access Node.js APIs directly
- [x] A simple test IPC call (e.g., get-monitors) round-trips successfully

### Blocked by

- Blocked by Task 1

### User stories addressed

- Electron security requirements
- IPC bridge architecture

---

## Task 3: Zustand stores + TanStack Query + app routing

- [ ] Finished

### What to build

Set up the state management layer and application-level view routing.

**Zustand stores:**
- `useAuthStore`: deviceToken (string | null), firebaseUser (User | null), isAuthenticated computed, logout action
- `useAppStore`: currentView ('pairing' | 'picker' | 'player'), selectedMonitorId, navigate action
- `usePlaylistStore`: playlists (Playlist[]), selectedPlaylistId, currentItemIndex, isPlaying, rotation actions (next, prev, pause, resume, skip)

**TanStack Query:**
- QueryClientProvider wrapping the app
- Default config: staleTime 30s, retry 3, refetchOnWindowFocus false (signage app)

**App routing (src/App.tsx):**
- Read currentView from useAppStore
- Render: PairingScreen | PlaylistPicker | PlayerScreen (placeholder components for now)
- On mount: check if deviceToken exists in electron-store → skip to picker/player if authenticated

**Types (src/shared/types.ts):**
- Playlist: { id, name, tabs: PlaylistTab[], defaultInterval, emoji, version, updatedAt }
- PlaylistTab: { interval, title, type, url }
- Screen: { id, screenName, deviceToken, lastSeen, displayId, nowPlayingPlaylistId }
- UserPlan: { plan, planExpiresAt, screens }

### Acceptance criteria

- [ ] All three Zustand stores are functional with actions
- [ ] TanStack Query provider wraps the app
- [ ] App renders different placeholder screens based on currentView
- [ ] Types match the existing backend data model (tab-revolver-web)
- [ ] Hot reloading preserves store state

### Blocked by

- Blocked by Task 1

### User stories addressed

- State management foundation
- Playlist data model conformance

---

## Task 4: PIN + QR pairing screen UI

- [ ] Finished

### What to build

The first screen users see when the app boots on an unpaired device. Shows a QR code and a manual PIN input field.

**QR Code display:**
- Generate a QR code pointing to the web dashboard pairing page (e.g., `https://dashboard.tabrevolver.com/pair?device=DEVICE_ID`)
- Use a lightweight QR library (e.g., `qrcode.react`)
- Large, centered QR code with instructional text: "Scan to pair this display"

**PIN input:**
- 4-digit numeric input below the QR code
- Text: "Or enter your PIN from the dashboard"
- shadcn/ui Input + Button components
- Submit triggers pairing flow (calls a mocked handler for now — real handler in Task 6)

**Layout:**
- Centered card on dark background
- App logo/name at top
- QR code prominently displayed
- PIN input below as alternative
- Subtle footer with app version

**Behavior:**
- On boot: check if device is already paired (deviceToken in electron-store). If yes, skip to playlist picker.
- On successful pair: navigate to picker view

### Acceptance criteria

- [ ] QR code renders with a valid URL
- [ ] 4-digit PIN input accepts only numbers
- [ ] Submit button triggers pairing action (mocked)
- [ ] Screen is visually polished with shadcn/ui + Tailwind
- [ ] Responsive to different window sizes
- [ ] Already-paired devices skip this screen

### Blocked by

- Blocked by Task 2, Task 3

### User stories addressed

- Onboarding flow
- PIN + QR code pairing (smart TV model)

---

## Task 5: Backend — POST /api/screens/auth endpoint

- [ ] Finished

### What to build

**In the tab-revolver-web codebase**, add a new API endpoint that exchanges a deviceToken for a Firebase custom token. This enables the Electron app to authenticate to Firestore without a Google login on the device.

**Endpoint: POST /api/screens/auth**

Request body:
```json
{ "deviceToken": "uuid-string" }
```

Logic:
1. Look up the screen document in Firestore `screens` collection where `deviceToken` matches
2. Verify the screen exists and is not soft-deleted
3. Get the `userId` from the screen document
4. Generate a Firebase custom token via `admin.auth().createCustomToken(userId, { screenId: screen.id, isDevice: true })`
5. Return `{ customToken: "...", userId: "...", screenId: "..." }`

Error cases:
- 401: Invalid or unknown deviceToken
- 404: Screen not found or deleted
- 500: Firebase custom token generation failure

**Important:** This endpoint does NOT require the standard Bearer token auth header — the deviceToken IS the authentication. Add rate limiting consideration (comment/TODO).

### Acceptance criteria

- [ ] POST /api/screens/auth accepts deviceToken and returns Firebase custom token
- [ ] Invalid deviceToken returns 401
- [ ] Soft-deleted screen returns 404
- [ ] Custom token includes screenId and isDevice claims
- [ ] Endpoint works against the `tabrevdatabase` Firestore database

### Blocked by

None — can start immediately (different codebase: ../tab-revolver-web/)

### User stories addressed

- Device authentication
- PIN pairing → Firestore access bridge

---

## Task 6: Device auth flow (PIN → deviceToken → Firebase custom token)

- [ ] Finished

### What to build

Wire up the full authentication flow from PIN entry to Firebase authentication.

**Flow:**
1. User enters PIN on pairing screen
2. Renderer calls IPC `pair-device` with PIN
3. Main process calls POST /api/screens/connect with PIN → receives screen data including deviceToken
4. Main process stores deviceToken in electron-store (encrypted)
5. Main process calls POST /api/screens/auth with deviceToken → receives Firebase custom token
6. Return custom token to renderer
7. Renderer calls `signInWithCustomToken(auth, customToken)` via Firebase Web SDK
8. On success: update useAuthStore, navigate to playlist picker

**electron-store setup:**
- Install electron-store
- Encryption key derived from machine-specific data
- Store keys: deviceToken, screenId, userId

**IPC handlers in main process:**
- `pair-device`: accepts PIN, calls both API endpoints, stores token, returns custom token
- `get-stored-auth`: returns stored deviceToken (for auto-login on boot)
- `clear-auth`: removes all stored auth data (for logout/unpair)

**Auto-login on boot:**
- Check electron-store for existing deviceToken
- If found, call POST /api/screens/auth to get fresh custom token
- If successful, auto-authenticate and skip to picker
- If failed (device removed), clear store and show pairing screen

### Acceptance criteria

- [ ] PIN entry triggers the full pairing + auth chain
- [ ] deviceToken persists in encrypted electron-store
- [ ] Firebase signInWithCustomToken succeeds
- [ ] App auto-logins on restart if previously paired
- [ ] Logout/unpair clears stored credentials
- [ ] Failed re-auth (revoked device) falls back to pairing screen

### Blocked by

- Blocked by Task 4, Task 5

### User stories addressed

- Authentication flow
- Token storage (electron-store encrypted)
- Device pairing

---

## Task 7: Firebase Web SDK + Firestore real-time playlist listener

- [ ] Finished

### What to build

Initialize the Firebase Web SDK in the renderer process and set up real-time Firestore listeners for playlist data.

**Firebase setup (src/renderer/lib/firebase.ts):**
- Initialize Firebase app with project config (same config as tab-revolver-web client)
- Export auth and firestore instances
- Use the named database `tabrevdatabase`

**Firestore listener (src/renderer/lib/playlistListener.ts):**
- After Firebase auth succeeds (signInWithCustomToken), start listener
- `onSnapshot` on `playlists` collection where `userId == currentUser.uid` and `deleted != true`
- On snapshot update: sync to usePlaylistStore
- Handle listener errors (permission denied → logout, network error → retry)
- Clean up listener on logout/unmount

**Integration with stores:**
- usePlaylistStore.setPlaylists() called on each snapshot
- If currently playing playlist is updated, apply changes live (new items, removed items, changed intervals)
- If currently playing playlist is deleted, stop playback and return to picker

### Acceptance criteria

- [ ] Firebase initializes with correct project config
- [ ] Firestore listener receives playlist data after auth
- [ ] Playlist changes on web dashboard appear in Electron app within seconds
- [ ] Deleted playlists are filtered out
- [ ] Listener cleans up on logout
- [ ] Network interruption doesn't crash the listener (auto-reconnects)

### Blocked by

- Blocked by Task 6

### User stories addressed

- Playlist sync (real-time)
- Firestore real-time listeners

---

## Task 8: Playlist picker screen

- [ ] Finished

### What to build

Screen shown after pairing (or on boot if authenticated) where the user selects which playlist to play.

**UI:**
- Grid/list of available playlists from usePlaylistStore
- Each card shows: emoji, name, tab count, last updated
- Click to select → starts playback
- If only one playlist exists, auto-select and go to player immediately

**Behavior:**
- Subscribes to usePlaylistStore (real-time updates via Firestore)
- Empty state: "No playlists yet. Create one on the dashboard."
- Loading state: spinner while waiting for first Firestore snapshot
- After selection: set selectedPlaylistId in store, navigate to player view

**Layout:**
- Centered container, responsive grid
- Dark theme, shadcn/ui Card components
- Header: "Choose a playlist" with device name
- Footer: link/text pointing to web dashboard URL

### Acceptance criteria

- [ ] Playlists render from Firestore data
- [ ] Single-playlist auto-selects and navigates to player
- [ ] Multiple playlists show picker UI
- [ ] Empty state shows helpful message
- [ ] Loading state shows while waiting for data
- [ ] Real-time updates reflect (new playlist appears without refresh)

### Blocked by

- Blocked by Task 7, Task 3

### User stories addressed

- Onboarding flow (choose playlist)
- Playlist display

---

## Task 9: TanStack Query — plan info + screen management

- [ ] Finished

### What to build

Set up TanStack Query hooks for non-realtime API calls: user plan info and screen management.

**Hooks:**
- `usePlanInfo(userId)`: GET /api/plan/[uid] → { plan, planExpiresAt, screens, trial }
- `useUpdateScreen(screenId)`: PUT /api/screens/[id] — update screen metadata (e.g., nowPlayingPlaylistId)
- `useHeartbeat()`: PATCH /api/users/[userId]/sync-timestamp — periodic heartbeat to update lastSeen

**API client (src/renderer/lib/api.ts):**
- Base URL from environment (hardcoded production + env override)
- Auth header: Firebase ID token from current user (await user.getIdToken())
- Error handling: 401 → trigger re-auth, 500 → retry via TanStack Query

**Plan-aware UX:**
- Expose plan info via a `usePlan()` hook
- Show subtle upgrade prompt in playlist picker if on free tier
- Plan data used for UX hints only (backend enforces limits)

**Heartbeat:**
- Run every 5 minutes while app is active
- Updates screen's `lastSeen` timestamp on backend
- Allows dashboard to show "online/offline" status per screen

### Acceptance criteria

- [ ] Plan info fetches and displays correctly
- [ ] Screen metadata updates via PUT
- [ ] Heartbeat runs every 5 minutes
- [ ] API client handles auth token refresh
- [ ] Free tier shows upgrade hint in picker
- [ ] API base URL is configurable via environment variable

### Blocked by

- Blocked by Task 6, Task 3

### User stories addressed

- Plan enforcement (UX hints)
- Screen management
- Backend integration

---

## Task 10: Player skeleton + rotation engine

- [ ] Finished

### What to build

The core playback engine that rotates through playlist items on a timer.

**Rotation engine (src/renderer/hooks/useRotation.ts):**
- Takes playlist tabs array and manages rotation
- Each tab has an `interval` (seconds) — use as duration for that item
- Timer counts down, advances to next item when expired
- Loop: after last item, return to first
- Actions: play, pause, resume, skip (next), previous
- Expose: currentIndex, timeRemaining, isPlaying, totalItems

**Player screen (src/renderer/pages/Player.tsx):**
- Full viewport, no chrome
- Content area: renders current item (placeholder colored div for now, showing type + URL)
- Progress bar at bottom: thin line showing time remaining for current item
- Preload flag: set `nextIndex` so scene renderers can preload

**Store integration:**
- On mount: read selectedPlaylistId, get tabs from usePlaylistStore
- If playlist updates via Firestore while playing: handle gracefully (don't reset position unless current item was removed)
- Update screen's `nowPlayingPlaylistId` via TanStack Query mutation

### Acceptance criteria

- [ ] Rotation advances through items based on interval timing
- [ ] Progress bar shows time remaining
- [ ] Pause/resume works correctly
- [ ] Skip advances immediately to next item
- [ ] Playlist wraps from last to first item
- [ ] Live playlist updates don't disrupt playback (unless current item removed)

### Blocked by

- Blocked by Task 8

### User stories addressed

- Fullscreen slideshow
- Playlist playback rotation

---

## Task 11: Image scene renderer

- [ ] Finished

### What to build

Render image playlist items as full-screen background images.

**ImageScene component (src/renderer/scenes/ImageScene.tsx):**
- Props: `url: string`, `isActive: boolean`, `onReady: () => void`, `onError: () => void`
- Render as `<img>` with object-fit: cover, filling the entire viewport
- Preload: when `isActive` becomes true but image isn't loaded yet, show nothing (preload in background)
- `onReady` fires when image loads (lets rotation engine know it's visible)
- `onError` fires on load failure (rotation engine skips this item)

**Preloading:**
- Accept an `isPreloading` prop
- When true, start loading the image but don't display it
- Use `new Image()` to prefetch, then swap to visible when `isActive`

**Error handling:**
- If image URL returns 404 or network error, call onError
- Log error via IErrorReporter interface (placeholder)

### Acceptance criteria

- [ ] Images render full-screen with object-fit: cover
- [ ] Images preload before becoming active (no flash)
- [ ] Failed image loads trigger onError (skip to next)
- [ ] Different aspect ratios handled gracefully (no distortion)
- [ ] Large images don't cause visible layout shift

### Blocked by

- Blocked by Task 10

### User stories addressed

- Image support in slideshow
- Preload next scene

---

## Task 12: Video scene renderer

- [ ] Finished

### What to build

Render video playlist items using HTML5 video element.

**VideoScene component (src/renderer/scenes/VideoScene.tsx):**
- Props: `url: string`, `isActive: boolean`, `onReady: () => void`, `onError: () => void`, `onEnded: () => void`
- HTML5 `<video>` element: autoplay, muted, loop=false
- `onReady` fires on `canplay` event
- `onEnded` fires when video finishes (advance to next item regardless of interval timer)
- `onError` fires on load failure

**Behavior:**
- Video fills viewport (object-fit: cover)
- Starts playing automatically when isActive
- Pauses when no longer active
- If video duration < playlist interval: loop until interval expires
- If video duration > playlist interval: play full video, advance when ended

**Preloading:**
- Accept `isPreloading` prop
- When true, set `preload="auto"` but don't play

### Acceptance criteria

- [ ] Videos autoplay muted when active
- [ ] Videos pause when no longer active (cleanup)
- [ ] onEnded triggers advancement
- [ ] Videos preload before becoming active
- [ ] Failed video loads trigger onError
- [ ] Object-fit: cover fills viewport without distortion

### Blocked by

- Blocked by Task 10

### User stories addressed

- Video support in slideshow
- Preload next scene

---

## Task 13: Website scene via WebContentsView

- [ ] Finished

### What to build

Render website playlist items using Electron's WebContentsView (NOT the deprecated BrowserView). This is the most complex scene type — websites render in a separate process managed by the main process, overlaid on the renderer window.

**Main process — WebContentsView manager (src/main/webContentsManager.ts):**
- Create WebContentsView instances for website URLs
- Position WebContentsView to fill the BrowserWindow bounds
- IPC handlers:
  - `show-website`: create or reuse a WebContentsView for URL, position it, make visible
  - `hide-website`: hide the current WebContentsView (don't destroy — for LRU in Task 16)
  - `resize-website`: update bounds when window resizes
- WebContentsView config: allow popups=false, javascript=true

**Renderer — WebsiteScene component (src/renderer/scenes/WebsiteScene.tsx):**
- Props: `url: string`, `isActive: boolean`, `onReady: () => void`, `onError: () => void`
- When isActive: call IPC `show-website` with URL
- When inactive: call IPC `hide-website`
- `onReady` fires when IPC confirms the page loaded (did-finish-load event from main)
- `onError` fires on load failure (did-fail-load)

**Window resize handling:**
- Listen for BrowserWindow resize events
- Reposition all visible WebContentsViews to match new bounds

### Acceptance criteria

- [ ] Websites render in a WebContentsView overlaying the window
- [ ] WebContentsView fills the entire window bounds
- [ ] Multiple websites can be created (one visible at a time)
- [ ] show/hide via IPC works correctly
- [ ] Window resize repositions the WebContentsView
- [ ] Page load success/failure reported back to renderer

### Blocked by

- Blocked by Task 2, Task 10

### User stories addressed

- Website rendering (NOT iframe)
- Dashboard display (Grafana, PowerBI)
- WebContentsView architecture

---

## Task 14: YouTube embed URL auto-conversion

- [ ] Finished

### What to build

Detect YouTube URLs in playlist items and auto-convert them to embed format for rendering via WebContentsView.

**URL converter (src/shared/youtube.ts):**
- Input patterns to detect:
  - `youtube.com/watch?v=VIDEO_ID`
  - `youtu.be/VIDEO_ID`
  - `youtube.com/embed/VIDEO_ID` (already embed, pass through)
  - `youtube.com/shorts/VIDEO_ID`
- Output: `youtube.com/embed/VIDEO_ID?autoplay=1&mute=1&controls=0&loop=1`
- Add query params: autoplay, mute, hide controls, loop
- `isYouTubeUrl(url: string): boolean` helper

**Integration with SceneRenderer:**
- When rendering a website-type item, check if URL is YouTube
- If yes, convert to embed URL before passing to WebsiteScene
- YouTube embeds render via WebContentsView just like any other website

### Acceptance criteria

- [ ] All YouTube URL formats convert to embed format
- [ ] Embed URL includes autoplay, mute, no-controls params
- [ ] Non-YouTube URLs pass through unchanged
- [ ] YouTube videos play in WebContentsView without user interaction
- [ ] URL converter has unit tests (Vitest)

### Blocked by

- Blocked by Task 13

### User stories addressed

- YouTube video support in slideshow

---

## Task 15: Framer Motion transitions for images/videos

- [ ] Finished

### What to build

Add smooth fade transitions between image and video scenes. Per design decision: websites get instant cut (no transition), only media scenes animate.

**SceneRenderer component (src/renderer/scenes/SceneRenderer.tsx):**
- Central router that renders the correct scene type based on playlist item
- Wraps image and video scenes in AnimatePresence
- Transition: fade (opacity 0 → 1 on enter, 1 → 0 on exit)
- Duration: 0.5s (configurable later)
- Website scenes: no AnimatePresence wrapper — instant show/hide via IPC

**Implementation:**
- `motion.div` wrapper with `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, `exit={{ opacity: 0 }}`
- `key` prop on scene component = current item ID or index (triggers AnimatePresence swap)
- Ensure exit animation completes before next scene's enter begins (mode="wait" or custom orchestration)

### Acceptance criteria

- [ ] Image → Image transitions fade smoothly
- [ ] Video → Image (and reverse) transitions fade smoothly
- [ ] Website scenes have instant cut (no fade)
- [ ] No layout flash or content overlap during transitions
- [ ] Transitions don't interfere with video playback or image loading

### Blocked by

- Blocked by Task 11, Task 12

### User stories addressed

- Smooth transitions (Framer Motion)
- Fade transition for media scenes

---

## Task 16: WebContentsView LRU cache + dynamic RAM cap

- [ ] Finished

### What to build

Manage WebContentsView lifecycle to prevent unbounded memory growth. Cap the number of live WebContentsViews based on available system RAM.

**LRU cache (src/main/webContentsLRU.ts):**
- Track all created WebContentsViews by URL
- On `show-website`: check if view exists for URL, reuse if so; create new if not
- After creating: check if total views exceed cap → destroy least-recently-used view
- On `hide-website`: mark view as "inactive" (candidate for eviction) but don't destroy

**Dynamic RAM cap (src/main/memoryManager.ts):**
- Read total system RAM via `os.totalmem()`
- Set cap: 3 on <=4GB, 5 on <=8GB, 8 on <=16GB, 10 on >16GB
- Expose via IPC `get-system-memory` for renderer to read

**Preload next website:**
- When rotation engine signals the next item is a website, IPC `preload-website` creates the WebContentsView in background (hidden)
- Preloaded view becomes the active view on rotation

**Memory monitoring:**
- Log memory usage periodically (main process)
- If `process.memoryUsage().heapUsed` exceeds threshold, force-evict inactive views

### Acceptance criteria

- [ ] LRU cap scales with system RAM
- [ ] Exceeding cap destroys the oldest inactive WebContentsView
- [ ] Reused views don't reload (show cached page)
- [ ] Preload-next creates WebContentsView before it's needed
- [ ] Memory stays bounded even with long-running playlists
- [ ] Views are properly destroyed (no zombie processes)

### Blocked by

- Blocked by Task 13

### User stories addressed

- Memory management
- Preload next scene
- Dynamic RAM-based cap

---

## Task 17: Persistent sessions for 3rd-party auth

- [ ] Finished

### What to build

Configure WebContentsViews with persistent session storage so users only need to log into Grafana/PowerBI once.

**Persistent session partition (in webContentsManager.ts):**
- All WebContentsViews share a single persistent partition: `persist:signage`
- This partition stores cookies, localStorage, IndexedDB across app restarts
- When creating a WebContentsView: `webPreferences: { partition: 'persist:signage' }`

**Session lifecycle:**
- On app boot: partition loads existing session data from disk
- On website load: cookies from previous sessions are sent automatically
- On logout/unpair: clear the partition data (`session.fromPartition('persist:signage').clearStorageData()`)

**Cookie management IPC (optional but useful):**
- IPC handler `get-session-cookies` for debugging
- IPC handler `clear-session-data` for the logout flow

### Acceptance criteria

- [ ] Logging into Grafana on first visit persists across app restarts
- [ ] Cookies survive WebContentsView destruction/recreation (LRU eviction)
- [ ] All WebContentsViews share the same session (login once, works everywhere)
- [ ] Logout/unpair clears all stored session data
- [ ] Session data stored in Electron's default userData path

### Blocked by

- Blocked by Task 13

### User stories addressed

- Login credentials for PowerBI/Grafana (first-time login)
- Persistent BrowserView sessions

---

## Task 18: Per-item reload-on-rotate toggle

- [ ] Finished

### What to build

When rotation returns to a website scene that's already in the LRU cache, optionally reload the page instead of showing the cached version.

**Reload flag:**
- Each PlaylistTab in the backend model can have a `reload` boolean (check if this field exists in backend; if not, default to false)
- If not in backend model: use a local setting per URL stored in electron-store

**Implementation in webContentsManager:**
- When `show-website` is called for a URL that's already in the LRU:
  - Check the reload flag for that playlist item
  - If reload=true: call `webContents.reload()` before showing
  - If reload=false: show as-is (cached state)

**Integration with rotation engine:**
- Pass the current item's reload preference when calling `show-website` IPC
- Default: false (cached behavior, matching the LRU design)

### Acceptance criteria

- [ ] Items with reload=true refresh the page each time they rotate in
- [ ] Items with reload=false show cached content
- [ ] Reload triggers a full page refresh (not just a repaint)
- [ ] Default behavior (no flag) is cache (no reload)
- [ ] Works correctly with the LRU cache (reloaded items maintain their LRU position)

### Blocked by

- Blocked by Task 16, Task 17

### User stories addressed

- Reload on rotate toggle (per item)
- Dashboard data freshness

---

## Task 19: Fullscreen kiosk mode + escape hatch

- [ ] Finished

### What to build

Enable true kiosk mode with a secret key combination to exit.

**Kiosk mode (src/main/kiosk.ts):**
- When entering player view: set `win.setKiosk(true)`
- Kiosk mode: no taskbar, no Alt+Tab, no window borders, no close button
- Register global shortcut: Ctrl+Shift+Q → exit kiosk mode (setKiosk(false), show normal window)

**Display selection:**
- IPC handler `get-monitors`: returns all displays from `screen.getAllDisplays()`
- IPC handler `set-display`: move window to selected display, then enter kiosk
- Each display: { id, label, bounds: { x, y, width, height }, isPrimary }

**Behavior:**
- Kiosk mode is ON by default when playing
- Escape hatch (Ctrl+Shift+Q) exits kiosk but keeps app running
- Re-entering player view re-enables kiosk
- During pairing/picker screens: normal window (not kiosk)

### Acceptance criteria

- [ ] Kiosk mode fills the entire selected display with no chrome
- [ ] Alt+Tab and Alt+F4 are blocked in kiosk mode
- [ ] Ctrl+Shift+Q exits kiosk to normal window
- [ ] Display selection moves window to correct monitor
- [ ] Kiosk auto-enables when entering player view
- [ ] Non-player views show normal window

### Blocked by

- Blocked by Task 2

### User stories addressed

- Fullscreen kiosk mode
- Multi-display support (select display)
- Escape hatch for setup/maintenance

---

## Task 20: Settings overlay (Escape key)

- [ ] Finished

### What to build

A hidden overlay that appears when the user presses Escape during playback. V1 controls: pause/resume, skip, logout.

**Overlay component (src/renderer/components/SettingsOverlay.tsx):**
- Triggered by Escape keypress (document.addEventListener)
- Semi-transparent dark backdrop over the player
- Centered panel with controls:
  - Pause/Resume button (toggles playback)
  - Skip to next item button
  - Logout / Unpair device button (with confirmation dialog)
- Close overlay: press Escape again or click outside

**Integration:**
- Pause: stops rotation timer, freezes current scene
- Resume: restarts rotation timer from where it left off
- Skip: advance to next item immediately
- Logout: clear electron-store auth data, clear session partition, navigate to pairing screen

**Kiosk interaction:**
- Escape key should work even in kiosk mode
- Overlay renders ABOVE WebContentsViews (must handle z-order — temporarily hide WebContentsView when overlay is open)

### Acceptance criteria

- [ ] Escape toggles the overlay open/closed
- [ ] Pause/resume controls work correctly
- [ ] Skip advances to next playlist item
- [ ] Logout clears all credentials and returns to pairing
- [ ] Overlay renders above all content including WebContentsViews
- [ ] Overlay is visually polished (shadcn/ui + Tailwind)

### Blocked by

- Blocked by Task 10, Task 19

### User stories addressed

- Settings overlay (Escape key)
- Player controls (V1 minimal: pause, skip, logout)

---

## Task 21: Auto-detect display orientation

- [ ] Finished

### What to build

Detect whether the target display is in portrait or landscape orientation and adapt the app layout accordingly.

**Orientation detection (src/main/orientation.ts):**
- Read display bounds from `screen.getPrimaryDisplay()` (or selected display)
- If bounds.height > bounds.width → portrait mode
- If bounds.width >= bounds.height → landscape mode
- IPC handler `get-orientation`: returns 'portrait' | 'landscape'

**Renderer integration:**
- On mount and on display change: query orientation
- Apply CSS class to root element: `data-orientation="portrait"` or `data-orientation="landscape"`
- Content adapts:
  - Images: object-fit: cover handles both orientations automatically
  - Videos: same behavior
  - Websites: WebContentsView fills bounds regardless of orientation
  - Progress bar: bottom in landscape, side in portrait (or keep bottom)

**Display change listener:**
- Listen for `display-metrics-changed` event in main process
- Notify renderer when orientation changes (e.g., external display rotated)

### Acceptance criteria

- [ ] Portrait display correctly detected (height > width)
- [ ] Landscape display correctly detected
- [ ] CSS data attribute applied to root
- [ ] Content renders correctly in both orientations
- [ ] Orientation updates when display metrics change

### Blocked by

- Blocked by Task 19

### User stories addressed

- Vertical viewport support
- Different resolution support

---

## Task 22: Offline handling

- [ ] Finished

### What to build

Handle network failures gracefully during playback. Skip failed items, show what works, display a subtle offline indicator.

**Network monitoring (src/renderer/hooks/useNetworkStatus.ts):**
- Use `navigator.onLine` + `online`/`offline` events
- Expose: isOnline boolean

**Scene error handling:**
- Each scene component already has `onError` callback (from Tasks 11-13)
- When onError fires: rotation engine marks the item as "failed" and skips to next
- Track consecutive failures: if ALL items fail, show a "waiting for connection" screen
- Reset failure flags when network returns online

**Offline indicator (src/renderer/components/OfflineIndicator.tsx):**
- Small, subtle badge in corner: "Offline" with an icon
- Only visible when `!isOnline`
- Doesn't interfere with content display
- Animated entrance/exit

**WebContentsView offline:**
- Website load failures (did-fail-load) trigger skip
- Already-loaded websites remain visible (cached in memory)

### Acceptance criteria

- [ ] Failed items are skipped automatically
- [ ] Subtle offline indicator appears when network is down
- [ ] All-items-failed shows a branded waiting screen
- [ ] Network recovery resumes normal playback
- [ ] Already-loaded websites continue displaying when offline
- [ ] No app crashes on network loss

### Blocked by

- Blocked by Task 10, Task 13

### User stories addressed

- Skip failed items, show what works
- Offline resilience

---

## Task 23: Error reporting interface + backend logger

- [ ] Finished

### What to build

A generic error reporting interface with a backend logger implementation. Designed for easy swap to Sentry in V2.

**Interface (src/shared/errorReporter.ts):**
```typescript
interface IErrorReporter {
  captureException(error: Error, context?: Record<string, unknown>): void
  captureMessage(message: string, level: 'info' | 'warning' | 'error'): void
  setContext(key: string, value: Record<string, unknown>): void
  setUser(id: string): void
}
```

**Backend logger implementation (src/renderer/lib/backendLogger.ts):**
- Implements IErrorReporter
- POSTs errors to a backend endpoint (or logs to console if no endpoint configured)
- Batches errors (send every 30s or on 10 accumulated errors)
- Includes device context: screenId, appVersion, OS, RAM

**Main process integration:**
- Catch unhandled exceptions in main process → report via IErrorReporter
- Catch renderer crashes (`webContents.on('crashed')`) → report

**Renderer integration:**
- React ErrorBoundary at app root → catches renderer errors
- ErrorBoundary renders a "Something went wrong" screen with restart button

**Development mode:**
- In dev, errors log to console instead of POSTing to backend

### Acceptance criteria

- [ ] IErrorReporter interface is defined and exported
- [ ] BackendLogger implements the interface
- [ ] Main process unhandled exceptions are captured
- [ ] Renderer crashes are captured
- [ ] React ErrorBoundary catches component errors
- [ ] Dev mode logs to console only
- [ ] Error context includes device/app metadata

### Blocked by

- Blocked by Task 1

### User stories addressed

- Error monitoring (generic interface)
- Crash detection for unattended devices

---

## Task 24: Auto-launch + daily restart

- [ ] Finished

### What to build

Configure the app to launch on Windows startup and perform a daily restart for memory hygiene.

**Auto-launch (src/main/autoLaunch.ts):**
- `app.setLoginItemSettings({ openAtLogin: true })` — on by default
- IPC handler `set-auto-launch`: toggle on/off (for future settings expansion)
- Only set on first run (check electron-store flag `autoLaunchConfigured`)

**Daily restart (src/main/dailyRestart.ts):**
- Configurable restart time: stored in electron-store, default 3:00 AM
- Check every minute if current time matches restart time
- On match: gracefully restart the app (`app.relaunch()` + `app.exit()`)
- Don't restart if:
  - App has been running less than 1 hour (prevent restart loops)
  - User has the settings overlay open (interacting with app)

**IPC handlers:**
- `get-restart-time`: returns configured restart time
- `set-restart-time`: update the time in electron-store

### Acceptance criteria

- [ ] App auto-launches on Windows startup by default
- [ ] Auto-launch can be toggled off via IPC
- [ ] Daily restart occurs at configured time (default 3 AM)
- [ ] Restart is graceful (app relaunches cleanly)
- [ ] No restart loop if app just started
- [ ] Restart time configurable via electron-store

### Blocked by

- Blocked by Task 2

### User stories addressed

- Auto-launch on startup (signage mode)
- Memory management (daily restart)

---

## Task 25: Auto-update via electron-updater

- [ ] Finished

### What to build

Automatic update checking and installation using electron-updater with GitHub Releases as the update source.

**Setup:**
- Install `electron-updater`
- Configure in electron-builder: `publish: { provider: "github", owner: "OWNER", repo: "REPO" }`
- TODO comment: code signing required for production — unsigned updates show warnings

**Update flow (src/main/autoUpdater.ts):**
- On app launch (after window ready): check for updates silently
- If update available: download in background
- After download: show notification to user (via IPC to renderer)
- On next restart (or daily restart): install update
- For signage: option to auto-install without prompt (configurable)

**IPC to renderer:**
- `update-available`: { version, releaseNotes }
- `update-downloaded`: { version }
- `update-error`: { error }

**Renderer notification:**
- Small toast/banner: "Update v1.2.0 available — will install on next restart"
- Or auto-install silently in signage mode

### Acceptance criteria

- [ ] electron-updater checks GitHub Releases on launch
- [ ] Update downloads in background without interrupting playback
- [ ] Renderer receives update status notifications
- [ ] Update installs on next app restart
- [ ] TODO comment for code signing is present
- [ ] Errors during update don't crash the app

### Blocked by

- Blocked by Task 26

### User stories addressed

- Software update feature
- Auto-update for unattended signage

---

## Task 26: Windows NSIS packaging + production build

- [ ] Finished

### What to build

Configure electron-builder for Windows NSIS installer production builds.

**electron-builder config (in package.json or electron-builder.yml):**
```yaml
appId: com.variabl.tabrevolver
productName: Tab Revolver Player
directories:
  output: release
win:
  target: nsis
  icon: resources/icon.ico
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  deleteAppDataOnUninstall: false
  installerIcon: resources/icon.ico
  uninstallerIcon: resources/icon.ico
```

**Build pipeline:**
- `npm run build` → electron-vite build (main + preload + renderer) → electron-builder package
- Output: `release/Tab Revolver Player Setup X.X.X.exe`

**Assets:**
- App icon (resources/icon.ico) — placeholder for now
- Installer sidebar image (optional)

**Production defaults:**
- Remove dev tools access
- Remove source maps in production
- Set CSP headers

**README:**
- Build instructions
- TODO: code signing setup
- TODO: GitHub Releases setup for auto-updater

### Acceptance criteria

- [ ] `npm run build` produces a working .exe installer
- [ ] Installer creates start menu entry
- [ ] Installed app launches and works (not just dev mode)
- [ ] App icon displays correctly in taskbar and installer
- [ ] Production build strips dev tools
- [ ] README documents build process and TODOs

### Blocked by

- Blocked by Task 1

### User stories addressed

- .exe packaging (NSIS)
- Windows distribution
