import type { Mark } from './game_logic.js'

const COLLECTION = 'triad_stats'
const KEY = 'player'

export interface PlayerStats {
  wins: number
  losses: number
  draws: number
  winStreak: number
}

const defaultStats = (): PlayerStats => ({
  wins: 0,
  losses: 0,
  draws: 0,
  winStreak: 0,
})

export function readPlayerStats(nk: nkruntime.Nakama, userId: string): PlayerStats {
  const res = nk.storageRead([{ collection: COLLECTION, key: KEY, userId }])
  if (!res.length || !res[0].value) return defaultStats()
  const v = res[0].value as Record<string, number>
  return {
    wins: Number(v.wins) || 0,
    losses: Number(v.losses) || 0,
    draws: Number(v.draws) || 0,
    winStreak: Number(v.winStreak) || 0,
  }
}

function writePlayerStats(nk: nkruntime.Nakama, userId: string, stats: PlayerStats): void {
  nk.storageWrite([
    {
      collection: COLLECTION,
      key: KEY,
      userId,
      value: { ...stats },
      permissionRead: 2,
      permissionWrite: 0,
    },
  ])
}

const LB_ID = 'triad_rank'

function ensureLeaderboard(nk: nkruntime.Nakama): void {
  try {
    nk.leaderboardCreate(
      LB_ID,
      true,
      nkruntime.SortOrder.DESCENDING,
      nkruntime.Operator.SET,
      null,
      null,
      true,
    )
  } catch {
    // exists
  }
}

function publishLeaderboard(
  nk: nkruntime.Nakama,
  userId: string,
  username: string,
  stats: PlayerStats,
): void {
  ensureLeaderboard(nk)
  nk.leaderboardRecordWrite(LB_ID, userId, username, stats.wins, stats.winStreak, {
    losses: stats.losses,
    draws: stats.draws,
  })
}

export function recordMatchOutcome(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  winnerMark: Mark | 'draw' | null,
  x: { userId: string; username: string } | null,
  o: { userId: string; username: string } | null,
): void {
  if (!x || !o) return
  try {
    const sx = readPlayerStats(nk, x.userId)
    const so = readPlayerStats(nk, o.userId)

    if (winnerMark === 'draw') {
      sx.draws++
      sx.winStreak = 0
      so.draws++
      so.winStreak = 0
    } else if (winnerMark === 'X') {
      sx.wins++
      sx.winStreak++
      so.losses++
      so.winStreak = 0
    } else if (winnerMark === 'O') {
      so.wins++
      so.winStreak++
      sx.losses++
      sx.winStreak = 0
    }

    writePlayerStats(nk, x.userId, sx)
    writePlayerStats(nk, o.userId, so)
    publishLeaderboard(nk, x.userId, x.username, sx)
    publishLeaderboard(nk, o.userId, o.username, so)
  } catch (e) {
    logger.error('recordMatchOutcome failed: %v', e)
  }
}
