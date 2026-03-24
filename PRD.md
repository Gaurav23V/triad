# Product Requirements Document (PRD)
## Multiplayer Tic-Tac-Toe Game with Nakama

---

## 1. Project Overview

### 1.1 Context
This is a backend engineering assignment for LILA, a company building technically complex multiplayer games. The assignment tests server-authoritative architecture skills, real-time systems design, and end-to-end ownership.

### 1.2 Objective
Build a production-ready, multiplayer Tic-Tac-Toe game using **Nakama** as the backend infrastructure with server-authoritative game logic, matchmaking system, and proper deployment.

### 1.3 Tech Stack
| Layer | Technology Options | Recommendation |
|-------|-------------------|---------------|
| Frontend | React, React Native, Flutter, Unity, etc. | React (easy setup, good real-time support) |
| Backend | Nakama (game server) | Nakama (required) |
| Database | Nakama's built-in (PostgreSQL) | Built-in |
| Deployment | AWS, GCP, Azure, DigitalOcean | Choose based on familiarity |

---

## 2. Core Requirements (Must-Have)

### 2.1 Frontend Requirements

#### 2.1.1 UI/UX
- [ ] Responsive UI optimized for mobile devices
- [ ] Game board display (3x3 grid)
- [ ] Player information display (names, symbols X/O)
- [ ] Match status indicators (waiting, in-progress, game-over)
- [ ] Real-time game state updates without page refresh

#### 2.1.2 Game Interactions
- [ ] Create new game room
- [ ] Join existing game room
- [ ] Make moves on the board
- [ ] See opponent's moves in real-time
- [ ] Receive game-over notification (win/loss/draw)

### 2.2 Backend Requirements (Nakama)

#### 2.2.1 Server-Authoritative Game Logic

**Game State Management**
- [ ] All game state managed server-side
- [ ] Game state includes:
  - Current player turn
  - Board state (9 cells, each can be empty/X/O)
  - Player assignments (who is X, who is O)
  - Game status (waiting for players, in-progress, completed)
  - Winner (if game is over)

**Move Validation**
- [ ] Validate move is within valid range (cells 0-8)
- [ ] Validate cell is empty
- [ ] Validate it's the correct player's turn
- [ ] Validate game is still in progress
- [ ] Reject invalid moves with appropriate error messages

**Anti-Cheat Measures**
- [ ] No client-can bypass move validation
- [ ] Server maintains authoritative state
- [ ] Broadcast only validated game state to clients

**Win/Draw Detection**
- [ ] Detect winning conditions (8 winning patterns)
```
Winning patterns:
- Rows: (0,1,2), (3,4,5), (6,7,8)
- Columns: (0,3,6), (1,4,7), (2,5,8)
- Diagonals: (0,4,8), (2,4,6)
```
- [ ] Detect draw condition (board full, no winner)

**State Broadcasting**
- [ ] Broadcast game state updates to all connected players after each validated move
- [ ] Include turn information in broadcast
- [ ] Include game status in broadcast

#### 2.2.2 Matchmaking System

**Room Creation**
- [ ] Allow players to create named game rooms
- [ ] Assign creator as player X
- [ ] Set initial game state (waiting for opponent)

**Room Discovery & Joining**
- [ ] List available game rooms (games waiting for players)
- [ ] Allow players to join specific rooms
- [ ] Assign joining player as player O
- [ ] Start game when second player joins

**Automatic Matchmaking**
- [ ] Implement matchmaking to auto-pair players
- [ ] Queue players looking for games
- [ ] Pair players when 2 are available
- [ ] Create match automatically for paired players

**Connection Handling**
- [ ] Handle player disconnections gracefully
- [ ] Detect when player leaves mid-game
- [ ] Option to: forfeit game for disconnected player, or allow reconnection
- [ ] Clean up game state appropriately

### 2.3 Deployment Requirements

#### 2.3.1 Nakama Server
- [ ] Deploy Nakama to cloud provider
- [ ] Configure server for public access
- [ ] Ensure websocket connections work from client
- [ ] Provide server endpoint URL

#### 2.3.2 Frontend Application
- [ ] Deploy frontend with public accessibility
- [ ] Ensure frontend can connect to deployed Nakama

#### 2.3.3 Documentation
- [ ] Setup and installation instructions
- [ ] Architecture and design decisions
- [ ] Deployment process documentation
- [ ] API/server configuration details
- [ ] How to test multiplayer functionality

---

## 3. Optional Features (Bonus Points)

### 3.1 Concurrent Game Support

