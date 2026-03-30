import { layoutNextLine, prepareWithSegments, walkLineRanges, type LayoutCursor, type PreparedTextWithSegments } from '@chenglou/pretext'
import zuckOutlineUrl from './assets/zuck-outline.svg'
import zuckFaceUrl from './assets/zuck-face-overlay.png'
import zuckEyeUrl from './assets/zuck-eye.png'

// --- Design tokens from Figma ---
const QUOTE_FONT = '14px "Lora", Georgia, "Times New Roman", serif'
const QUOTE_LINE_HEIGHT = 19
const ATTRIBUTION_FONT = '700 14px "DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif'
const ATTRIBUTION_LINE_HEIGHT = 20
const HEADLINE_FONT_FAMILY = '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif'
const HEADLINE_TEXT = 'The Privacy Engineering Gap'

const QUOTE_1 = `We do not have an adequate level of control and explainability over how our systems use data, and thus we can't confidently make controlled policy changes or external commitments. Yet, this is exactly what regulators expect us to do, increasing our risk of mistakes and misrepresentation.`
const ATTR_1 = 'Leaked internal document at Meta'

const QUOTE_2 = `Twitter doesn't understand how much data it collects, why it collects it, and how it's supposed to be used.`
const ATTR_2 = `Peiter "Mudge" Zatko – Former Head of Security at Twitter`

const BODY_TEXT = QUOTE_1 + ' ' + ATTR_1 + ' ' + QUOTE_2 + ' ' + ATTR_2

const ZUCK_W = 120
const ZUCK_H = 160
const ZUCK_SPEED = 1.8

type PositionedLine = { x: number; y: number; width: number; text: string }
type Rect = { x: number; y: number; width: number; height: number }
type Interval = { left: number; right: number }

// --- Bounce state ---
const bounce = {
  x: 300,
  y: 100,
  vx: ZUCK_SPEED,
  vy: ZUCK_SPEED * 0.75,
  w: ZUCK_W,
  h: ZUCK_H,
}

// --- DOM setup ---
const stage = document.getElementById('stage') as HTMLDivElement

