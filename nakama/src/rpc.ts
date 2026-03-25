import { moduleName, randomRoomCode } from './match_handler.js'
import { readRoomIndex, registerOpenRoom, unregisterOpenRoom, writeRoomIndex } from './room_index.js'

export const rpcTriadCreateRoom: nkruntime.RpcFunction = function (
  ctx,
  logger,
  nk,
  payload,
) {
  if (!ctx.userId) throw Error('Unauthenticated')

  let roomName = 'Game'
  let mode: 'classic' | 'timed' = 'classic'
  if (payload) {
    try {
      const p = JSON.parse(payload) as { roomName?: string; mode?: string }
      if (typeof p.roomName === 'string' && p.roomName.trim()) {
        roomName = p.roomName.trim().slice(0, 40)
      }
      if (p.mode === 'timed') mode = 'timed'
    } catch (e) {
      logger.error('create_room parse: %v', e)
    }
  }

  const roomCode = randomRoomCode()
  const matchId = nk.matchCreate(moduleName, { roomName, roomCode, mode })
  registerOpenRoom(nk, roomCode)

  return JSON.stringify({ matchId, roomCode, roomName, mode })
}

export const rpcTriadListOpenRooms: nkruntime.RpcFunction = function (_ctx, _logger, nk) {
  const idx = readRoomIndex(nk)
  const open: { roomCode: string; roomName: string; mode: string; matchId: string }[] = []

  const remaining: string[] = []
  for (const code of idx.codes) {
    const q = `+label.room_code:${code} +label.open:1`
    const matches = nk.matchList(1, true, null, null, 2, q)
    if (matches.length > 0) {
      let roomName = 'Game'
      let mode = 'classic'
      try {
        const label = JSON.parse(matches[0].label ?? '{}') as {
          room_name?: string
          mode?: string
        }
        roomName = label.room_name || 'Game'
        mode = label.mode === 'timed' ? 'timed' : 'classic'
      } catch {
        /* ignore */
      }
      open.push({
        roomCode: code,
        roomName,
        mode,
        matchId: matches[0].matchId,
      })
      remaining.push(code)
    }
  }

  if (remaining.length !== idx.codes.length) {
    writeRoomIndex(nk, remaining)
  }

  return JSON.stringify({ rooms: open })
}

export const rpcTriadJoinByCode: nkruntime.RpcFunction = function (ctx, logger, nk, payload) {
  if (!ctx.userId) throw Error('Unauthenticated')
  if (!payload) throw Error('Expected payload')

  let roomCode = ''
  try {
    roomCode = (JSON.parse(payload) as { roomCode?: string }).roomCode?.trim().toUpperCase() ?? ''
  } catch (e) {
    logger.error('join_by_code parse: %v', e)
    throw Error('Invalid payload')
  }
  if (!roomCode) throw Error('roomCode required')

  const q = `+label.room_code:${roomCode} +label.open:1`
  const matches = nk.matchList(1, true, null, null, 2, q)
  if (!matches.length) throw Error('Room not found or full')

  unregisterOpenRoom(nk, roomCode)
  return JSON.stringify({ matchId: matches[0].matchId })
}

export const rpcTriadLeaderboard: nkruntime.RpcFunction = function (ctx, _logger, nk) {
  const LB = 'triad_rank'
  const list = nk.leaderboardRecordsList(LB, [], 50)
  const top =
    list.records?.map((r, i) => ({
      rank: i + 1,
      username: r.username,
      wins: r.score,
      winStreak: r.subscore,
      metadata: r.metadata,
    })) ?? []

  let you: { rank: number; wins: number; winStreak: number; metadata: unknown } | null = null
  if (ctx.userId) {
    const mine = nk.leaderboardRecordsList(LB, [ctx.userId], 1)
    const rec = mine.ownerRecords?.[0]
    if (rec) {
      you = {
        rank: rec.rank,
        wins: rec.score,
        winStreak: rec.subscore,
        metadata: rec.metadata,
      }
    }
  }

  return JSON.stringify({ top, you })
}
