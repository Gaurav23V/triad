import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Match, Session, Socket } from '@heroiclabs/nakama-js'
import { createNakamaClient, deviceId } from './nakamaClient'
import {
  OpCode,
  decodeJson,
  encodeJson,
  type GameStatePayload,
} from './protocol'
import './App.css'

type Screen = 'login' | 'menu' | 'matching' | 'game' | 'leaderboard'

interface OpenRoom {
  roomCode: string
  roomName: string
  mode: string
  matchId: string
}

interface LbRow {
  rank: number
  username: string
  wins: number
  winStreak: number
  metadata?: { losses?: number; draws?: number }
}

function getErrorMessage(e: unknown): string {
  console.error('[Triad Error]', e)
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null) {
    const errObj = e as Record<string, unknown>
    if (errObj.message) return String(errObj.message)
    if (errObj.error) return String(errObj.error)
    return JSON.stringify(e)
  }
  return String(e)
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('login')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const matchRef = useRef<Match | null>(null)
  const mmTicketRef = useRef<string | null>(null)

  const [game, setGame] = useState<GameStatePayload | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [roomName, setRoomName] = useState('')
  const [modeChoice, setModeChoice] = useState<'classic' | 'timed'>('classic')
  const [rooms, setRooms] = useState<OpenRoom[]>([])
  const [lbTop, setLbTop] = useState<LbRow[]>([])
  const [lbYou, setLbYou] = useState<LbRow | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())

  const client = useMemo(() => createNakamaClient(), [])

  const disconnect = useCallback(async () => {
    const s = socketRef.current
    const m = matchRef.current
    socketRef.current = null
    matchRef.current = null
    setGame(null)
    if (s) {
      try {
        if (m) await s.leaveMatch(m.match_id)
      } catch {
        /* ignore */
      }
      try {
        s.disconnect(false)
      } catch {
        /* ignore */
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }, [])

  useEffect(() => {
    return () => {
      void disconnect()
    }
  }, [disconnect])

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const ensureSocket = useCallback(
    async (sess: Session) => {
      if (socketRef.current) return socketRef.current
      const socket = client.createSocket(client.useSSL, false)
      socket.onmatchdata = (md) => {
        if (md.match_id !== matchRef.current?.match_id) return
        if (md.op_code === OpCode.STATE) {
          setGame(decodeJson<GameStatePayload>(md.data))
        } else if (md.op_code === OpCode.ERROR) {
          const p = decodeJson<{ message?: string }>(md.data)
          setErr(p.message ?? 'Error')
        }
      }
      socket.onmatchmakermatched = async (mm) => {
        console.log('[Matchmaker] Received matchmakermatched event:', mm)
        try {
          mmTicketRef.current = null
          console.log('[Matchmaker] Joining match:', mm.match_id)
          const m = await socket.joinMatch(mm.match_id)
          console.log('[Matchmaker] Joined match:', m)
          matchRef.current = m
          setScreen('game')
          setBusy(false)
        } catch (e) {
          console.error('[Matchmaker] Error joining match:', e)
          setErr(getErrorMessage(e))
          setBusy(false)
          setScreen('menu')
        }
      }
      await socket.connect(sess, true)
      socketRef.current = socket
      return socket
    },
    [client],
  )

  const login = async () => {
    setErr(null)
    const name = username.trim()
    if (name.length < 2) {
      setErr('Choose a name (2+ characters).')
      return
    }
    setBusy(true)
    try {
      const sess = await client.authenticateDevice(deviceId(), true, name)
      setSession(sess)
      await ensureSocket(sess)
      setScreen('menu')
    } catch (e) {
      setErr(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const loadRooms = async () => {
    if (!session) return
    setErr(null)
    setBusy(true)
    try {
      const res = await client.rpc(session, 'triad_list_open_rooms', {})
      const payload = res.payload as { rooms?: OpenRoom[] }
      setRooms(payload.rooms ?? [])
    } catch (e) {
      setErr(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const loadLeaderboard = async () => {
    if (!session) return
    setErr(null)
    setBusy(true)
    try {
      const res = await client.rpc(session, 'triad_leaderboard', {})
      const p = res.payload as { top?: LbRow[]; you?: LbRow | null }
      setLbTop(p.top ?? [])
      setLbYou(p.you ?? null)
      setScreen('leaderboard')
    } catch (e) {
      setErr(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const joinMatchId = async (matchId: string) => {
    if (!session) return
    setErr(null)
    setBusy(true)
    try {
      const socket = await ensureSocket(session)
      const m = await socket.joinMatch(matchId)
      matchRef.current = m
      setScreen('game')
    } catch (e) {
      setErr(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const createRoom = async () => {
    if (!session) return
    setErr(null)
    setBusy(true)
    try {
      const res = await client.rpc(session, 'triad_create_room', {
        roomName: roomName.trim() || 'Game',
        mode: modeChoice,
      })
      const p = res.payload as { matchId?: string }
      if (!p.matchId) throw new Error('No match id')
      await joinMatchId(p.matchId)
    } catch (e) {
      setErr(getErrorMessage(e))
      setBusy(false)
    }
  }

  const joinByCode = async () => {
    if (!session) return
    const code = joinCode.trim().toUpperCase()
    if (!code) {
      setErr('Enter a room code.')
      return
    }
    setErr(null)
    setBusy(true)
    try {
      const res = await client.rpc(session, 'triad_join_by_code', { roomCode: code })
      const p = res.payload as { matchId?: string }
      if (!p.matchId) throw new Error('Room not found')
      await joinMatchId(p.matchId)
    } catch (e) {
      setErr(getErrorMessage(e))
      setBusy(false)
    }
  }

  const quickMatch = async () => {
    if (!session) return
    setErr(null)
    setBusy(true)
    setScreen('matching')
    try {
      console.log('[QuickMatch] Starting, mode:', modeChoice)
      const socket = await ensureSocket(session)
      console.log('[QuickMatch] Socket ready')
      const query = '+properties.game:triad +properties.mode:' + modeChoice
      const props = { game: 'triad', mode: modeChoice }
      console.log('[QuickMatch] Calling addMatchmaker with query:', query, 'props:', props)
      const ticket = await socket.addMatchmaker(query, 2, 2, props)
      console.log('[QuickMatch] Ticket received:', ticket)
      mmTicketRef.current = ticket.ticket
    } catch (e) {
      console.error('[QuickMatch] Error:', e)
      setErr(getErrorMessage(e))
      setBusy(false)
      setScreen('menu')
    }
  }

  const sendMove = async (cell: number) => {
    const socket = socketRef.current
    const m = matchRef.current
    if (!socket || !m) return
    setErr(null)
    try {
      await socket.sendMatchState(m.match_id, OpCode.MOVE, encodeJson({ cell }))
    } catch (e) {
      setErr(getErrorMessage(e))
    }
  }

  const claimForfeit = async () => {
    const socket = socketRef.current
    const m = matchRef.current
    if (!socket || !m) return
    try {
      await socket.sendMatchState(m.match_id, OpCode.CLAIM_FORFEIT, new Uint8Array())
    } catch (e) {
      setErr(getErrorMessage(e))
    }
  }

  const leaveGame = async () => {
    await disconnect()
    if (session) await ensureSocket(session)
    setScreen('menu')
  }

  const logout = async () => {
    await disconnect()
    setSession(null)
    setScreen('login')
  }

  const myUserId = session?.user_id ?? ''
  const myMark =
    game?.players.X?.userId === myUserId
      ? 'X'
      : game?.players.O?.userId === myUserId
        ? 'O'
        : null

  const statusText = useMemo(() => {
    if (!game) return 'Connecting…'
    if (game.status === 'waiting_opponent') return 'Waiting for opponent'
    if (game.status === 'completed') {
      if (game.winner === 'draw') return 'Draw'
      if (game.winner === myMark) return 'You win!'
      if (game.winner) return 'You lost'
      return 'Game over'
    }
    if (game.currentTurn === myMark) return 'Your turn'
    return "Opponent's turn"
  }, [game, myMark])

  const secondsLeft =
    game?.mode === 'timed' && game.turnDeadlineSec
      ? Math.max(0, game.turnDeadlineSec - Math.floor(nowTick / 1000))
      : null

  if (screen === 'login') {
    return (
      <div>
        <h1>Triad</h1>
        <p className="sub">Multiplayer tic-tac-toe · server authoritative</p>
        <div className="panel">
          <label htmlFor="name">Display name</label>
          <input
            id="name"
            type="text"
            autoComplete="nickname"
            placeholder="Your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={24}
          />
          <div className="btn-row" style={{ marginTop: '0.85rem' }}>
            <button className="btn-primary" type="button" disabled={busy} onClick={() => void login()}>
              {busy && <span className="spinner" aria-hidden />}
              Play
            </button>
          </div>
          {err && <p className="err">{err}</p>}
        </div>
      </div>
    )
  }

  if (screen === 'leaderboard') {
    return (
      <div>
        <h1>Leaderboard</h1>
        <p className="sub">Wins · losses · draws (stored on Nakama)</p>
        <div className="panel">
          {lbTop.length === 0 ? (
            <p className="sub">No entries yet. Finish a game first.</p>
          ) : (
            <table className="lb-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>W</th>
                  <th>L</th>
                  <th>D</th>
                  <th>Streak</th>
                </tr>
              </thead>
              <tbody>
                {lbTop.map((r) => (
                  <tr key={r.rank + r.username} className={r.username === username ? 'you-row' : ''}>
                    <td>{r.rank}</td>
                    <td>{r.username || '—'}</td>
                    <td>{r.wins}</td>
                    <td>{r.metadata?.losses ?? '—'}</td>
                    <td>{r.metadata?.draws ?? '—'}</td>
                    <td>{r.winStreak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {lbYou && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
              Your rank: <strong>{lbYou.rank}</strong> · {lbYou.wins}W
            </p>
          )}
        </div>
        <div className="btn-row">
          <button className="btn-secondary" type="button" onClick={() => setScreen('menu')}>
            Back
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'matching') {
    return (
      <div>
        <h1>Finding opponent</h1>
        <p className="sub">Matchmaking · mode: {modeChoice}</p>
        <div className="panel" style={{ textAlign: 'center' }}>
          <span className="spinner" style={{ width: '2rem', height: '2rem' }} aria-hidden />
          <p style={{ marginTop: '1rem' }}>Pairing with another player…</p>
        </div>
        <button
          className="btn-secondary"
          type="button"
          onClick={() => {
            const t = mmTicketRef.current
            if (t) void socketRef.current?.removeMatchmaker(t)
            mmTicketRef.current = null
            setBusy(false)
            setScreen('menu')
          }}
        >
          Cancel
        </button>
      </div>
    )
  }

  if (screen === 'game' && game) {
    return (
      <div>
        <h1>Triad</h1>
        <div className="status-pill">{statusText}</div>
        {game.roomCode && (
          <p className="sub">
            Room: <strong>{game.roomCode}</strong> · {game.roomName}
          </p>
        )}
        {game.mode === 'timed' && game.status === 'in_progress' && secondsLeft !== null && (
          <p className="sub">Turn timer: {secondsLeft}s</p>
        )}
        <div className="panel">
          <div className="players">
            <div>
              <span>X </span>
              <strong className="x">{game.players.X?.username ?? '—'}</strong>
            </div>
            <div>
              <span>O </span>
              <strong className="o">{game.players.O?.username ?? '—'}</strong>
            </div>
          </div>
          <div className="board" role="grid" aria-label="Tic tac toe board">
            {game.board.map((cell, i) => {
              const win = game.winLine?.includes(i)
              const clickable =
                game.status === 'in_progress' &&
                game.currentTurn === myMark &&
                cell === '' &&
                myMark !== null
              return (
                <button
                  key={i}
                  type="button"
                  className={`cell ${cell === 'X' ? 'x' : ''} ${cell === 'O' ? 'o' : ''} ${win ? 'win' : ''} ${clickable ? 'clickable' : ''}`}
                  disabled={!clickable}
                  onClick={() => void sendMove(i)}
                  aria-label={`Cell ${i + 1} ${cell || 'empty'}`}
                >
                  {cell}
                </button>
              )
            })}
          </div>
          {game.canClaimForfeit && (
            <button className="btn-danger" type="button" onClick={() => void claimForfeit()}>
              Claim victory (opponent disconnected)
            </button>
          )}
          {game.forfeitGraceEndsSec && game.disconnectedOpponentId && (
            <p className="sub" style={{ marginTop: '0.5rem' }}>
              Auto-forfeit in ~{Math.max(0, game.forfeitGraceEndsSec - Math.floor(nowTick / 1000))}s if they
              do not return.
            </p>
          )}
          {err && <p className="err">{err}</p>}
        </div>
        <div className="btn-row">
          <button className="btn-secondary" type="button" onClick={() => void leaveGame()}>
            Leave match
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'game' && !game) {
    return (
      <div>
        <p className="sub">Loading game state…</p>
        <button className="btn-secondary" type="button" onClick={() => void leaveGame()}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1>Triad</h1>
      <p className="sub">Signed in as {username}</p>
      <div className="panel">
        <label>Game mode</label>
        <div className="btn-row" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={modeChoice === 'classic' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setModeChoice('classic')}
          >
            Classic
          </button>
          <button
            type="button"
            className={modeChoice === 'timed' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setModeChoice('timed')}
          >
            Speed (30s)
          </button>
        </div>
      </div>
      <div className="panel btn-row">
        <button className="btn-primary" type="button" disabled={busy} onClick={() => void quickMatch()}>
          Quick match
        </button>
        <button className="btn-secondary" type="button" disabled={busy} onClick={() => void loadLeaderboard()}>
          Leaderboard
        </button>
      </div>
      <div className="panel">
        <label htmlFor="rn">Room name (optional)</label>
        <input
          id="rn"
          type="text"
          placeholder="My lobby"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          maxLength={40}
        />
        <div className="btn-row" style={{ marginTop: '0.65rem' }}>
          <button className="btn-primary" type="button" disabled={busy} onClick={() => void createRoom()}>
            Create room
          </button>
        </div>
      </div>
      <div className="panel">
        <label htmlFor="code">Join with code</label>
        <input
          id="code"
          type="text"
          placeholder="ABC123"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          maxLength={8}
        />
        <div className="btn-row" style={{ marginTop: '0.65rem' }}>
          <button className="btn-secondary" type="button" disabled={busy} onClick={() => void joinByCode()}>
            Join
          </button>
        </div>
      </div>
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Open rooms</strong>
          <button className="btn-secondary" type="button" disabled={busy} onClick={() => void loadRooms()}>
            Refresh
          </button>
        </div>
        {rooms.length === 0 ? (
          <p className="sub" style={{ marginTop: '0.5rem' }}>
            No public lobbies. Create one or use Quick match.
          </p>
        ) : (
          <ul className="room-list">
            {rooms.map((r) => (
              <li key={r.matchId}>
                <span>
                  {r.roomName} · {r.roomCode} ({r.mode})
                </span>
                <button className="btn-secondary" type="button" onClick={() => void joinMatchId(r.matchId)}>
                  Join
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {err && <p className="err">{err}</p>}
      <button className="btn-secondary" type="button" onClick={() => void logout()}>
        Sign out
      </button>
    </div>
  )
}
