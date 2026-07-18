# Multiplayer Quiz Application — Product and Technical Specification

**Document status:** Draft for implementation
**Version:** 2.0
**Primary users:** Administrators, quiz hosts, players
**Target capacity:** Up to 100 concurrent players per game
**Design principle:** Minimize steps, maximize clarity, forgive mistakes

---

## 1. Purpose

Build a browser-based multiplayer quiz application where an administrator can create a game by uploading an Excel workbook (or building questions in-app), configure quiz rules, host a live game, and display a real-time leaderboard.

Players join using a short room code and a display name. No account creation, no downloads, no installation. A player should go from "I have a code" to "I'm in the lobby" in under 15 seconds on a mobile device.

The system must support up to 100 players in a single game.

---

## 2. Usability Principles

These principles govern all design decisions:

1. **Zero-install for players.** Browser only. No app store, no login, no signup.
2. **One-tap actions.** Every primary action (join, answer, advance) requires a single tap or click.
3. **Forgiveness over prevention.** Let administrators undo mistakes rather than blocking them with confirmation dialogs. Let players change answers until the deadline (configurable).
4. **Sensible defaults.** A game should work with zero configuration beyond uploading questions.
5. **Progressive disclosure.** Show simple settings first. Hide advanced options behind a toggle.
6. **Instant feedback.** Every user action must produce visible feedback within 200ms, even if the server response takes longer.
7. **Mobile-first for players.** The player experience must be designed for one-handed phone use.
8. **Desktop-first for administrators.** The admin and host experience is optimized for larger screens.
9. **Recoverable state.** Refreshing, disconnecting, or switching tabs must never lose progress.
10. **Minimal reading.** Use icons, color, and layout over text labels where possible during gameplay.

---

## 3. Core Requirements

The application must provide:

* Administrator authentication
* Excel-based quiz creation with a downloadable template
* In-app question editor as an alternative to Excel
* Configurable game settings with sensible defaults
* Configurable timer and scoring rules
* Multiplayer room creation with short, readable codes
* Player joining through a room code (no account required)
* Maximum-player enforcement
* Live question delivery
* A server-authoritative timer
* Configurable answer behavior (lock on first answer or allow changes)
* Server-side answer validation
* Server-side score calculation
* Real-time leaderboard updates
* Final game results
* Results export
* Player reconnect support
* Host reconnect support

---

## 4. Default Game Rules

The default configuration requires zero setup beyond providing questions:

| Setting | Default | Why this default |
| --- | ---: | --- |
| Maximum players | 100 | Covers most use cases |
| Question duration | 30 seconds | Enough time without dragging |
| Preparation countdown | 3 seconds | Lets players focus |
| Leaderboard display duration | 5 seconds | Enough to scan top ranks |
| Correct answer in first 10 seconds | 3 points | Rewards fast knowledge |
| Correct answer from 10 to under 20 seconds | 2 points | Rewards correct knowledge |
| Correct answer from 20 through 30 seconds | 1 point | Still rewards correctness |
| Incorrect answer | 0 points | No penalty |
| Late answer | Rejected | Server-enforced deadline |
| Allow answer changes before deadline | No | Simplest mental model |
| Answers allowed per question | 1 | Standard quiz behavior |

All values are configurable. An administrator who uploads a valid Excel file and clicks "Start" gets a working game with these defaults.

---

## 5. User Roles

### 5.1 Administrator

An administrator can:

* Sign in (email/password, with password reset)
* Create a game (from Excel upload or from scratch)
* Upload an Excel workbook with inline validation feedback
* Edit imported questions without re-uploading
* Duplicate a previous game (copies questions and settings, not player data)
* Configure game rules (with live preview of scoring behavior)
* Publish a game (generates room code)
* Host a game (start, advance, pause, end)
* View connected players and remove disruptive players
* View the live leaderboard
* View and export final results
* Reconnect to an active game after disconnection

### 5.2 Player

A player can:

* Enter a room code and display name (single screen, two fields)
* Join the game lobby
* Reconnect to an existing session automatically (via stored session token)
* View the active question and answer choices
* Submit an answer with one tap
* Change an answer before the deadline (if configured)
* See the countdown timer with clear visual states
* See whether their answer was submitted
* See points awarded after question closes
* See the leaderboard
* See final results and their rank

Players do not require accounts. A player's session lives in browser storage and expires when the game completes or is cancelled.

### 5.3 Spectator

Out of scope for MVP. Noted for future consideration.

---

## 6. Primary User Flows

### 6.1 Administrator Creates a Game

**Goal: Go from nothing to a published game in under 5 minutes.**

1. Administrator signs in.
2. Dashboard shows: active games, drafts, completed games.
3. Administrator clicks **Create Game**.
4. System presents two paths:
   - **Upload Excel** (bulk creation)
   - **Build from scratch** (guided editor)
5. If uploading Excel:
   a. Administrator drags or selects a file.
   b. System parses and validates in real time (progress indicator).
   c. System shows a preview: question count, settings detected, warnings, blocking errors.
   d. Warnings are non-blocking (e.g., "No category specified for 3 questions").
   e. Blocking errors show the worksheet, row, column, and a plain-English fix.
   f. Administrator can fix errors in-app or re-upload.
6. If building from scratch:
   a. Administrator enters game name.
   b. Administrator adds questions one at a time or in bulk paste mode.
7. Settings panel (collapsed by default, showing defaults):
   - Basic: timer, max players
   - Scoring: bands with visual timeline
   - Behavior: late join, randomization, answer reveal
8. Administrator clicks **Save Draft** or **Publish**.
9. On publish, the system generates a room code and shows it prominently with a copy button and QR code.

**Key usability decisions:**
- No separate "validate" step. Validation is continuous.
- No separate "configure scoring" step unless the admin wants to change defaults.
- The room code screen includes a shareable link and QR code for immediate distribution.

### 6.2 Player Joins a Game

**Goal: Join in under 15 seconds on mobile.**

1. Player opens the application URL (or scans QR code).
2. Single screen shows two fields: room code, display name.
3. If the player arrived via a direct link with room code embedded, only display name is needed.
4. Player taps **Join**.
5. System validates:
   - Room exists (if not: "No game found with this code. Check the code and try again.")
   - Game accepts players (if not: "This game has already started and isn't accepting new players.")
   - Room not full (if not: "This game is full. Contact the host.")
   - Display name is valid (if not: inline validation showing the issue)
