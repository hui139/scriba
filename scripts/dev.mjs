#!/usr/bin/env node
/**
 * Dev launcher for Scriba.
 *
 * Electron's bundled Chromium prints this harmless notice a few times while the
 * browser process initialises, before any of our code runs:
 *
 *   libpng warning: iCCP: known incorrect sRGB profile
 *
 * It does not come from Scriba's icons (build/icon.png, build/icon.ico) nor from
 * any file in the Electron distribution; it is emitted from data embedded in the
 * Electron binary itself, so it cannot be fixed from application code. To keep the
 * dev console readable we drop exactly that line and forward every other byte of
 * stderr untouched.
 *
 * Set SCRIBA_SHOW_ELECTRON_WARNINGS=1 to see the raw output.
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

const NOISE = /^libpng warning: iCCP: known incorrect sRGB profile\s*$/
const showNoise = process.env.SCRIBA_SHOW_ELECTRON_WARNINGS === '1'

const command = process.argv[2] ?? 'dev'
const cliPath = join(dirname(require.resolve('electron-vite')), '..', 'bin', 'electron-vite.js')

const child = spawn(process.execPath, [cliPath, command, ...process.argv.slice(3)], {
  stdio: ['inherit', 'inherit', 'pipe'],
  env: process.env
})

let pending = ''

child.stderr.setEncoding('utf8')
child.stderr.on('data', (chunk) => {
  pending += chunk
  const lines = pending.split('\n')
  pending = lines.pop() ?? ''
  for (const line of lines) {
    if (!showNoise && NOISE.test(line)) continue
    process.stderr.write(`${line}\n`)
  }
})

child.on('close', (code, signal) => {
  if (pending) {
    if (showNoise || !NOISE.test(pending)) process.stderr.write(pending)
    pending = ''
  }
  process.exitCode = code ?? (signal ? 1 : 0)
})

/** Kill the whole process tree so no Electron window is left behind. */
function terminate() {
  if (child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } else {
    child.kill('SIGTERM')
  }
}

process.on('SIGINT', () => {
  terminate()
  process.exitCode = 130
})
process.on('SIGTERM', () => {
  terminate()
  process.exitCode = 143
})
process.on('exit', terminate)
