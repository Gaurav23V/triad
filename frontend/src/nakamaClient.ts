import { Client } from '@heroiclabs/nakama-js'

const host = import.meta.env.VITE_NAKAMA_HOST ?? '127.0.0.1'
const port = import.meta.env.VITE_NAKAMA_PORT ?? '7350'
const serverKey = import.meta.env.VITE_NAKAMA_SERVER_KEY ?? 'defaultkey'
const useSSL = import.meta.env.VITE_NAKAMA_USE_SSL === 'true'

export function createNakamaClient(): Client {
  return new Client(serverKey, host, port, useSSL)
}

export function deviceId(): string {
  const k = 'triad_device_id'
  let id = localStorage.getItem(k)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(k, id)
  }
  return id
}