6. On success, player enters the lobby immediately.
7. Lobby shows: game name, their display name, player count updating in real time, and a "Waiting for host to start" indicator.

**Key usability decisions:**
- No loading screens. The lobby appears instantly, player list populates progressively.
- Room code input is case-insensitive, strips whitespace, and accepts codes with or without dashes.
- If the player already has a session token for this game (reconnect), skip join and go directly to the current game state.

### 6.3 Host Starts the Game

**Goal: One-click start when ready.**

1. Host sees the lobby with connected player count prominently displayed.
2. Host clicks **Start Game** (enabled when at least 1 player is connected).
3. No confirmation dialog. The host can pause immediately if they started by accident.
4. System locks the room (unless late join is enabled).
5. A preparation countdown (default: 3 seconds) displays on all screens.
6. The first question appears simultaneously for all players.

**Key usability decisions:**
- No "ready check" mechanism. The host decides when to start.
- The start button shows the player count so the host can verify: "Start Game (47 players)".
- Late join is off by default but clearly shown as a toggle in the host console.

### 6.4 Player Answers a Question

**Goal: See question, tap answer, done.**

1. Player sees:
   - Question text (large, readable font)
   - Answer choices (large tap targets, full-width buttons on mobile)
   - Countdown timer (prominent, with color changes at 10s and 5s remaining)
2. Player taps one answer.
3. Immediate visual feedback: selected answer is highlighted, "Submitted" indicator appears.
4. If answer changes are allowed: player can tap a different answer until the timer expires.
5. If answer changes are not allowed: choices become non-interactive after selection.
6. When time expires:
   - Timer shows "Time's up"
   - Choices become non-interactive
   - If configured, correct answer is highlighted
   - Points awarded are shown with a brief animation

**Key usability decisions:**
- Answer choices are color-coded (A, B, C, D have distinct colors) for quick identification.
- The submit action is the tap itself. No separate "Submit" button.
- If a player's network is slow, optimistic UI shows the selection immediately and reconciles with the server.
- The timer uses both a countdown number and a visual progress bar.

### 6.5 Question Ends

A question ends when:
* The timer expires, OR
* The host ends it early (if configured), OR
* All active players have answered and auto-close is enabled

After the question ends:

1. No further answers are accepted (server-enforced).
2. All players see the results screen simultaneously:
   - Correct answer highlighted (if configured)
   - Their selected answer marked correct/incorrect
   - Points awarded
   - Optional explanation text
3. Leaderboard displays (if configured):
   - Shows top 5 with animation
   - Shows the current player's rank
   - Duration is configurable (default: 5 seconds)
4. Host advances to the next question manually, or auto-advance is configured.

**Key usability decisions:**
- The transition from "question" to "results" is animated to be clear and unmistakable.
- Players who didn't answer see "No answer submitted" rather than a penalty message.
- The leaderboard shows rank changes (arrows up/down) to make it engaging.

### 6.6 Game Ends

1. After the final question's leaderboard, the final results screen appears.
2. Players see: their final rank, total score, and the top 3 winners.
3. A "full results" view is scrollable.
4. The host sees all results plus export options.
5. The game is marked complete. No further actions are possible.
6. Player sessions expire. The join screen is shown if they refresh.

---

## 7. Game Lifecycle

States:

```
draft → published → lobby → active → completed
                                   → cancelled
```

Active sub-states (managed internally):

```
active:
  → countdown
  → question_active
  → question_results
  → leaderboard
  → paused
```

Valid transitions:

| From | To | Trigger |
| --- | --- | --- |
| draft | published | Admin clicks Publish |
| draft | cancelled | Admin deletes draft |
| published | lobby | First player joins OR host opens lobby |
| published | cancelled | Admin cancels |
| lobby | active (countdown) | Host clicks Start |
| lobby | cancelled | Host cancels |
| active (any sub-state) | paused | Host clicks Pause |
| paused | active (prior sub-state) | Host clicks Resume |
| active (leaderboard, last question) | completed | Automatic after final leaderboard |
| active (any sub-state) | completed | Host clicks End Game |
| active (any sub-state) | cancelled | Host cancels |

**Paused behavior:** All timers freeze. Players see "Game Paused" overlay. No answers accepted. Host can resume to exact prior state.

**Completed/cancelled:** No answers accepted. Player sessions expire after 1 hour. Game data retained for export.

---

## 8. Configurable Game Settings

Settings are organized into three tiers for progressive disclosure:

### Tier 1: Always Visible

| Setting | Type | Default | Validation |
| --- | --- | ---: | --- |
| Game name | Text | Required | 1-150 characters |
| Question duration | Integer | 30 | 5-300 seconds |
| Maximum players | Integer | 100 | 2-100 |

### Tier 2: Common Options (collapsed by default)

| Setting | Type | Default | Validation |
| --- | --- | ---: | --- |
| Preparation countdown | Integer | 3 | 0-30 seconds |
| Leaderboard display duration | Integer | 5 | 0-60 seconds |
| Randomize question order | Boolean | False | |
| Randomize answer choices | Boolean | False | |
| Show correct answer after question | Boolean | True | |
| Show leaderboard after each question | Boolean | True | |
| Allow answer changes before deadline | Boolean | False | |

### Tier 3: Advanced (behind "Advanced Settings" toggle)

| Setting | Type | Default | Validation |
| --- | --- | ---: | --- |
| Allow late joining | Boolean | False | |
| Auto-close when all answered | Boolean | False | |
| Allow host to end question early | Boolean | True | |
| Allow duplicate display names | Boolean | False | |
| Show points immediately after answering | Boolean | False | |
| Auto-advance questions | Boolean | False | |
| Auto-advance delay (seconds) | Integer | 5 | 3-30 |

**Interaction rule:** "Show points immediately" is disabled if "Show correct answer after question" is off (since points imply correctness).

Question-specific overrides: Individual questions can override the game-level timer. This is set per-question in the editor or via the Excel "Time Limit" column.

---

## 9. Scoring Rules

### 9.1 Default Scoring Bands

| Band | Time Range | Points |
| --- | --- | ---: |
| Fast | 0.000s to under 10.000s | 3 |
| Medium | 10.000s to under 20.000s | 2 |
| Standard | 20.000s to 30.000s (inclusive) | 1 |

