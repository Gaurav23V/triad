import {
  emptyBoard,
  checkWinner,
  isDraw,
  validateMove,
  type Cell,
  type Mark,
  type GameStatus,
} from './game_logic.js'
import {
  OpCode,
  type PlayerInfo,
  type PublicState,
  type MovePayload,
  type GameEndReason,
} from './protocol.js'
import { recordMatchOutcome } from './stats.js'
import { unregisterOpenRoom } from './room_index.js'

export const moduleName = 'triad_match'

const tickRate = 10
const idleMatchSec = 600
const forfeitGraceTicks = 10 * tickRate
const timedTurnSec = 30

interface MatchLabel {
  open: number
  room_code: string
  room_name: string
  mode: string
}

export type MatchCompletionReason =
  | 'normal'
  | 'intentional_leave'
  | 'forfeit_claim'
  | 'disconnect_timeout'

export interface MatchState {
  label: MatchLabel
  emptyTicks: number
  presences: Record<string, nkruntime.Presence | null>
  joinsInProgress: number
  board: Cell[]
  currentTurn: Mark
  players: { X: PlayerInfo | null; O: PlayerInfo | null }
  status: GameStatus
  winner: Mark | 'draw' | null
  winLine: number[] | null
  mode: 'classic' | 'timed'
  turnTicksRemaining: number
  disconnectedUserId: string | null
  forfeitGraceTicksRemaining: number
  statsRecorded: boolean
  /** Set when status becomes completed (why the match ended). */
  completionReason: MatchCompletionReason | null
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

function connectedHumans(state: MatchState): nkruntime.Presence[] {
  const out: nkruntime.Presence[] = []
  for (const uid of Object.keys(state.presences)) {
    const p = state.presences[uid]
    if (p !== null) out.push(p)
  }
  return out
}

function markForUser(state: MatchState, userId: string): Mark | null {
  if (state.players.X?.userId === userId) return 'X'
  if (state.players.O?.userId === userId) return 'O'
  return null
}

function gameEndReasonForViewer(state: MatchState, viewerUserId: string): GameEndReason {
  if (state.status !== 'completed') return null
  const wr = state.winner
  if (wr === 'draw' || wr === null) return null
  const cr = state.completionReason
  if (!cr || cr === 'normal') return null
  const viewerMark = markForUser(state, viewerUserId)
  if (!viewerMark) return null
  if (cr === 'intentional_leave') {
    return wr === viewerMark ? 'opponent_intentional_leave' : 'you_intentional_leave'
  }
  if (cr === 'forfeit_claim') {
    return wr === viewerMark ? null : 'opponent_claimed_forfeit'
  }
  if (cr === 'disconnect_timeout') {
    return wr === viewerMark ? 'opponent_disconnect_timeout' : 'you_disconnect_timeout'
  }
  return null
}

function buildPublicState(state: MatchState, viewerUserId: string): PublicState {
  const oppDisconnected =
    state.disconnectedUserId !== null && state.disconnectedUserId !== viewerUserId

  let forfeitGraceEndsSec: number | null = null
  if (state.forfeitGraceTicksRemaining > 0 && oppDisconnected) {
    forfeitGraceEndsSec = nowSec() + Math.ceil(state.forfeitGraceTicksRemaining / tickRate)
  }

  return {
    board: [...state.board],
    currentTurn: state.status === 'in_progress' ? state.currentTurn : null,
    players: { ...state.players },
    status: state.status,
    winner: state.winner,
    winLine: state.winLine,
    roomCode: state.label.room_code,
    roomName: state.label.room_name,
    mode: state.mode,
    turnDeadlineSec:
      state.mode === 'timed' && state.status === 'in_progress'
        ? nowSec() + Math.ceil(state.turnTicksRemaining / tickRate)
        : null,
    disconnectedOpponentId: oppDisconnected ? state.disconnectedUserId : null,
    forfeitGraceEndsSec,
    canClaimForfeit: oppDisconnected && state.status === 'in_progress',
    gameEndReason: gameEndReasonForViewer(state, viewerUserId),
  }
}

function broadcastState(
  dispatcher: nkruntime.MatchDispatcher,
  state: MatchState,
  reliable = true,
): void {
  const humans = connectedHumans(state)
  for (const p of humans) {
    const payload = buildPublicState(state, p.userId)
    dispatcher.broadcastMessage(OpCode.STATE, JSON.stringify(payload), [p], null, reliable)
  }
}

function finalizeGame(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  state: MatchState,
  winnerMark: Mark | 'draw' | null,
): void {
  if (state.statsRecorded) return
  state.statsRecorded = true
  recordMatchOutcome(nk, logger, winnerMark, state.players.X, state.players.O)
}

export function randomRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export const matchInit: nkruntime.MatchInitFunction<MatchState> = function (
  _ctx,
  _logger,
  _nk,
  params,
) {
  const roomName = params.roomName ?? 'Game'
  const roomCode = params.roomCode ?? randomRoomCode()
  const mode = params.mode === 'timed' ? 'timed' : 'classic'

  const label: MatchLabel = {
    open: 1,
    room_code: roomCode,
    room_name: roomName,
    mode,
  }

  const state: MatchState = {
    label,
    emptyTicks: 0,
    presences: {},
    joinsInProgress: 0,
    board: emptyBoard(),
    currentTurn: 'X',
    players: { X: null, O: null },
    status: 'waiting_opponent',
    winner: null,
    winLine: null,
    mode,
    turnTicksRemaining: timedTurnSec * tickRate,
    disconnectedUserId: null,
    forfeitGraceTicksRemaining: 0,
    statsRecorded: false,
    completionReason: null,
  }

  return {
    state,
    tickRate,
    label: JSON.stringify(label),
  }
}

export const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<MatchState> = function (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
  presence,
  _metadata,
) {
  if (presence.userId in state.presences) {
    if (state.presences[presence.userId] === null) {
      const mark = markForUser(state, presence.userId)
      if (
        mark &&
        (state.status === 'in_progress' ||
          state.status === 'completed' ||
          state.status === 'waiting_opponent')
      ) {
        state.joinsInProgress++
        return { state, accept: true }
      }
      return { state, accept: false, rejectMessage: 'cannot rejoin match' }
    }
    return { state, accept: false, rejectMessage: 'already joined' }
  }

  const humans = connectedHumans(state).length + state.joinsInProgress
  if (humans >= 2) {
    return { state, accept: false, rejectMessage: 'match full' }
  }

  state.joinsInProgress++
  return { state, accept: true }
}

export const matchJoin: nkruntime.MatchJoinFunction<MatchState> = function (
  ctx,
  logger,
  nk,
  dispatcher,
  _tick,
  state,
  presences,
) {
  for (const presence of presences) {
    state.presences[presence.userId] = presence
    state.joinsInProgress--
    state.emptyTicks = 0

    const username = presence.username || 'Player'

    if (state.disconnectedUserId === presence.userId) {
      state.disconnectedUserId = null
      state.forfeitGraceTicksRemaining = 0
    }

    const existingMark = markForUser(state, presence.userId)
    if (existingMark) {
      state.players[existingMark] = { userId: presence.userId, username }
    } else if (!state.players.X) {
      state.players.X = { userId: presence.userId, username }
    } else if (!state.players.O && state.players.X.userId !== presence.userId) {
      state.players.O = { userId: presence.userId, username }
    }

    if (state.players.X && state.players.O && state.status === 'waiting_opponent') {
      state.status = 'in_progress'
      state.board = emptyBoard()
      state.currentTurn = 'X'
      state.winner = null
      state.winLine = null
      state.disconnectedUserId = null
      state.forfeitGraceTicksRemaining = 0
      state.statsRecorded = false
      state.completionReason = null
      state.turnTicksRemaining = timedTurnSec * tickRate
      unregisterOpenRoom(nk, state.label.room_code)
    }

    if (state.label.open === 1 && connectedHumans(state).length >= 2) {
      state.label.open = 0
      dispatcher.matchLabelUpdate(JSON.stringify(state.label))
    }
  }

  broadcastState(dispatcher, state)
  logger.debug('match %s join complete', ctx.matchId)
  return { state }
}

export const matchLeave: nkruntime.MatchLeaveFunction<MatchState> = function (
  _ctx,
  logger,
  _nk,
  dispatcher,
  _tick,
  state,
  presences,
) {
  for (const presence of presences) {
    logger.info('Player left match: %s', presence.userId)
    state.presences[presence.userId] = null

    if (state.status === 'in_progress') {
      state.disconnectedUserId = presence.userId
      state.forfeitGraceTicksRemaining = forfeitGraceTicks
    }
  }

  broadcastState(dispatcher, state)

  return { state }
}

export const matchLoop: nkruntime.MatchLoopFunction<MatchState> = function (
  _ctx,
  logger,
  nk,
  dispatcher,
  _tick,
  state,
  messages,
) {
  if (connectedHumans(state).length + state.joinsInProgress === 0) {
    state.emptyTicks++
    if (state.emptyTicks >= idleMatchSec * tickRate) {
      logger.info('closing idle match')
      return null
    }
  }

  if (
    state.status === 'in_progress' &&
    state.disconnectedUserId &&
    state.forfeitGraceTicksRemaining > 0
  ) {
    state.forfeitGraceTicksRemaining--
    if (state.forfeitGraceTicksRemaining <= 0) {
      const winnerUid = Object.keys(state.presences).find(
        (id) => state.presences[id] !== null && id !== state.disconnectedUserId,
      )
      const wm = winnerUid ? markForUser(state, winnerUid) : null
      if (wm) {
        state.status = 'completed'
        state.winner = wm
        state.winLine = null
        state.completionReason = 'disconnect_timeout'
        state.disconnectedUserId = null
        state.forfeitGraceTicksRemaining = 0
        finalizeGame(nk, logger, state, wm)
        broadcastState(dispatcher, state)
      }
    }
  }

  if (state.mode === 'timed' && state.status === 'in_progress' && !state.disconnectedUserId) {
    state.turnTicksRemaining--
    if (state.turnTicksRemaining <= 0) {
      const loser = state.currentTurn
      const winner: Mark = loser === 'X' ? 'O' : 'X'
      state.status = 'completed'
      state.winner = winner
      state.winLine = null
      state.completionReason = 'normal'
      finalizeGame(nk, logger, state, winner)
      broadcastState(dispatcher, state)
    }
  }

  for (const message of messages) {
    const senderId = message.sender.userId
    const senderOnly = [message.sender]

    if (message.opCode === OpCode.INTENTIONAL_LEAVE) {
      if (state.status !== 'in_progress') {
        dispatcher.broadcastMessage(
          OpCode.ERROR,
          JSON.stringify({ message: 'Cannot leave the match now.' }),
          senderOnly,
          null,
          true,
        )
        continue
      }
      const senderMark = markForUser(state, senderId)
      if (!senderMark) {
        dispatcher.broadcastMessage(
          OpCode.ERROR,
          JSON.stringify({ message: 'You are not in this game.' }),
          senderOnly,
          null,
          true,
        )
        continue
      }
      const winner: Mark = senderMark === 'X' ? 'O' : 'X'
      state.status = 'completed'
      state.winner = winner
      state.winLine = null
      state.disconnectedUserId = null
      state.forfeitGraceTicksRemaining = 0
      state.completionReason = 'intentional_leave'
      finalizeGame(nk, logger, state, winner)
      broadcastState(dispatcher, state)
      continue
    }

    if (message.opCode === OpCode.CLAIM_FORFEIT) {
      if (
        state.status !== 'in_progress' ||
        !state.disconnectedUserId ||
        state.disconnectedUserId === senderId
      ) {
        dispatcher.broadcastMessage(
          OpCode.ERROR,
          JSON.stringify({ message: 'Cannot claim forfeit now.' }),
          senderOnly,
          null,
          true,
        )
        continue
      }
      const claimer = markForUser(state, senderId)
      const disconnectedMark = markForUser(state, state.disconnectedUserId)
      if (!claimer || !disconnectedMark || claimer === disconnectedMark) {
        dispatcher.broadcastMessage(
          OpCode.ERROR,
          JSON.stringify({ message: 'Invalid forfeit claim.' }),
          senderOnly,
          null,
          true,
        )
        continue
      }
      state.status = 'completed'
      state.winner = claimer
      state.winLine = null
      state.forfeitGraceTicksRemaining = 0
      state.disconnectedUserId = null
      state.completionReason = 'forfeit_claim'
      finalizeGame(nk, logger, state, claimer)
      broadcastState(dispatcher, state)
      continue
    }

    if (
      message.opCode === OpCode.MOVE &&
      state.disconnectedUserId &&
      state.disconnectedUserId !== senderId
    ) {
      dispatcher.broadcastMessage(
        OpCode.ERROR,
        JSON.stringify({
          message: 'Opponent disconnected. Claim victory or wait for reconnect.',
        }),
        senderOnly,
        null,
        true,
      )
      continue
    }

    if (message.opCode !== OpCode.MOVE) {
      dispatcher.broadcastMessage(
        OpCode.ERROR,
        JSON.stringify({ message: 'Unknown message type.' }),
        senderOnly,
        null,
        true,
      )
      continue
    }

    let body: MovePayload
    try {
      body = JSON.parse(nk.binaryToString(message.data))
    } catch {
      dispatcher.broadcastMessage(
        OpCode.ERROR,
        JSON.stringify({ message: 'Invalid move payload.' }),
        senderOnly,
        null,
        true,
      )
      continue
    }

    const playerMark = markForUser(state, senderId)
    if (!playerMark) {
      dispatcher.broadcastMessage(
        OpCode.ERROR,
        JSON.stringify({ message: 'You are not in this game.' }),
        senderOnly,
        null,
        true,
      )
      continue
    }

    const err = validateMove(
      state.board,
      body.cell,
      state.currentTurn,
      playerMark,
      state.status,
    )
    if (err) {
      dispatcher.broadcastMessage(
        OpCode.ERROR,
        JSON.stringify({ message: err }),
        senderOnly,
        null,
        true,
      )
      continue
    }

    state.board[body.cell] = playerMark

    const w = checkWinner(state.board, playerMark, body.cell)
    if (w) {
      state.status = 'completed'
      state.winner = w.winner
      state.winLine = w.line
      state.completionReason = 'normal'
      finalizeGame(nk, logger, state, w.winner)
      broadcastState(dispatcher, state)
      continue
    }

    if (isDraw(state.board)) {
      state.status = 'completed'
      state.winner = 'draw'
      state.winLine = null
      state.completionReason = 'normal'
      finalizeGame(nk, logger, state, 'draw')
      broadcastState(dispatcher, state)
      continue
    }

    state.currentTurn = playerMark === 'X' ? 'O' : 'X'
    if (state.mode === 'timed') {
      state.turnTicksRemaining = timedTurnSec * tickRate
    }
    broadcastState(dispatcher, state)
  }

  return { state }
}

export const matchTerminate: nkruntime.MatchTerminateFunction<MatchState> = function (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
) {
  return { state }
}

export const matchSignal: nkruntime.MatchSignalFunction<MatchState> = function (
  _ctx,
  _logger,
  _nk,
  _dispatcher,
  _tick,
  state,
) {
  return { state }
}
