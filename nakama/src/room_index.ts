const COLLECTION = 'triad_lobby'
const KEY = 'room_index'
const SYSTEM_USER = '00000000-0000-0000-0000-000000000000'

export interface RoomIndex {
  codes: string[]
}

export function readRoomIndex(nk: nkruntime.Nakama): RoomIndex {
  const res = nk.storageRead([{ collection: COLLECTION, key: KEY, userId: SYSTEM_USER }])
  if (!res.length || !res[0].value) return { codes: [] }
  const v = res[0].value as { codes?: string[] }
  return { codes: Array.isArray(v.codes) ? v.codes : [] }
}

export function writeRoomIndex(nk: nkruntime.Nakama, codes: string[]): void {
  nk.storageWrite([
    {
      collection: COLLECTION,
      key: KEY,
      userId: SYSTEM_USER,
      value: { codes },
      permissionRead: 2,
      permissionWrite: 0,
    },
  ])
}

export function registerOpenRoom(nk: nkruntime.Nakama, code: string): void {
  const idx = readRoomIndex(nk)
  if (!idx.codes.includes(code)) {
    idx.codes.push(code)
    writeRoomIndex(nk, idx.codes)
  }
}

export function unregisterOpenRoom(nk: nkruntime.Nakama, code: string): void {
  const idx = readRoomIndex(nk)
  const next = idx.codes.filter((c) => c !== code)
  if (next.length !== idx.codes.length) writeRoomIndex(nk, next)
}