Incorrect answers: 0 points.
Answers after deadline: rejected (not scored).

### 9.2 Boundary Rules (Precise)

```
0.000 <= elapsed < 10.000    → 3 points
10.000 <= elapsed < 20.000   → 2 points
20.000 <= elapsed <= 30.000  → 1 point
elapsed > 30.000             → rejected
incorrect answer             → 0 points
```

The final band's end boundary is always inclusive (answers at exactly the deadline are accepted). All other band boundaries use exclusive end (the next band's start is inclusive).

### 9.3 Scoring Configuration UI

The admin configures scoring bands using a visual timeline:

- A horizontal bar represents the question duration (e.g., 30 seconds).
- Colored segments represent bands.
- Drag handles adjust boundaries.
- Point values are editable inline.
- Adding or removing bands automatically adjusts neighbors to prevent gaps.

**Validation rules (enforced visually and on save):**
- No overlapping bands
- No gaps between bands
- No negative points
- End time must be after start time
- Bands must collectively cover the entire question duration
- Minimum 1 band required

The system auto-fills: if the admin changes the question duration, the last band auto-extends to match.

### 9.4 Per-Question Scoring

Optional. If a question has a custom timer, the admin can assign custom scoring bands. Otherwise, game-level bands apply.

### 9.5 Tie-Breaking

Deterministic. Applied in order:

1. Highest total score
2. Most correct answers
3. Lowest total response time (sum of response times for correct answers only)
4. Earliest join time

---

## 10. Excel Upload Specification

### 10.1 Template

The system provides a downloadable Excel template with:
- Pre-formatted headers
- Example data (clearly marked as examples to delete)
- Data validation dropdowns where applicable
- Instructions in a separate "Help" tab

### 10.2 Supported Worksheets

```
Questions (required)
Game (optional)
Scoring (optional)
```

If "Game" or "Scoring" worksheets are missing, system defaults apply. Only the "Questions" worksheet is required.

### 10.3 Questions Worksheet

| Column | Required | Notes |
| --- | --- | --- |
| Order | No | If missing, row order is used |
| Question | Yes | |
| Choice A | Yes | |
| Choice B | Yes | |
| Choice C | No | |
| Choice D | No | |
| Choice E | No | |
| Choice F | No | |
| Correct Choice | Yes | Letter (A-F) matching a populated choice |
| Explanation | No | Shown to players after reveal |
| Time Limit | No | Overrides game default for this question |
| Category | No | For organization and reporting |
| Image URL | No | Must be HTTPS, validated on import |

### 10.4 Game Worksheet

| Field | Required | Default if missing |
| --- | --- | --- |
| Game Name | Yes | (none, must be provided somewhere) |
| Maximum Players | No | 100 |
| Question Duration | No | 30 |
| Preparation Countdown | No | 3 |
| Leaderboard Duration | No | 5 |
| Allow Late Join | No | FALSE |
| Randomize Questions | No | FALSE |
| Randomize Answers | No | FALSE |
| Show Correct Answer | No | TRUE |
| Show Leaderboard | No | TRUE |

### 10.5 Scoring Worksheet

| Column | Required | Notes |
| --- | --- | --- |
| Start Second | Yes | Inclusive start of band |
| End Second | Yes | Exclusive end (except final band is inclusive) |
| Points | Yes | Non-negative integer |

### 10.6 Validation

Validation is progressive and non-blocking where possible:

**Blocking errors (game cannot be published):**
- Questions worksheet missing
- Zero valid questions
- A question has no correct choice
- Correct choice references a blank column
- Duplicate question order values (if order column is used)

**Warnings (game can still be published):**
- Missing optional worksheets (defaults will apply)
- Image URL returns a non-200 status
- Question text exceeds 500 characters (may display poorly on mobile)
- Category column is inconsistent

**Auto-corrections (applied silently with notification):**
- Whitespace trimmed from all cells
- Choice letters normalized to uppercase
- Order column gaps filled sequentially
- Trailing empty rows ignored

### 10.7 Validation Output

Displayed as a grouped list:

```
3 questions imported successfully
1 warning:
  - Row 7: Image URL returned 404. The question will display without an image.
0 errors

Settings: Using uploaded values (30s timer, 100 max players)
Scoring: Using uploaded bands (3/2/1 points)
```

For errors:
```
2 errors (must fix before publishing):
  - Questions, Row 12: Correct Choice is "E" but Choice E is blank
  - Questions, Row 28: Question text is empty
```

### 10.8 Import Process

```
Upload → Parse → Validate → Preview → Confirm → Save (transactional)
```

A failed save rolls back completely. No partial games are ever created.

### 10.9 File Constraints

- Maximum file size: 5 MB
- Supported formats: .xlsx, .xls
- Macros: ignored (not executed)
- Formulas: evaluated to their current value
- Maximum questions per file: 500
- Maximum characters per question: 2000
- Maximum characters per choice: 500

---

## 11. Room Codes

### 11.1 Format

- 6 characters, alphanumeric uppercase
- Excludes ambiguous characters: 0, O, I, L, 1
- Character set: `ABCDEFGHJKMNPQRSTUVWXYZ23456789`
- Example: `HK7M3P`
- Case-insensitive input (system normalizes to uppercase)
- Unique across all active games

### 11.2 Sharing

When a game is published, the admin sees:
- The room code in large text with a copy button
- A QR code that encodes the direct-join URL
- A shareable link: `https://{domain}/join/{code}`
- The direct-join link pre-fills the room code field

### 11.3 Expiration

Room codes are released 24 hours after a game completes or is cancelled. They may be reused for future games after release.

---

## 12. Timer Requirements

### 12.1 Server Authority

The server is the single source of truth for time:
- Question start timestamp: set by server when question becomes active
- Question end timestamp: start + configured duration
- Elapsed time for scoring: server time at answer receipt minus question start timestamp

### 12.2 Client Display

The client calculates remaining time locally from server-provided timestamps:
- On question start, server sends: `{ questionStartedAt, durationMs }`
- Client computes: `remaining = durationMs - (Date.now() - questionStartedAt - serverTimeOffset)`
- Server time offset is calculated on connection via a ping-based sync
- Display updates at 10 frames per second minimum

### 12.3 Network Latency

**Policy:** The server timestamp of answer receipt is authoritative. No client-side timestamps are trusted. Network latency is an accepted tradeoff. This is documented to administrators.

