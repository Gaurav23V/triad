import type { Cell, GameStatus } from './game_logic.js'

export const OpCode = {
  MOVE: 1,
  STATE: 2,
  ERROR: 3,
  CLAIM_FORFEIT: 4,
} as const

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
}

export interface MovePayload {
  cell: number
}
