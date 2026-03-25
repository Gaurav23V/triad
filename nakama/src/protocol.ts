import type { Cell, GameStatus } from './game_logic.js'

export const OpCode = {
  MOVE: 1,
  STATE: 2,
  ERROR: 3,
  CLAIM_FORFEIT: 4,
  INTENTIONAL_LEAVE: 5,
} as const

/** Viewer-specific hint for game-over copy; null means use default win/lose/draw text. */
export type GameEndReason =
  | null
  | 'opponent_intentional_leave'
  | 'you_intentional_leave'
  | 'opponent_claimed_forfeit'
  | 'opponent_disconnect_timeout'
  | 'you_disconnect_timeout'

export type PlayerInfo = { userId: string; username: string }

export interface PublicState {
  board: Cell[]
  currentTurn: 'X' | 'O' | null
  players: { X: PlayerInfo | null; O: PlayerInfo | null }
  status: GameStatus
  winner: 'X' | 'O' | 'draw' | null
  winLine: number[] | null
  roomCode: string | null
  roomName: string | null
  mode: 'classic' | 'timed'
  turnDeadlineSec: number | null
  disconnectedOpponentId: string | null
  forfeitGraceEndsSec: number | null
  canClaimForfeit: boolean
  gameEndReason: GameEndReason
}

export interface MovePayload {
  cell: number
}