**Mitigation:** The generous time bands (10-second windows) make sub-second latency variations negligible for scoring purposes.

### 12.4 Visual States

The timer displays:
- **Green** (more than 10 seconds remaining): calm, no urgency
- **Yellow** (5-10 seconds remaining): attention
- **Red** (under 5 seconds): urgency, optional pulse animation
- **Expired**: "Time's up" text, greyed-out choices

### 12.5 Resilience

The timer must remain correct when:
- A player refreshes the page (recalculates from server state)
- A player temporarily disconnects (resumes from server state on reconnect)
- A browser tab is backgrounded (recalculates on focus)
- A client clock is wrong (server offset compensates)
- The host pauses and resumes (adjusted timestamps sent to all clients)

---

## 13. Multiplayer and Real-Time Requirements

### 13.1 Connection Model

Each client maintains one WebSocket (or equivalent real-time) connection. The connection carries:
- Game state changes
- Player join/leave notifications
- Question start/end events
- Leaderboard updates
- Host commands

### 13.2 Events Broadcast to Players

| Event | Payload |
| --- | --- |
| player_joined | player count |
| game_starting | countdown duration |
| question_active | question data, start time, duration |
| question_ended | correct answer (if configured), player's points |
| leaderboard_update | rankings |
| game_paused | (none) |
| game_resumed | current state |
| game_completed | final rankings |
| player_removed | reason |

### 13.3 Events Broadcast to Host

All player events, plus:
| Event | Payload |
| --- | --- |
| answer_received | answer count, percentage answered |
| player_disconnected | player info |
| player_reconnected | player info |

### 13.4 Capacity

- 100 players + 1 host + 5 connection margin (for reconnects in progress)
- The real-time layer must handle 100 simultaneous answer submissions within a 1-second window without dropping any
- Timer ticks are NOT broadcast. Clients compute locally from server timestamps.

### 13.5 Degraded Connectivity

If a player's connection drops:
- Client shows "Reconnecting..." overlay
- Auto-reconnect attempts every 2 seconds for up to 60 seconds
- On reconnect, server sends full current state
- If the player had not yet answered the current question, they may still answer (if time remains)
- If the player misses a question entirely, it counts as unanswered (0 points, not penalized)

---

## 14. Player Session and Reconnection

### 14.1 Session Creation

On join, the system creates:
- Player record (linked to game)
- Session token (cryptographically random, 256-bit)
- Session token stored as an HttpOnly cookie and also in localStorage (fallback)
- Join timestamp

### 14.2 Reconnection Flow

1. Player's browser opens the app.
2. Client checks for an existing session token.
3. If found, client sends a reconnect request with the token.
4. Server validates:
   - Token matches a player record
   - The game is still active (not completed/cancelled)
   - The player was not removed by the host
5. On success: player is restored to current game state. No duplicate player created.
6. On failure: player sees the join screen.

### 14.3 Session Expiry

- Active game: session valid for the duration of the game
- Completed game: session expires 1 hour after completion
- Cancelled game: session expires immediately
- Player removed: session invalidated immediately

### 14.4 Host Reconnection

The host can reconnect using admin authentication. On reconnect:
- Host console is restored with current game state
- All host controls are available
- The game does NOT pause automatically on host disconnect (players continue if a question is active)
- If no host action is required (timer is running), the game proceeds normally

---

## 15. Maximum Player Enforcement

### 15.1 Server-Side Enforcement

The join operation must be atomic:

```sql
BEGIN;
SELECT count(*) FROM players WHERE game_id = $1 AND status = 'active' FOR UPDATE;
-- Compare with max_players
-- INSERT player if under limit
-- REJECT if at limit
COMMIT;
```

The client never decides whether the room is full.

### 15.2 Race Condition Handling

If two players attempt to take the last slot simultaneously:
- One succeeds (first to acquire the lock)
- One receives "Game is full"
- The rejected player sees a clear message, not a generic error

### 15.3 Limit Behavior

- Default: 100
- Admin can set lower (minimum: 2)
- Admin cannot set higher than 100
- The host console shows: "47 / 100 players" in real time
- When 90% full: host sees a warning indicator
- When full: host sees "Room Full" badge, join link shows a waiting message

---

## 16. Answer Submission

### 16.1 Rules

- One answer per player per question (configurable: allow changes or lock on first)
- No answer before question_active state
- No answer after question ends (server-enforced by timestamp)
- No answer from an invalid/expired session
- No answer from a removed player
- Atomic: answer and score stored in one transaction

### 16.2 Submission Response

```json
{
  "accepted": true,
  "submissionTime": "2026-07-18T14:30:15.234Z",
  "responseTimeMs": 7234,
  "pointsAwarded": 3,
  "isCorrect": true,
  "alreadyAnswered": false
}
```

Fields `pointsAwarded` and `isCorrect` are included based on game configuration:
- If "show points immediately" is on: included in response
- If "show correct answer after question" is off: `isCorrect` withheld until question ends
- If both are off: only `accepted` and `submissionTime` are returned

### 16.3 Answer Changes (if configured)

When "allow answer changes before deadline" is enabled:
- Player can tap a different choice
- The new answer replaces the previous one
- Only the final answer at question close is scored
- The UI clearly indicates "You can change your answer until time runs out"

### 16.4 Optimistic UI

The client immediately shows the answer as selected. If the server rejects it (deadline passed, duplicate), the client reverts and shows an appropriate message.

---

## 17. Leaderboard

### 17.1 Display

The leaderboard shows:
- Rank (with position change arrows after question 1)
- Player display name
- Total score
- Points gained this round (highlighted)
- Number of correct answers (optional, configurable)

### 17.2 Player's View

- Top 5 players always shown
- Current player's position always shown (even if not in top 5)
- If the player is in top 5, they are highlighted
- If the player is outside top 5, a separator shows "..." then their row
- Full leaderboard is scrollable on the final results screen

### 17.3 Host's View

- Full scrollable leaderboard (all players)
- Sortable by rank, name, score, correct answers
- Exportable at any time

### 17.4 Update Timing

- Recalculated after each question closes
- Broadcast to all players as part of the question_results/leaderboard event
- Tie-breaking is deterministic (see Section 9.5)
- The leaderboard is never recalculated mid-question

---

## 18. Administrator Screens

### 18.1 Login

