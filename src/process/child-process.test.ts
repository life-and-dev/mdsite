import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mkdirMock, openMock, spawnMock, connectMock } = vi.hoisted(() => ({
  mkdirMock: vi.fn(),
  openMock: vi.fn(),
  spawnMock: vi.fn(),
  connectMock: vi.fn()
}))

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  open: openMock
}))

vi.mock('node:child_process', () => ({
  spawn: spawnMock
}))

vi.mock('node:net', () => ({
  default: {
    connect: connectMock
  }
}))

import { openUrlInBrowser, runBackground, waitForTcpPort } from './child-process.js'

describe('child-process helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mkdirMock.mockResolvedValue(undefined)
    openMock.mockResolvedValue({
      fd: 17,
      close: vi.fn().mockResolvedValue(undefined),
      appendFile: vi.fn().mockResolvedValue(undefined)
    })
    spawnMock.mockReturnValue({
      pid: 1234,
      once: vi.fn(),
      unref: vi.fn()
    })
  })

  it('creates the parent log directory before opening a background process log file', async () => {
    await expect(runBackground('npm', ['run', 'preview'], '/renderer', { TEST: '1' }, '/content/mdsite.log')).resolves.toBe(1234)

    expect(mkdirMock).toHaveBeenCalledWith('/content', { recursive: true })
    expect(openMock).toHaveBeenCalledWith('/content/mdsite.log', 'a')
    expect(mkdirMock.mock.invocationCallOrder[0]).toBeLessThan(openMock.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY)
  })

  it('uses the same parent-directory log setup for start background processes', async () => {
    await expect(runBackground('npm', ['run', 'dev'], '/renderer', { TEST: '1' }, '/content/.mdsite-runtime/start.log')).resolves.toBe(1234)

    expect(mkdirMock).toHaveBeenCalledWith('/content/.mdsite-runtime', { recursive: true })
    expect(openMock).toHaveBeenCalledWith('/content/.mdsite-runtime/start.log', 'a')
  })

  it('opens preview URLs in the default browser on supported platforms', async () => {
    const onceMock = vi.fn((event: string, handler: () => void) => {
      if (event === 'spawn') {
        handler()
      }
      return browserChild
    })
    const browserChild = {
      once: onceMock,
      unref: vi.fn()
    }
    spawnMock.mockReturnValueOnce(browserChild)

    await expect(openUrlInBrowser('http://localhost:3000')).resolves.toBe(true)
    expect(spawnMock).toHaveBeenCalledWith('xdg-open', ['http://localhost:3000'], {
      detached: true,
      stdio: 'ignore'
    })
    expect(browserChild.unref).toHaveBeenCalled()
  })

  it('returns false when browser opening is unsupported or unavailable', async () => {
    const onceMock = vi.fn((event: string, handler: () => void) => {
      if (event === 'error') {
        handler()
      }
      return browserChild
    })
    const browserChild = {
      once: onceMock,
      unref: vi.fn()
    }
    spawnMock.mockReturnValueOnce(browserChild)

    await expect(openUrlInBrowser('http://localhost:3000')).resolves.toBe(false)
  })

  it('waitForTcpPort retries until the port accepts connections', async () => {
    vi.useFakeTimers()
    let attempts = 0
    connectMock.mockImplementation(() => {
      const handlers = new Map<string, () => void>()
      const socket = {
        once: vi.fn((event: string, handler: () => void) => {
          handlers.set(event, handler)
          return socket
        }),
        setTimeout: vi.fn(),
        removeAllListeners: vi.fn(),
        destroy: vi.fn()
      }

      queueMicrotask(() => {
        attempts += 1
        const event = attempts < 3 ? 'error' : 'connect'
        handlers.get(event)?.()
      })

      return socket
    })

    const waitPromise = waitForTcpPort('localhost', 3000, { retryIntervalMs: 25, timeoutMs: 100 })
    await vi.advanceTimersByTimeAsync(50)

    await expect(waitPromise).resolves.toBe(true)
    expect(connectMock).toHaveBeenCalledTimes(3)
    expect(connectMock).toHaveBeenNthCalledWith(1, { host: 'localhost', port: 3000 })
  })

  it('waitForTcpPort returns false after the bounded timeout', async () => {
    vi.useFakeTimers()
    connectMock.mockImplementation(() => {
      const handlers = new Map<string, () => void>()
      const socket = {
        once: vi.fn((event: string, handler: () => void) => {
          handlers.set(event, handler)
          return socket
        }),
        setTimeout: vi.fn(),
        removeAllListeners: vi.fn(),
        destroy: vi.fn()
      }

      queueMicrotask(() => {
        handlers.get('timeout')?.()
      })

      return socket
    })

    const waitPromise = waitForTcpPort('127.0.0.1', 4173, { retryIntervalMs: 25, timeoutMs: 70, connectTimeoutMs: 10 })
    await vi.advanceTimersByTimeAsync(100)

    await expect(waitPromise).resolves.toBe(false)
    expect(connectMock).toHaveBeenCalledTimes(3)
  })
})
