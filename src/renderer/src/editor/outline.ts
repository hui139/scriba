export interface OutlineItem {
  level: number
  text: string
  line: number
}

export function extractOutline(text: string): OutlineItem[] {
  const lines = text.split('\n')
  const items: OutlineItem[] = []
  let inFence = false
  let fenceChar = ''
  let fenceLength = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fence = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fence) {
      const char = fence[1][0]
      if (!inFence) {
        inFence = true
        fenceChar = char
        fenceLength = fence[1].length
      } else if (char === fenceChar && fence[1].length >= fenceLength) {
        inFence = false
      }
      continue
    }
    if (inFence) continue

    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (match) {
      items.push({ level: match[1].length, text: match[2], line: i + 1 })
    }
  }

  return items
}