- Email and password fields
- "Forgot password" link
- Error messages: "Invalid email or password" (never reveal which is wrong)
- After login: redirect to dashboard

### 18.2 Dashboard

Layout: card grid showing games grouped by status.

| Section | Content | Primary Action |
| --- | --- | --- |
| Active Games | Currently running games with player count | Open Host Console |
| Drafts | Unpublished games | Edit / Publish |
| Published | Published but not started | Open Lobby / Edit |
| Completed | Past games with date | View Results / Duplicate |

Primary CTA: **+ Create Game** (always visible, top-right)

### 18.3 Game Editor

Two-panel layout:
- Left: question list (reorderable via drag)
- Right: selected question editor

Top bar: game name (editable), Save Draft, Publish

Bottom drawer (collapsible): Settings (Tier 1/2/3)

**Question editor fields:**
- Question text (rich text: bold, italic, code)
- Answer choices (A-F, with delete buttons for optional ones)
- Correct answer selector (radio button next to choices)
- Explanation (optional, collapsible)
- Time limit override (optional)
- Category (optional, with autocomplete from existing categories)
- Image (URL input with preview, or upload)

**Bulk actions:**
- Select multiple questions
- Delete selected
- Move to position
- Set category

### 18.4 Host Console

Designed for live presentation on a large screen or facilitator's laptop.

Layout:
```
+----------------------------------------------+
| Room: HK7M3P          Players: 47/100        |
+----------------------------------------------+
| [Current Question Preview]                    |
|                                               |
| Q3: What is the capital of France?            |
| A: Rome  B: Paris  C: Madrid  D: London      |
|                                               |
| Timer: 18s remaining    Answered: 38/47       |
+----------------------------------------------+
| Controls:                                     |
| [End Question] [Pause] [End Game]             |
+----------------------------------------------+
| Leaderboard (live)        | Player List       |
| 1. Alice - 24pts          | Alice (connected) |
| 2. Bob - 21pts            | Bob (connected)   |
| ...                       | Carol (away)      |
+----------------------------------------------+
```

**Host controls (context-aware, only relevant buttons shown):**
- In lobby: Start Game
- During question: End Question Early, Pause, End Game
- During leaderboard: Next Question, End Game
- When paused: Resume

**Player management:**
- Click a player to see: name, score, status, join time
- "Remove" button with single confirmation
- Removed players see "You have been removed by the host"

### 18.5 Results Screen

Tabs:
1. **Leaderboard** - final rankings
2. **By Question** - correct %, avg response time, hardest/easiest
3. **By Player** - individual scorecards
4. **Export** - download as Excel or CSV

---

## 19. Player Screens

All player screens are designed mobile-first with large touch targets (minimum 48x48px).

### 19.1 Join Screen

```
+---------------------------+
|                           |
|    [Logo / Game Name]     |
|                           |
|  Room Code: [______]     |
|  Your Name: [______]     |
|                           |
|      [  Join Game  ]      |
|                           |
|  Error message here       |
+---------------------------+
```

- Room code field: large monospace font, auto-uppercase, 6-character limit
- Display name field: 2-20 characters, validated inline
- Join button: disabled until both fields are valid
- If arriving via direct link, room code is pre-filled and read-only

### 19.2 Lobby

```
+---------------------------+
|    Tax Challenge 2026     |
|                           |
|    You: Akshay            |
|    47 players waiting     |
|                           |
|    [animated dots]        |
|    Waiting for host...    |
+---------------------------+
```

- Player count updates in real time
- No action required from the player
- If the player refreshes, they return here instantly (session token)

### 19.3 Question Screen

```
+---------------------------+
|  Q3 of 20        ⏱ 24s   |
|                           |
|  What is the capital      |
|  of France?               |
|                           |
| [A] Rome                  |
| [B] Paris          ← sel  |
| [C] Madrid                |
| [D] London                |
|                           |
|  ✓ Answer submitted       |
+---------------------------+
```

- Timer: large, top-right, color-coded
- Question number: top-left for progress awareness
- Choices: full-width buttons, distinct colors per letter
- Selected state: clear highlight, checkmark
- After selection (if locked): choices greyed except selected
- Image (if present): displayed above choices, tappable to enlarge

### 19.4 Question Result

```
+---------------------------+
|  ✓ Correct! +3 points    |
|                           |
|  Your answer: B (Paris)   |
|  Correct answer: B        |
|                           |
|  Paris has been the       |
|  capital since 508 AD.    |
|                           |
|  Your score: 24 points    |
+---------------------------+
```

- Correct: green banner with points
- Incorrect: red banner showing correct answer
- No answer: neutral banner "No answer submitted"
- Explanation: shown below if configured

### 19.5 Leaderboard (between questions)

```
+---------------------------+
|  Leaderboard              |
|                           |
|  1. ↑ Alice      27 pts  |
|  2. ↓ Bob        24 pts  |
|  3. — Carol      24 pts  |
|  4. ↑ David      21 pts  |
|  5. ↓ Eve        18 pts  |
|  ·····                    |
|  12. — You       14 pts  |
+---------------------------+
```

- Position change indicators (arrows)
- Current player always visible and highlighted
- Auto-transitions to next question (timer shown)

### 19.6 Final Results

```
+---------------------------+
|  🏆 Game Complete!        |
|                           |
|  Winner: Alice (27 pts)   |
|                           |
|  Your Result:             |
|  Rank: #12 of 47         |
|  Score: 14 points         |
|  Correct: 5 / 20         |
|                           |
|  [View Full Leaderboard]  |
+---------------------------+
```

---

## 20. Data Model

### 20.1 Administrators

```
administrators
- id: uuid, primary key
- email: text, unique
- password_hash: text
- role: text (admin)
- created_at: timestamp
- updated_at: timestamp
```

### 20.2 Games

```
games
- id: uuid, primary key
- owner_id: uuid, references administrators.id
- name: text, not null
- room_code: text, unique (among active games)
- status: enum (draft, published, lobby, active, completed, cancelled)
- active_sub_state: enum (countdown, question_active, question_results, leaderboard, paused), nullable
- paused_from_state: enum, nullable (state to resume to)
- current_question_id: uuid, nullable, references questions.id
- question_started_at: timestamp, nullable
- question_ends_at: timestamp, nullable
- current_question_index: integer, nullable
- created_at: timestamp
- updated_at: timestamp
- published_at: timestamp, nullable
- started_at: timestamp, nullable
- completed_at: timestamp, nullable
```

