import { tauri } from './tauri'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

function sendToBackend(level: LogLevel, ...args: unknown[]) {
  const message = args.map((a) => {
    if (a instanceof Error) return `${a.message}\n${a.stack}`
    if (typeof a === 'object') {
      try { return JSON.stringify(a) } catch { return String(a) }
    }
    return String(a)
  }).join(' ')

  tauri.frontendLog(level, message).catch(() => {})
}

function consoleToBackend(level: LogLevel) {
  return (...args: unknown[]) => sendToBackend(level, ...args)
}

export const logger = {
  info: consoleToBackend('info'),
  warn: consoleToBackend('warn'),
  error: consoleToBackend('error'),
  debug: consoleToBackend('debug'),
}

/** Wrap an async function so errors are logged to the backend */
export function withLog<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  label: string,
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args)
    } catch (e: any) {
      logger.error(`${label}: ${e?.message || e}`)
      throw e
    }
  }) as T
}
