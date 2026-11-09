/**
 * Version helpers for plugin compatibility checks.
 *
 * Kept free of Electron imports so the rules can be unit tested and reused by the
 * renderer without pulling in the main process.
 */

/**
 * Compares two dotted version strings.
 * Returns a negative number when `a < b`, zero when equal, positive when `a > b`.
 *
 * Only the numeric leading part of each segment is compared, so `1.2.0-beta.1`
 * sorts as `1.2.0`, which is what a `minAppVersion` check wants.
 */
export function compareVersions(a: string, b: string): number {
  // Drop any prerelease/build suffix before splitting, so `1.2.0-beta.1` compares
  // as `1.2.0` instead of gaining an extra `1` segment from the suffix.
  const parse = (value: string): number[] =>
    value
      .split('-')[0]
      .split('+')[0]
      .split('.')
      .map((part) => Number.parseInt(part, 10))
      .map((n) => (Number.isFinite(n) ? n : 0))

  const left = parse(a)
  const right = parse(b)
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i++) {
    const l = left[i] ?? 0
    const r = right[i] ?? 0
    if (l !== r) return l - r
  }
  return 0
}

/**
 * True when `appVersion` satisfies `minVersion`.
 * A missing or empty requirement is always compatible.
 */
export function satisfiesMinVersion(appVersion: string, minVersion?: string): boolean {
  if (!minVersion) return true
  return compareVersions(appVersion, minVersion) >= 0
}

/** Shape needed for a compatibility check; avoids importing the full manifest type. */
export interface VersionedManifest {
  minAppVersion?: string
}

/** True when the running app satisfies the plugin's `minAppVersion`. */
export function isCompatible(manifest: VersionedManifest, appVersion: string): boolean {
  return satisfiesMinVersion(appVersion, manifest.minAppVersion)
}