### 20.3 Game Settings

```
game_settings
- id: uuid, primary key
- game_id: uuid, references games.id, unique
- max_players: integer, default 100
- default_question_duration_seconds: integer, default 30
- preparation_countdown_seconds: integer, default 3
- leaderboard_duration_seconds: integer, default 5
- allow_late_join: boolean, default false
- randomize_questions: boolean, default false
- randomize_answers: boolean, default false
- show_correct_answer: boolean, default true
- show_leaderboard_after_question: boolean, default true
- auto_close_when_all_answered: boolean, default false
- allow_host_early_close: boolean, default true
- allow_duplicate_display_names: boolean, default false
- show_points_immediately: boolean, default false
- allow_answer_changes: boolean, default false
- auto_advance_questions: boolean, default false
- auto_advance_delay_seconds: integer, default 5
```

Note: 1:1 with games. Stored separately to keep the games table lean for queries that only need status/code.

### 20.4 Scoring Bands

```
scoring_bands
- id: uuid, primary key
- game_id: uuid, references games.id
- question_id: uuid, nullable, references questions.id
- start_ms: integer (milliseconds from question start, inclusive)
- end_ms: integer (milliseconds, exclusive except final band)
- is_final_band: boolean, default false
- points: integer, non-negative
- display_order: integer
```

When `is_final_band` is true, `end_ms` is inclusive. This eliminates the ambiguity from Section 9.2.

### 20.5 Questions

```
questions
- id: uuid, primary key
- game_id: uuid, references games.id
- question_order: integer
- question_text: text, not null
- explanation: text, nullable
- duration_seconds: integer, nullable (overrides game default)
- category: text, nullable
- image_url: text, nullable
- created_at: timestamp
- updated_at: timestamp
```

### 20.6 Choices

```
question_choices
- id: uuid, primary key
- question_id: uuid, references questions.id
- choice_key: char(1) (A-F)
- choice_text: text, not null
- is_correct: boolean
- display_order: integer
```

`is_correct` is never sent to players before the question closes.

### 20.7 Players

```
players
- id: uuid, primary key
- game_id: uuid, references games.id
- display_name: text, not null
- session_token_hash: text, not null
- status: enum (active, disconnected, removed)
- total_score: integer, default 0
- correct_answer_count: integer, default 0
- total_response_time_ms: bigint, default 0 (sum of response times for correct answers)
- joined_at: timestamp
- last_seen_at: timestamp
- removed_at: timestamp, nullable
- removed_reason: text, nullable
```

Denormalized `total_score`, `correct_answer_count`, and `total_response_time_ms` for fast leaderboard queries without aggregation.

### 20.8 Answers

```
answers
- id: uuid, primary key
- game_id: uuid, references games.id
- question_id: uuid, references questions.id
- player_id: uuid, references players.id
- selected_choice_id: uuid, references question_choices.id
- is_correct: boolean
- response_time_ms: integer
- points_awarded: integer
- submitted_at: timestamp
- updated_at: timestamp, nullable (if answer changes allowed)

UNIQUE (player_id, question_id)
```

### 20.9 Game Events (Audit Log)

```
game_events
- id: uuid, primary key
- game_id: uuid, references games.id
- event_type: text
- event_data: jsonb
- actor_type: enum (admin, system, player)
- actor_id: uuid, nullable
- created_at: timestamp
```

Used for auditing and debugging. Not used for real-time delivery.

**Retention:** Events are retained for 90 days after game completion, then archived or deleted.

---

## 21. Security Requirements

### 21.1 Authentication and Authorization

- Admin: email/password with bcrypt hashing, JWT tokens, refresh token rotation
- Players: session tokens (random 256-bit), hashed in database
- All admin endpoints require valid JWT
- All player endpoints require valid session token
- Games are scoped to their owning admin (row-level security)
- Players can only access their own game's public data

### 21.2 Data Protection

- Correct answers never sent to clients before question close
- Player scores computed server-side only
- Game state transitions only accepted from authenticated host
- All file uploads validated (type, size, content)
- Excel macros ignored, formulas resolved to values
- Maximum upload size: 5 MB
- No PII beyond display name and admin email

### 21.3 Rate Limiting

| Endpoint | Limit | Window |
| --- | --- | --- |
| Join game | 5 attempts | per minute per IP |
| Submit answer | 10 submissions | per minute per player |
| Admin login | 5 attempts | per minute per IP |
| File upload | 3 uploads | per minute per admin |

### 21.4 Transport

- HTTPS required in production
- WebSocket connections authenticated on handshake
- No sensitive data in URL parameters

### 21.5 Input Validation

All inputs validated server-side:
- Display names: 2-20 characters, alphanumeric plus spaces, trimmed
- Room codes: exactly 6 characters from allowed set
- Question text: maximum 2000 characters
- Choice text: maximum 500 characters
- Numeric fields: within documented ranges

---

## 22. Performance Requirements

For a game with 100 players:

| Operation | Target | Measurement |
| --- | --- | --- |
| Player join | < 2 seconds | Time from tap to lobby visible |
| Question delivery | < 500ms | Time from host advance to player sees question |
| Answer submission | < 500ms | Time from tap to "submitted" confirmation |
| Leaderboard calculation | < 1 second | Time from question close to leaderboard broadcast |
| Page load (player) | < 3 seconds | First contentful paint on 4G |
| Reconnect | < 2 seconds | Time from reconnect to current state restored |

### 22.1 Database Indexes

```
games.room_code (unique, where status in ('published','lobby','active'))
players.game_id, players.status
players.session_token_hash
answers.player_id, answers.question_id (unique)
answers.game_id, answers.question_id
questions.game_id, questions.question_order
scoring_bands.game_id
scoring_bands.game_id, scoring_bands.question_id
```

### 22.2 Query Isolation

All queries must include `game_id` in their WHERE clause. No full-table scans across games.

---

## 23. Results and Reporting

### 23.1 Export Formats

- Excel (.xlsx) with multiple worksheets
- CSV (single file, player summary)

### 23.2 Export Contents

**Worksheet 1: Player Summary**

