import {
  emptyBoard,
  checkWinner,
  isDraw,
  validateMove,
} from './game_logic'

describe('game_logic', () => {
  test('validateMove rejects wrong turn', () => {
    const board = emptyBoard()
    expect(validateMove(board, 0, 'O', 'X', 'in_progress')).toBe('Not your turn.')
  })

  test('validateMove accepts legal move', () => {
    const board = emptyBoard()
    expect(validateMove(board, 4, 'X', 'X', 'in_progress')).toBeNull()
  })

  test('checkWinner detects row', () => {
    const board = emptyBoard()
    board[0] = 'X'
    board[1] = 'X'
    board[2] = 'X'
    const w = checkWinner(board, 'X', 2)
    expect(w?.winner).toBe('X')
    expect(w?.line).toEqual([0, 1, 2])
  })

  test('isDraw', () => {
    const b = ['X', 'O', 'X', 'X', 'X', 'O', 'O', 'X', 'O'] as const
    expect(isDraw([...b])).toBe(true)
  })
})
