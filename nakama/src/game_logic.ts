export const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

export type Cell = '' | 'X' | 'O'
export type Mark = 'X' | 'O'
export type GameStatus = 'waiting_opponent' | 'in_progress' | 'completed'

export interface GameSnapshot {
  board: Cell[]
  currentTurn: Mark | null
  status: GameStatus
  winner: Mark | 'draw' | null
  winLine: number[] | null
}

export function emptyBoard(): Cell[] {
  return ['', '', '', '', '', '', '', '', '']
}

export function checkWinner(
  board: Cell[],
  lastMark: Mark,
  lastCell: number,
): { winner: Mark; line: number[] } | null {
  for (const line of WIN_LINES) {
    if (!line.includes(lastCell)) continue
    const [a, b, c] = line
    if (board[a] === lastMark && board[b] === lastMark && board[c] === lastMark) {
      return { winner: lastMark, line }
    }
  }
  return null
}

export function isDraw(board: Cell[]): boolean {
  return board.every((c) => c !== '')
}

export function validateMove(
  board: Cell[],
  cell: number,
  currentTurn: Mark,
  playerMark: Mark,
  status: GameStatus,
): string | null {
  if (status !== 'in_progress') return 'Game is not in progress.'
  if (playerMark !== currentTurn) return 'Not your turn.'
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) return 'Invalid cell.'
  if (board[cell] !== '') return 'Cell is not empty.'
  return null
}
