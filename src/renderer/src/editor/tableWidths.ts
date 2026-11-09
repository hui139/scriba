/**
 * Persisted column widths for rendered tables.
 *
 * GFM tables have no syntax for column widths, so they are kept out
 * of the Markdown source. They are stored as application metadata keyed by the
 * document path plus the table's position, so the source file stays clean and the
 * widths survive reloads.
 *
 * Widths are stored as fractions of the table width rather than pixels, so a table
 * keeps its proportions when the window or font size changes.
 */

const STORAGE_PREFIX = 'scriba-table-widths:'

/** Key for one table: document path (or a placeholder for unsaved docs) + index. */
function tableKey(docPath: string | null, tableIndex: number): string {
  return `${STORAGE_PREFIX}${docPath ?? '<untitled>'}#${tableIndex}`
}

/** Column widths as fractions in (0, 1], or null when none were set. */
export type ColumnWidths = number[]

function isFractionArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'number' && item > 0 && item <= 1)
  )
}

export function loadColumnWidths(docPath: string | null, tableIndex: number): ColumnWidths | null {
  try {
    const raw = localStorage.getItem(tableKey(docPath, tableIndex))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return isFractionArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveColumnWidths(
  docPath: string | null,
  tableIndex: number,
  widths: ColumnWidths
): void {
  try {
    if (!isFractionArray(widths)) return
    localStorage.setItem(tableKey(docPath, tableIndex), JSON.stringify(widths))
  } catch {
    // Widths are cosmetic; a storage failure must not break rendering.
  }
}

export function clearColumnWidths(docPath: string | null, tableIndex: number): void {
  try {
    localStorage.removeItem(tableKey(docPath, tableIndex))
  } catch {
    // Ignore.
  }
}

/**
 * Normalizes widths so they sum to 1, keeping every column at least `min`.
 *
 * A drag can push a column to zero or make the row overflow; rebalancing here keeps
 * the stored value valid no matter what the pointer did.
 */
export function normalizeWidths(widths: number[], min = 0.04): ColumnWidths {
  if (widths.length === 0) return []
  const count = widths.length
  // A minimum above 1/count cannot be satisfied for every column at once.
  const floor = Math.min(min, 1 / count)
  const clamped = widths.map((width) => Math.max(floor, width))

  const total = clamped.reduce((sum, width) => sum + width, 0)
  if (total <= 0) return clamped.map(() => 1 / count)

  let result = clamped.map((width) => width / total)

  // Normalizing can push a column below the floor (dividing by a total > 1). Lift
  // those back up and take the difference from the columns above the floor, so the
  // invariant holds after rounding.
  for (let pass = 0; pass < 4; pass++) {
    const below = result.map((width, index) => ({ width, index })).filter((entry) => entry.width < floor)
    if (below.length === 0) break

    let deficit = 0
    for (const entry of below) {
      deficit += floor - entry.width
      result[entry.index] = floor
    }

    const above = result
      .map((width, index) => ({ width, index }))
      .filter((entry) => entry.width > floor)
    const surplus = above.reduce((sum, entry) => sum + (entry.width - floor), 0)
    if (surplus <= 0) break

    for (const entry of above) {
      const share = ((entry.width - floor) / surplus) * deficit
      result[entry.index] = Math.max(floor, entry.width - share)
    }
  }

  // Re-normalize the residual so the fractions still sum to exactly 1. The floor is
  // re-applied afterwards because dividing can drop a value back under it.
  const finalTotal = result.reduce((sum, width) => sum + width, 0)
  if (finalTotal > 0 && Math.abs(finalTotal - 1) > 1e-9) {
    result = result.map((width) => Math.max(floor, width / finalTotal))
  }

  return result
}

/**
 * Applies a drag delta to one column, taking the space from its right neighbour.
 *
 * Only the dragged column and the one to its right change, which is what makes a
 * resize feel local instead of shifting the whole table.
 */
export function resizeColumn(
  widths: number[],
  index: number,
  deltaFraction: number,
  min = 0.04
): ColumnWidths {
  if (index < 0 || index >= widths.length) return widths
  const next = [...widths]

  if (index === next.length - 1) {
    // The last column has no right neighbour; grow it and shrink the widest other.
    const target = Math.max(min, next[index] + deltaFraction)
    const delta = target - next[index]
    let donor = -1
    for (let i = 0; i < next.length - 1; i++) {
      if (donor === -1 || next[i] > next[donor]) donor = i
    }
    if (donor === -1) return widths
    const donorNext = next[donor] - delta
    if (donorNext < min) {
      const available = next[donor] - min
      next[index] = next[index] + available
      next[donor] = min
    } else {
      next[index] = target
      next[donor] = donorNext
    }
    return normalizeWidths(next, min)
  }

  const neighbour = index + 1
  const proposed = next[index] + deltaFraction
  const neighbourProposed = next[neighbour] - deltaFraction

  // Both columns must keep their minimum; clamp the drag rather than overflowing.
  if (proposed < min) {
    const actual = min - next[index]
    next[index] = min
    next[neighbour] = next[neighbour] - actual
  } else if (neighbourProposed < min) {
    const actual = next[neighbour] - min
    next[index] = next[index] + actual
    next[neighbour] = min
  } else {
    next[index] = proposed
    next[neighbour] = neighbourProposed
  }

  return normalizeWidths(next, min)
}