| Column | Description |
| --- | --- |
| Rank | Final position |
| Player Name | Display name |
| Total Score | Points |
| Correct Answers | Count |
| Incorrect Answers | Count |
| Unanswered | Count |
| Average Response Time (s) | For answered questions |
| Join Time | Timestamp |

**Worksheet 2: Answer Detail**

| Column | Description |
| --- | --- |
| Player Name | |
| Question # | Order |
| Question Text | |
| Selected Answer | Choice letter and text |
| Correct Answer | Choice letter and text |
| Result | Correct / Incorrect / Unanswered |
| Response Time (s) | |
| Points Awarded | |
| Submission Time | Timestamp |

**Worksheet 3: Question Summary**

| Column | Description |
| --- | --- |
| Question # | Order |
| Question Text | |
| Total Answered | Count |
| Correct Count | |
| Incorrect Count | |
| Unanswered Count | |
| Correct % | |
| Average Response Time (s) | |
| Fastest Correct (s) | |
| Hardest Question | Boolean flag for lowest correct % |

---

## 24. Error Handling

### 24.1 Player-Facing Errors

Errors are short, actionable, and friendly:

| Situation | Message |
| --- | --- |
| Invalid room code | "No game found with this code. Check the code and try again." |
| Room full | "This game is full (100/100 players)." |
| Game already started | "This game has already started and isn't accepting new players." |
| Duplicate name | "Someone already has that name. Try a different one." |
| Answer too late | "Time's up! Your answer wasn't submitted in time." |
| Already answered | (Silently accepted; shows current selection) |
| Connection lost | "Reconnecting..." (auto-retry, no user action needed) |
| Player removed | "You have been removed from this game by the host." |
| Game ended | "This game has ended. Thanks for playing!" |

### 24.2 Admin-Facing Errors

More detailed, with recovery guidance:

| Situation | Message |
| --- | --- |
| Invalid Excel | "Could not read this file. Please use .xlsx or .xls format." |
| Invalid scoring | "Scoring bands must cover the full timer with no gaps or overlaps." |
| Session expired | "Your session has expired. Please log in again." (redirect to login) |
| Concurrent edit | "This game was modified by another session. Please refresh." |

### 24.3 Error Principles

- Never expose database errors, stack traces, or internal IDs
- Always suggest the next action the user can take
- Connection errors are handled silently with auto-retry where possible
- Validation errors appear inline next to the relevant field

---

## 25. Accessibility and Responsive Design

### 25.1 Accessibility (WCAG 2.1 AA Target)

- All interactive elements reachable via keyboard (Tab, Enter, Space)
- Visible focus indicators (2px solid outline, high contrast)
- Minimum contrast ratio: 4.5:1 for text, 3:1 for UI components
- Answer correctness indicated by icon + color (not color alone)
- Timer state announced to screen readers at 10s, 5s, and 0s
- Question transitions announced via ARIA live regions
- Touch targets: minimum 48x48px
- No information conveyed solely through animation

### 25.2 Responsive Breakpoints

| Breakpoint | Target | Layout |
| --- | --- | --- |
| < 640px | Mobile (player primary) | Single column, full-width buttons |
| 640-1024px | Tablet | Two-column where beneficial |
| > 1024px | Desktop (admin primary) | Multi-panel layouts |

### 25.3 Motion

- Respect `prefers-reduced-motion`: disable countdown pulse, leaderboard animations
- All animations are decorative, not informational

---

## 26. Proposed Technology Stack

```
Frontend:         Next.js + React + TypeScript
Styling:          Tailwind CSS (mobile-first utility classes)
State:            React Context + server state via real-time subscriptions
Backend:          Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
Real-time:        Supabase Realtime (channels per game room)
Excel:            SheetJS (xlsx) for parsing and generation
Hosting:          Vercel
Source control:   GitHub
```

**Key architectural decisions:**
- Scoring logic: Supabase Edge Functions (server-side, not client)
- Answer validation: PostgreSQL function with row-level locking
- Timer: Server timestamps only; client computes display locally
- Leaderboard: Denormalized score on player record, updated in answer-submission transaction
- Real-time: One Supabase Realtime channel per game room; host and players subscribe to the same channel with different event filters

---

## 27. API and Server Operations

### 27.1 Admin Operations (REST, authenticated)

```
POST   /api/admin/games                              Create game
GET    /api/admin/games                              List my games
GET    /api/admin/games/{id}                         Get game details
PATCH  /api/admin/games/{id}                         Update game
DELETE /api/admin/games/{id}                         Delete draft
POST   /api/admin/games/{id}/upload                  Upload Excel
POST   /api/admin/games/{id}/publish                 Publish game
POST   /api/admin/games/{id}/duplicate               Duplicate game
POST   /api/admin/games/{id}/start                   Start game
POST   /api/admin/games/{id}/next-question           Advance to next question
POST   /api/admin/games/{id}/end-question            End current question early
POST   /api/admin/games/{id}/pause                   Pause game
POST   /api/admin/games/{id}/resume                  Resume game
POST   /api/admin/games/{id}/complete                End game
DELETE /api/admin/games/{id}/players/{playerId}      Remove player
GET    /api/admin/games/{id}/results                 Get results
GET    /api/admin/games/{id}/export                  Download export
```

### 27.2 Player Operations (REST, session-token authenticated)

```
POST   /api/games/join                               Join game (room code + name)
POST   /api/games/reconnect                          Reconnect with session token
GET    /api/games/{id}/state                         Get current game state
POST   /api/games/{id}/answer                        Submit answer
GET    /api/games/{id}/leaderboard                   Get leaderboard
```

### 27.3 Real-Time (WebSocket/Supabase Realtime)

```
Channel: game:{gameId}

Host broadcasts:
  game:state_change    → { state, subState, ... }
  game:question        → { question, choices, startedAt, duration }
  game:question_end    → { correctAnswer, explanation }
  game:leaderboard     → { rankings }
  game:paused          → {}
  game:resumed         → { currentState }
  game:completed       → { finalRankings }

Server broadcasts:
  game:player_joined   → { playerCount }
  game:player_left     → { playerCount }
  game:answer_count    → { answered, total } (host only)
```

### 27.4 Transactional Operations

These must be atomic (database transaction):
- Player join (count check + insert)
- Answer submission (duplicate check + insert + score update)
- Question advancement (state update + timestamp set)

---

## 28. Acceptance Criteria

### 28.1 Game Creation