**Architecture Requirements**
- [ ] Handle multiple simultaneous game sessions
- [ ] Proper game room isolation (games don't interfere with each other)
- [ ] Scalable architecture for concurrent players

**Implementation Considerations**
- Each game session should be independent
- Server should handle N concurrent games efficiently
- Consider using Nakama's match handler pattern

### 3.2 Leaderboard System

**Player Statistics**
- [ ] Track player wins
- [ ] Track player losses
- [ ] Track player draws
- [ ] Track win streaks

**Global Ranking**
- [ ] Implement global ranking system
- [ ] Display top players with statistics
- [ ] Persist player performance data in Nakama storage

**Display**
- [ ] Leaderboard UI showing top players
- [ ] Player's own rank and stats

### 3.3 Timer-Based Game Mode

**Timer Mechanics**
- [ ] Add time limit per player per turn (e.g.,30 seconds)
- [ ] Countdown timer visible to both players
- [ ] Timer resets after each move

**Timeout Handling**
- [ ] Automatic forfeit when time runs out
- [ ] Notify both players of timeout result

**Matchmaking Extension**
- [ ] Support mode selection during matchmaking
- [ ] Classic mode (no timer)
- [ ] Timed mode (with timer)

---

## 4. Technical Architecture

### 4.1 Nakama Components to Use

| Component | Purpose |
|-----------|---------|
| Authoritative Match | Server-side game logic |
| Match Handler | Manage game state, validate moves |
| Realtime Sessions | WebSocket connections for real-time updates |
| Storage Engine | Persist player stats (leaderboard) |
| Matchmaker | Auto-pair players |

### 4.2 Game State Structure (Example)

```json
{
  "board": ["", "", "", "", "", "", "", "", ""],
  "currentTurn": "X",
  "players": {
    "X": {"userId": "player1_id", "username": "player1"},
    "O": {"userId": "player2_id", "username": "player2"}
  },
  "status": "in_progress",
  "winner": null,
  "presences": []
}
```

### 4.3 Data Flow

```
1. Player connects via WebSocket (Nakama session)
2. Player requests matchmaking or creates room
3. Match created/paired via Nakama matchmaker
4. Player makes move -> sent to server
5. Server validates move
6. If valid: update state, broadcast to all players
7. If invalid: send error to player
8. Check win/draw condition
9. If game over: broadcast result, update stats
```

---

## 5. User Experience & Game Flow Examples

This section provides detailed walkthroughs of each feature with visual examples of how the game should look and behave from the player's perspective.

### 5.1 Core Features (Must-Have)

#### 5.1.1 Create New Game Room

**What it looks like:**
- Player opens app, sees home screen
- "Create Game" button is visible
- Player taps it → a new game room is created
- Player is assigned symbol X and sees empty 3x3 board
- Status shows: "Waiting for opponent to join..."
- A game code/room ID may be displayed that player can share

```
┌─────────────────────────┐
│   Waiting for player   │
│                         │
│   ┌───┬───┬───┐        │
│   │   │   │   │        │
│   ├───┼───┼───┤        │
│   │   │   │   │        │
│   ├───┼───┼───┤        │
│   │   │   │   │        │
│   └───┴───┴───┘        │
│                         │
│   You are: X            │
│   Room: ABC123          │
└─────────────────────────┘
```

---

#### 5.1.2 Join Game Room

**What it looks like:**
- Player sees "Join Game" option
- Can enter a room code OR see list of available games
- Player taps a game → joins as player O
- Board becomes active and game starts
- Both players see: "Game in progress - X's turn"

```
┌─────────────────────────┐
│  Available Games        │
│                         │
│  • Game123 (waiting)    │
│  • Game456 (waiting)    │
│  • Game789 (waiting)    │
│                         │
│  [Join Selected Game]   │
└─────────────────────────┘

After joining:
┌─────────────────────────┐
│   Your turn: O          │
│   Waiting for X...      │
│                         │
│   ┌───┬───┬───┐        │
│   │   │   │   │        │
│   ├───┼───┼───┤        │
│   │   │   │   │        │
│   ├───┼───┼───┤        │
│   │   │   │   │        │
│   └───┴───┴───┘        │
└─────────────────────────┘
```

---

#### 5.1.3 Automatic Matchmaking

**What it looks like:**
- Player taps "Quick Match" or "Find Game"
- System searches for another player also queued
- When found, both are matched and game starts automatically
- No need to share codes or wait manually

```
┌─────────────────────────┐
│   Finding opponent...   │
│   ●●●                   │
│  (animated spinner)     │
└─────────────────────────┘

Found match:
┌─────────────────────────┐
│   Opponent found!       │
│   Starting game...      │
│   You are: X            │
│   Your turn!            │
└─────────────────────────┘
```

---

#### 5.1.4 Making a Move (Server-Authoritative)

**What it looks like:**
- Player X taps an empty cell on their turn
- Move is sent to server for validation
- Server checks: Is it X's turn? Is cell empty? Is game in progress?
- If valid →Server updates state, broadcasts to both players
- Both players see the move appear simultaneously

```
Player X's view (their turn):
┌─────────────────────────┐
│   Your turn!            │
│                         │
│   ┌───┬───┬───┐        │
│   │   │   │   │        │
│   ├───┼───┼───┤        │
│   │   │ X │   │ ← tap here│
│   ├───┼───┼───┤        │
│   │   │   │   │        │
│   └───┴───┴───┘        │
└─────────────────────────┘

After server validation, both see:
┌─────────────────────────┐
│   O's turn              │
│                         │
│   ┌───┬───┬───┐        │
│   │   │   │   │        │
│   ├───┼───┼───┤        │
│   │   │ X │   │        │
│   ├───┼───┼───┤        │
│   │   │   │   │        │
│   └───┴───┴───┘        │
│                         │
│   (O's board is highlighted)│
└─────────────────────────┘
```

**If player tries to cheat (e.g., hack client to move when not their turn):**
- Server rejects the move
- Player sees error: "Not your turn!" or "Invalid move"
- Board state remains unchanged

---

#### 5.1.5 Win/Draw Detection

**What it looks like:**

**Win:**
- After each move, server checks winning patterns
- If winner found, broadcast "Player X wins!"
- Highlight winning line on board
- Show play again option

```
┌─────────────────────────┐
│ 🎉 X WINS! 🎉 │
│                         │
│   ┌───┬───┬───┐        │
│   │ X │ X │ X │ ← highlighted│
│   ├───┼───┼───┤        │
│   │ O │ O │   │        │
│   ├───┼───┼───┤        │
│   │   │   │ O │        │
│   └───┴───┴───┘        │
│                         │
│   [Play Again] [Exit]   │
└─────────────────────────┘
```

**Draw:**
- Board is full, no winner
- Show "It's a draw!"

```
┌─────────────────────────┐
│   🤝 DRAW!              │
│                         │
│   ┌───┬───┬───┐        │
│   │ X │ O │ X │        │
│   ├───┼───┼───┤        │
│   │ X │ X │ O │        │
│   ├───┼───┼───┤        │
│   │ O │ X │ O │        │
│   └───┴───┴───┘        │
│                         │
│   [Play Again] [Exit]   │
└─────────────────────────┘
```

---

#### 5.1.6 Player Disconnection Handling

**What it looks like:**

**Player disconnects mid-game:**
- System detects player left
- Remaining player sees: "Opponent disconnected"
- Option to wait for reconnection OR claim win

```
┌─────────────────────────┐
│   ⚠ Opponent left       │
│                         │
│   Waiting for reconnect │
│   (10s timeout)         │
│                         │
│   [Claim Victory]       │
└─────────────────────────┘
```

**If opponent doesn't return:**
- Game ends
- Remaining player wins by forfeit

---

### 5.2 Bonus Features

#### 5.2.1 Leaderboard System

**What it looks like:**
- Separate "Leaderboard" screen/tab
- Lists top players with: Rank, Username, Wins, Losses, Win Streak
- Shows logged-in player's rank at bottom or highlighted

```
┌─────────────────────────┐
│   LEADERBOARD           │
│                         │
│   #1  PlayerA   🏆156W 23L│
│   #2  PlayerB      142W 31L│
│   #3  PlayerC      138W 19L│
│   #4  PlayerD      134W 45L│
│   #5  PlayerE      128W 52L│
│                         │
│   ─────────────────     │
│   #47 You         12W5L │
│                         │
│   [Back to Menu]        │
└─────────────────────────┘
```

After each game, stats update automatically.

---

#### 5.2.2 Timer-Based Game Mode

**What it looks like:**

**Mode selection:**
```
┌─────────────────────────┐
│   Select Game Mode      │
│                         │
│   [Classic - No Timer]  │
│   [Speed - 30s/turn]    │
└─────────────────────────┘
```

**In-game with timer:**
```
┌─────────────────────────┐
│   Your turn!            │
│   ⏱ 23 seconds         │
│                         │
│   ┌───┬───┬───┐        │
│   │ X │   │   │        │
│   ├───┼───┼───┤        │
│   │   │ O │   │        │
│   ├───┼───┼───┤        │
│   │   │   │   │        │
│   └───┴───┴───┘        │
│                         │
│   Opponent timer: 30s   │
└─────────────────────────┘
```

**When timer runs out:**
```
┌─────────────────────────┐
│   ⏰ TIME'S UP!         │
│                         │
│   You forfeited!        │
│   Opponent wins!        │
│                         │
│   [Play Again] [Exit]   │
└─────────────────────────┘
```

---

#### 5.2.3 Concurrent Games

**What it looks like:**
- Player can be in multiple games simultaneously
- Dashboard shows list of active games
- Player can switch between games

```
┌─────────────────────────┐
│   YOUR GAMES            │
│                         │
│   vs PlayerA            │
│   Your turn (X)         │
│   ┌───┬───┬───┐        │
│   │ X │   │ O │        │
│   └───┴───┴───┘        │
│   [Open]               │
│                         │
│   vs PlayerB            │
│   Opponent's turn (O)   │
│   ┌───┬───┬───┐        │
│   │ X │ O │   │        │
│   └───┴───┴───┘        │
│   [Open]               │
└─────────────────────────┘
```

---

### 5.3 Complete User Journey Flow

```
Player Journey:
│
├─→ Home Screen
│     ├─→ Create Game → Wait for opponent → Game starts
│     ├─→ Join Game → Select room → Game starts
│     └─→ Quick Match → Auto-match → Game starts
│
├─→ In Game
│     ├─→ Wait for turn
│     ├─→ Make move → Server validates → Board updates
│     ├─→ Win/Draw detected → Game over screen
│     └─→ Opponent disconnects → Win by forfeit OR wait
│
├─→ Post Game
│     ├─→ See result
│     ├─→ Stats updated (if leaderboard)
│     └─→ Play again OR return to menu
│
└─→ Leaderboard (bonus)
      └─→ View rankings → Return to menu
```

---

## 6. Deliverables Checklist

### 6.1 Code Repository
- [ ] Source code for frontend
- [ ] Source code for backend (Nakama modules if any)
- [ ] Docker/configuration files if applicable
- [ ] Environment configuration templates

### 6.2 Deployment Artifacts
- [ ] Deployed Nakama server endpoint URL
- [ ] Deployed frontend application URL
- [ ] Working multiplayer game accessible publicly

### 6.3 Documentation (README.md)
- [ ] Project overview
- [ ] Tech stack used
- [ ] Prerequisites and dependencies
- [ ] Local setup instructions
- [ ] How to run locally
- [ ] Architecture diagram/description
- [ ] Design decisions and rationale
- [ ] Deployment instructions
- [ ] API configuration (server keys, ports, etc.)
- [ ] How to test multiplayer (step-by-step guide)

---

## 7. Success Criteria

### 7.1 Functional Requirements
- [ ] Two players can play against each other in real-time
- [ ] Game correctly identifies wins, losses, and draws
- [ ] Players cannot cheat by modifying client-side state
- [ ] Matchmaking successfully pairs players
- [ ] Game handles player disconnections gracefully

### 7.2 Non-Functional Requirements
- [ ] Real-time updates with minimal latency (< 500ms)
- [ ] Supports multiple concurrent games
- [ ] Responsive UI works on mobile devices
- [ ] Clear, maintainable code structure

### 7.3 Production Readiness
- [ ] Deployed and accessible publicly
- [ ] Proper error handling
- [ ] Clear documentation

---

## 8. Development Phases (Suggested Order)

### Phase 1: Backend Core (Priority: Highest)
1. Set up Nakama server locally (Docker recommended)
2. Create authoritative match handler
3. Implement game state management
4. Implement move validation
5. Implement win/draw detection
6. Test with Nakama console

### Phase 2: Matchmaking (Priority: High)
1. Implement room creation
2. Implement room joining
3. Implement matchmaking queue
4. Handle player presence (join/leave)

### Phase 3: Frontend (Priority: Medium)
1. Set up chosen frontend framework
2. Implement Nakama client connection
3. Create game board UI
4. Implement matchmaking UI
5. Wire up real-time state updates

### Phase 4: Deployment (Priority: High)
1. Deploy Nakama to cloud
2. Deploy frontend
3. Configure networking/security
4. Test deployed version

### Phase 5: Bonus Features (Priority: Low)
1. Timer-based mode
2. Leaderboard system
3. Concurrent game testing at scale

---

## 9. References

- [Nakama Documentation](https://heroiclabs.com/docs/nakama/)
- [Nakama Authoritative Match Guide](https://heroiclabs.com/docs/nakama/concepts/match-authoritative/)
- [Nakama JavaScript Client](https://heroiclabs.com/docs/nakama/client-libraries/client-libraries/javascript/)