function resolveAssetUrl(url: string): string {
  if (/^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url
  if (url.startsWith('/')) return new URL(url, window.location.origin).href
  return new URL(url, import.meta.url).href
}

// Build composite portrait element
const zuckContainer = document.createElement('div')
zuckContainer.className = 'zuck-container'
zuckContainer.style.width = `${ZUCK_W}px`
zuckContainer.style.height = `${ZUCK_H}px`

const outlineDiv = document.createElement('div')
outlineDiv.className = 'zuck-outline'
const outlineImg = document.createElement('img')
outlineImg.src = resolveAssetUrl(zuckOutlineUrl)
outlineImg.alt = ''
outlineImg.draggable = false
outlineDiv.appendChild(outlineImg)

const faceDiv = document.createElement('div')
faceDiv.className = 'zuck-face'
const faceImg = document.createElement('img')
faceImg.src = resolveAssetUrl(zuckFaceUrl)
faceImg.alt = 'Mark Zuckerberg'
faceImg.draggable = false
faceDiv.appendChild(faceImg)

const eyeDiv = document.createElement('div')
eyeDiv.className = 'zuck-eye'
const eyeImg = document.createElement('img')
eyeImg.src = resolveAssetUrl(zuckEyeUrl)
eyeImg.alt = ''
eyeImg.draggable = false
eyeDiv.appendChild(eyeImg)

zuckContainer.append(outlineDiv, faceDiv, eyeDiv)

// Headline
const headlineEl = document.createElement('h1')
headlineEl.className = 'headline'

stage.append(headlineEl, zuckContainer)

// --- Pretext caches ---
const preparedByKey = new Map<string, PreparedTextWithSegments>()

function getPrepared(text: string, font: string): PreparedTextWithSegments {
  const key = `${font}::${text}`
  const cached = preparedByKey.get(key)
  if (cached !== undefined) return cached
  const prepared = prepareWithSegments(text, font)
  preparedByKey.set(key, prepared)
  return prepared
}

function headlineBreaksInsideWord(prepared: PreparedTextWithSegments, maxWidth: number): boolean {
  let breaks = false
  walkLineRanges(prepared, maxWidth, line => {
    if (line.end.graphemeIndex !== 0) breaks = true
  })
  return breaks
}

function fitHeadlineFontSize(headlineWidth: number, pageWidth: number): number {
  let low = Math.ceil(Math.max(18, pageWidth * 0.02))
  let high = Math.floor(Math.min(48, Math.max(24, pageWidth * 0.04)))
  let best = low
  while (low <= high) {
    const size = Math.floor((low + high) / 2)
    const font = `500 ${size}px ${HEADLINE_FONT_FAMILY}`
    const p = getPrepared(HEADLINE_TEXT, font)
    if (!headlineBreaksInsideWord(p, headlineWidth)) {
      best = size
      low = size + 1
    } else {
      high = size - 1
    }
  }
  return best
}

// --- Obstacle carving ---
function carveSlots(region: Interval, blocked: Interval[]): Interval[] {
  const sorted = blocked.filter(b => b.left < b.right).sort((a, b) => a.left - b.left)
  const slots: Interval[] = []
  let cursor = region.left
  for (const b of sorted) {
    if (b.left > cursor) slots.push({ left: cursor, right: Math.min(b.left, region.right) })
    cursor = Math.max(cursor, b.right)
  }
  if (cursor < region.right) slots.push({ left: cursor, right: region.right })
  return slots
}

function getRectIntervalForBand(rect: Rect, bandTop: number, bandBottom: number, hPad: number, vPad: number): Interval | null {
  if (bandBottom <= rect.y - vPad || bandTop >= rect.y + rect.height + vPad) return null
  return { left: rect.x - hPad, right: rect.x + rect.width + hPad }
}

function layoutColumn(
  prepared: PreparedTextWithSegments,
  startCursor: LayoutCursor,
  region: Rect,
  lineHeight: number,
  obstacles: Rect[],
  hPad: number,
  vPad: number,
): { lines: PositionedLine[]; cursor: LayoutCursor } {
  let cursor: LayoutCursor = startCursor
  let lineTop = region.y
  const lines: PositionedLine[] = []

  while (lineTop + lineHeight <= region.y + region.height) {
    const bandTop = lineTop
    const bandBottom = lineTop + lineHeight
    const blocked: Interval[] = []
    for (const obs of obstacles) {
      const interval = getRectIntervalForBand(obs, bandTop, bandBottom, hPad, vPad)
      if (interval !== null) blocked.push(interval)
    }

    const slots = carveSlots({ left: region.x, right: region.x + region.width }, blocked)
    if (slots.length === 0) { lineTop += lineHeight; continue }

    let slot = slots[0]!
    for (let i = 1; i < slots.length; i++) {
      if (slots[i]!.right - slots[i]!.left > slot.right - slot.left) slot = slots[i]!
    }

    const width = slot.right - slot.left
    if (width < 40) { lineTop += lineHeight; continue }

    const line = layoutNextLine(prepared, cursor, width)
    if (line === null) break

    lines.push({
      x: Math.round(slot.left),
      y: Math.round(lineTop),
      width: line.width,
      text: line.text,
    })
    cursor = line.end
    lineTop += lineHeight
  }
  return { lines, cursor }
}

// --- DOM pools ---
let headlineLineEls: HTMLSpanElement[] = []
let bodyLineEls: HTMLSpanElement[] = []
let quoteMarkEls: HTMLSpanElement[] = []

function syncPool(pool: HTMLSpanElement[], length: number, className: string): HTMLSpanElement[] {
  while (pool.length < length) {
    const el = document.createElement('span')
    el.className = className
    stage.appendChild(el)
    pool.push(el)
  }
  while (pool.length > length) pool.pop()!.remove()
  return pool
}

// --- Wait for fonts ---
await document.fonts.ready
const preparedBody = getPrepared(BODY_TEXT, QUOTE_FONT)

// --- Update bounce ---
function updateBounce(pageWidth: number, pageHeight: number): void {
  bounce.x += bounce.vx
  bounce.y += bounce.vy

  if (bounce.x <= 0) { bounce.x = 0; bounce.vx = Math.abs(bounce.vx) }
  if (bounce.y <= 0) { bounce.y = 0; bounce.vy = Math.abs(bounce.vy) }
  if (bounce.x + bounce.w >= pageWidth) { bounce.x = pageWidth - bounce.w; bounce.vx = -Math.abs(bounce.vx) }
  if (bounce.y + bounce.h >= pageHeight) { bounce.y = pageHeight - bounce.h; bounce.vy = -Math.abs(bounce.vy) }
}

// --- Render ---
function render(): void {
  const root = document.documentElement
  const pageWidth = root.clientWidth
  const pageHeight = root.clientHeight

  updateBounce(pageWidth, pageHeight)

  // Position Zuck
  zuckContainer.style.left = `${Math.round(bounce.x)}px`
  zuckContainer.style.top = `${Math.round(bounce.y)}px`
  zuckContainer.style.transform = 'rotate(-1.19deg)'

  const zuckRect: Rect = { x: bounce.x, y: bounce.y, width: bounce.w, height: bounce.h }

  const gutter = Math.round(Math.max(40, pageWidth * 0.06))
  const isNarrow = pageWidth < 700

  // Headline
  const headlineTop = Math.round(Math.max(28, pageWidth * 0.03, 56))
  const headlineWidth = isNarrow ? pageWidth - gutter * 2 : Math.min(380, pageWidth - gutter * 2)
  const headlineFontSize = fitHeadlineFontSize(headlineWidth, pageWidth)
  const headlineLineHeight = Math.round(headlineFontSize * 1.25)
  const headlineFont = `500 ${headlineFontSize}px ${HEADLINE_FONT_FAMILY}`

  const headlinePrepared = getPrepared(HEADLINE_TEXT, headlineFont)
  const headlineRegion: Rect = { x: gutter, y: headlineTop, width: headlineWidth, height: headlineLineHeight * 2 }
  const headlineResult = layoutColumn(headlinePrepared, { segmentIndex: 0, graphemeIndex: 0 }, headlineRegion, headlineLineHeight, [zuckRect], Math.round(QUOTE_LINE_HEIGHT * 0.8), Math.round(QUOTE_LINE_HEIGHT * 0.3))

  headlineEl.style.left = '0px'
  headlineEl.style.top = '0px'
  headlineEl.style.width = `${pageWidth}px`
  headlineEl.style.height = `${pageHeight}px`

  headlineLineEls = syncPool(headlineLineEls, headlineResult.lines.length, 'headline-line')
  for (let i = 0; i < headlineResult.lines.length; i++) {
    const line = headlineResult.lines[i]!
    const el = headlineLineEls[i]!
    el.textContent = line.text
    el.style.left = `${line.x}px`
    el.style.top = `${line.y}px`
    el.style.font = headlineFont
    el.style.lineHeight = `${headlineLineHeight}px`
    headlineEl.appendChild(el)
  }

  const headlineBottom = headlineResult.lines.length === 0
    ? headlineTop
    : Math.max(...headlineResult.lines.map(l => l.y + headlineLineHeight))

  // Quote mark 1
  const quoteTop1 = headlineBottom + Math.round(gutter * 0.6)
  // Body text
  const bodyTop = quoteTop1 + 30
  const bodyWidth = isNarrow ? pageWidth - gutter * 2 : Math.min(356, pageWidth - gutter * 2)

  const hPad = Math.round(QUOTE_LINE_HEIGHT * 1.0)
  const vPad = Math.round(QUOTE_LINE_HEIGHT * 0.4)

  const bodyRegion: Rect = {
    x: gutter,
    y: bodyTop,
    width: bodyWidth,
    height: Math.max(0, pageHeight - bodyTop - gutter),
  }
  const bodyResult = layoutColumn(preparedBody, { segmentIndex: 0, graphemeIndex: 0 }, bodyRegion, QUOTE_LINE_HEIGHT, [zuckRect], hPad, vPad)

  bodyLineEls = syncPool(bodyLineEls, bodyResult.lines.length, 'line')
  for (let i = 0; i < bodyResult.lines.length; i++) {
    const line = bodyResult.lines[i]!
    const el = bodyLineEls[i]!
    el.textContent = line.text
    el.style.left = `${line.x}px`
    el.style.top = `${line.y}px`
    el.style.font = QUOTE_FONT
    el.style.lineHeight = `${QUOTE_LINE_HEIGHT}px`
    el.style.color = 'var(--ink)'
  }

  // Quote marks
  const quoteMarks = [
    { x: gutter, y: quoteTop1 },
  ]
  quoteMarkEls = syncPool(quoteMarkEls, quoteMarks.length, 'quote-mark')
  for (let i = 0; i < quoteMarks.length; i++) {
    const qm = quoteMarks[i]!
    const el = quoteMarkEls[i]!
    el.textContent = '\u201C'
    el.style.left = `${qm.x}px`
    el.style.top = `${qm.y}px`
    el.style.fontSize = '32px'
  }

  requestAnimationFrame(render)
}

requestAnimationFrame(render)