- [ ] Admin can create a game by uploading a valid Excel file in under 2 minutes
- [ ] Admin can create a game from scratch using the in-app editor
- [ ] Invalid Excel shows specific, actionable error messages with row/column references
- [ ] A failed import leaves no partial data in the database
- [ ] Default settings produce a playable game with zero configuration

### 28.2 Player Join

- [ ] A player can join in under 15 seconds on a mobile device
- [ ] Direct links with embedded room code require only a display name
- [ ] QR code scanning leads directly to the join screen with code pre-filled
- [ ] Room code input is forgiving (case-insensitive, strips whitespace)
- [ ] Clear, specific error messages for all failure cases

### 28.3 Multiplayer

- [ ] 100 players can join one room
- [ ] The 101st player is rejected with a clear message
- [ ] Two simultaneous joins at the limit do not exceed max_players
- [ ] All players receive the same question state within 500ms

### 28.4 Timer and Scoring

- [ ] Timer begins from server start timestamp
- [ ] Refreshing does not reset the timer
- [ ] An answer at 30.001 seconds (server time) is rejected
- [ ] Correct answer at 9.999s = 3 points
- [ ] Correct answer at 10.000s = 2 points
- [ ] Correct answer at 30.000s = 1 point
- [ ] Incorrect answer = 0 points
- [ ] A client clock change does not affect scoring

### 28.5 Answer Submission

- [ ] One tap submits an answer with immediate visual feedback
- [ ] Duplicate submission is handled gracefully (no error shown to player)
- [ ] Players cannot see correct answers before question close
- [ ] Players cannot modify scores

### 28.6 Leaderboard

- [ ] Leaderboard recalculated within 1 second after question close
- [ ] Rankings use documented tie-breakers deterministically
- [ ] Player always sees their own rank, even outside top 5
- [ ] Position change indicators (up/down/same) shown after question 1

### 28.7 Reconnection

- [ ] Refreshing restores the same player session instantly
- [ ] Previously submitted answers remain locked
- [ ] Score is unchanged after reconnect
- [ ] Host can reconnect and resume hosting without pausing the game
- [ ] No duplicate player records created on reconnect

### 28.8 Accessibility

- [ ] All screens usable with keyboard only
- [ ] All screens pass WCAG 2.1 AA contrast requirements
- [ ] Timer states announced to screen readers
- [ ] Answer correctness not conveyed by color alone
- [ ] Touch targets minimum 48x48px on mobile

### 28.9 Results

- [ ] Admin can export complete results as Excel
- [ ] Export totals match the final leaderboard exactly
- [ ] Export includes per-question statistics

---

## 29. MVP Scope

**Included:**
- Admin login
- Game creation (Excel upload + in-app editor)
- Excel validation with clear error reporting
- All configurable settings with sensible defaults
- Room code generation with QR code and shareable link
- Player join (mobile-optimized)
- Real-time lobby
- Host console with all live controls
- Server-side timer
- Server-side scoring with configurable bands
- 100-player support
- Real-time leaderboard with position changes
- Final results and export
- Player and host reconnection
- Basic accessibility (keyboard, contrast, screen reader announcements)

**Excluded from MVP:**
- Teams or group play
- Chat
- Spectator mode
- Audio, video, or image-upload questions (URL-based images only)
- AI-generated questions
- Multiple simultaneous hosts
- Social login or player accounts
- Native mobile apps
- Offline play
- More than 100 players per game
- Multiple concurrent games per admin (admin can only host one game at a time in MVP)

---

## 30. Implementation Phases

### Phase 1: Foundation (Week 1-2)

- Database schema and migrations
- Admin authentication (login, logout, password reset)
- Game CRUD with settings
- Question CRUD (in-app editor)

### Phase 2: Content Import (Week 3)

- Excel template (downloadable)
- Upload, parse, validate
- Preview with error/warning display
- Transactional import

### Phase 3: Multiplayer Core (Week 4-5)

- Room code generation and validation
- Player join flow (mobile-optimized)
- Real-time lobby (player list, count)
- Player session management
- Max-player enforcement
- Reconnection (player and host)

### Phase 4: Quiz Engine (Week 5-6)

- Host console and controls
- Game state machine
- Question delivery via real-time channel
- Server-side timer
- Answer submission with validation
- Server-side scoring
- Answer change support (if configured)

### Phase 5: Results and Polish (Week 7)

- Live leaderboard with position tracking
- Final results screen
- Export (Excel and CSV)
- Tie-breaking
- QR code generation
- Direct-join links

### Phase 6: Hardening (Week 8)

- Load testing (100 simultaneous players)
- Reconnect and failure testing
- Security review
- Accessibility audit
- Mobile testing (iOS Safari, Android Chrome)
- Performance profiling
- Rate limiting
- Audit logging

---

## 31. Key Technical Decisions

1. The server is the source of truth for time. No client timestamps are trusted.
2. The server calculates all scores. No client-side scoring.
3. Correct answers are never sent to players before reveal.
4. Player limits are enforced transactionally with row locking.
5. Scoring is represented as configurable bands, not hard-coded conditions.
6. Excel uploads are validated completely before any persistence.
7. Game state transitions are explicit and host-controlled.
8. Players use temporary sessions, not permanent accounts.
9. All critical writes use uniqueness constraints and transactions.
10. The MVP is capped at 100 players per room.
11. Network latency is an accepted tradeoff; generous time bands minimize its impact.
12. Leaderboard scores are denormalized on the player record for O(1) ranking queries.
13. One admin can host one game at a time (simplifies MVP).
14. Host disconnect does not pause the game (avoids disruption to 100 players).

---

## 32. Definition of Done

The product is ready for release when:

- A non-technical administrator can create and run a complete game from an Excel file without reading documentation.
- A player can join and play an entire game on a mobile phone using only the room code.
- 100 simulated players can join, answer all questions, and see correct scores.
- Scores are correct at all timing boundaries (verified by automated tests).
- Duplicate and late answers are rejected without confusing the player.
- Refreshing or disconnecting never creates duplicate players or loses state.
- The leaderboard is accurate, deterministic, and updates within 1 second.
- Results can be exported and totals match the leaderboard.
- Players cannot view answers early or manipulate scores.
- All player screens pass WCAG 2.1 AA contrast and keyboard accessibility.
- No critical security, data-loss, or synchronization defects remain.
- The host can reconnect and resume without disrupting an active game.
