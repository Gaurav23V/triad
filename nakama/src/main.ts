import {
  moduleName,
  matchInit,
  matchJoinAttempt,
  matchJoin,
  matchLeave,
  matchLoop,
  matchTerminate,
  matchSignal,
} from './match_handler.js'
import {
  rpcTriadCreateRoom,
  rpcTriadListOpenRooms,
  rpcTriadJoinByCode,
  rpcTriadLeaderboard,
} from './rpc.js'

function matchmakerMatched(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  matches: nkruntime.MatchmakerResult[],
): string {
  if (matches.length < 2) return ''

  const mode =
    matches[0].properties?.mode === 'timed' || matches[1].properties?.mode === 'timed'
      ? 'timed'
      : 'classic'

  const roomName = 'Quick match'
  const roomCode = `Q${Math.random().toString(36).slice(2, 7).toUpperCase()}`

  try {
    return nk.matchCreate(moduleName, { roomName, roomCode, mode })
  } catch (e) {
    logger.error('matchmakerMatched create failed: %v', e)
    return ''
  }
}

function InitModule(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer,
): void {
  initializer.registerMatch(moduleName, {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLeave,
    matchLoop,
    matchTerminate,
    matchSignal,
  })

  initializer.registerRpc('triad_create_room', rpcTriadCreateRoom)
  initializer.registerRpc('triad_list_open_rooms', rpcTriadListOpenRooms)
  initializer.registerRpc('triad_join_by_code', rpcTriadJoinByCode)
  initializer.registerRpc('triad_leaderboard', rpcTriadLeaderboard)
  initializer.registerMatchmakerMatched(matchmakerMatched)

  logger.info('Triad Nakama module loaded (v%s)', process.env.TRIAD_VERSION || 'dev')
}

const g = globalThis as unknown as { InitModule?: typeof InitModule }
g.InitModule = InitModule
