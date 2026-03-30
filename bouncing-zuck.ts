import { layoutNextLine, prepareWithSegments, type LayoutCursor, type PreparedTextWithSegments } from '@chenglou/pretext'
import zuckCompositeUrl from './assets/zuck-composite.png'

// --- Fonts & line heights ---
const TITLE_FONT = '600 24px "Inter Display", Inter, sans-serif'
const TITLE_LINE_HEIGHT = 30

const BODY_FONT = '400 14px "Inter", sans-serif'
const BODY_LINE_HEIGHT = 24

const QUOTE_FONT = '14px "Lora", Georgia, "Times New Roman", serif'
const QUOTE_LINE_HEIGHT = 19

// --- Content ---
const TITLE_TEXT = 'The Privacy Engineering Gap'
const BODY_TEXT = 'Engineering teams are instructed to innovate and release new products at a fast clip. On the other hand, privacy teams must rigorously evaluate every aspect of each upcoming product and feature to ensure compliance with privacy policies. This can lead to a disconnect between the teams, delay new product releases, and create privacy debt.'

const QUOTE_1_FULL = `We do not have an adequate level of control and explainability over how our systems use data, and thus we can't confidently make controlled policy changes or external commitments. Yet, this is exactly what regulators expect us to do, increasing our risk of mistakes and misrepresentation. Leaked internal document at Meta`
const QUOTE_2_FULL = `Twitter doesn't understand how much data it collects, why it collects it, and how it's supposed to be used. Peiter "Mudge" Zatko – Former Head of Security at Twitter`

const ZUCK_W = Math.round(95 * 0.7)  // 67
const ZUCK_H = Math.round(142 * 0.7) // 99
const ZUCK_SPEED = 1.8

type PositionedLine = { x: number; y: number; text: string }
type Rect = { x: number; y: number; width: number; height: number }
type Interval = { left: number; right: number }

// --- Bounce state ---
const bounce = { x: 300, y: 100, vx: ZUCK_SPEED, vy: ZUCK_SPEED * 0.75, w: ZUCK_W, h: ZUCK_H }

// --- DOM ---
const stage = document.getElementById('stage') as HTMLDivElement
const page = document.querySelector('.page') as HTMLElement
const bgTop = document.getElementById('bg-top') as HTMLDivElement
const bgBottom = document.getElementById('bg-bottom') as HTMLDivElement
const dividerLine = document.getElementById('divider-line') as HTMLImageElement

function resolveAssetUrl(url: string): string {
  if (/^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url
  if (url.startsWith('/')) return new URL(url, window.location.origin).href
  return new URL(url, import.meta.url).href
}

// --- Zuck portrait ---
const zuckContainer = document.createElement('div')
zuckContainer.className = 'zuck-container'
zuckContainer.style.width = `${ZUCK_W}px`
zuckContainer.style.height = `${ZUCK_H}px`

const zuckImg = document.createElement('img')
zuckImg.className = 'zuck-img'
zuckImg.src = resolveAssetUrl(zuckCompositeUrl)
zuckImg.alt = 'Mark Zuckerberg'
zuckImg.draggable = false
zuckContainer.appendChild(zuckImg)
page.appendChild(zuckContainer)

// --- Drag ---
let isDragging = false
let dragOffsetX = 0
let dragOffsetY = 0

zuckContainer.addEventListener('mousedown', (e) => {
  isDragging = true
  zuckContainer.classList.add('dragging')
  dragOffsetX = e.offsetX
  dragOffsetY = e.offsetY
  e.preventDefault()
})

zuckContainer.addEventListener('touchstart', (e) => {
  isDragging = true
  zuckContainer.classList.add('dragging')
  const touch = e.touches[0]!
  const rect = zuckContainer.getBoundingClientRect()
  dragOffsetX = touch.clientX - rect.left
  dragOffsetY = touch.clientY - rect.top
  e.preventDefault()
}, { passive: false })

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return
  const pageRect = page.getBoundingClientRect()
  bounce.x = Math.max(0, Math.min(e.clientX - pageRect.left - dragOffsetX, page.clientWidth - bounce.w))
  bounce.y = Math.max(0, Math.min(e.clientY - pageRect.top - dragOffsetY, page.clientHeight - bounce.h))
})

window.addEventListener('touchmove', (e) => {
  if (!isDragging) return
  const touch = e.touches[0]!
  const pageRect = page.getBoundingClientRect()
  bounce.x = Math.max(0, Math.min(touch.clientX - pageRect.left - dragOffsetX, page.clientWidth - bounce.w))
  bounce.y = Math.max(0, Math.min(touch.clientY - pageRect.top - dragOffsetY, page.clientHeight - bounce.h))
}, { passive: true })

window.addEventListener('mouseup', () => {
  if (!isDragging) return
  isDragging = false
  zuckContainer.classList.remove('dragging')
  bounce.vx = ZUCK_SPEED * (Math.random() > 0.5 ? 1 : -1)
  bounce.vy = ZUCK_SPEED * 0.75 * (Math.random() > 0.5 ? 1 : -1)
})

window.addEventListener('touchend', () => {
  if (!isDragging) return
  isDragging = false
  zuckContainer.classList.remove('dragging')
  bounce.vx = ZUCK_SPEED * (Math.random() > 0.5 ? 1 : -1)
  bounce.vy = ZUCK_SPEED * 0.75 * (Math.random() > 0.5 ? 1 : -1)
})

// --- Pretext helpers ---
const preparedByKey = new Map<string, PreparedTextWithSegments>()

function getPrepared(text: string, font: string): PreparedTextWithSegments {
  const key = `${font}::${text}`
  const cached = preparedByKey.get(key)
  if (cached !== undefined) return cached
  const p = prepareWithSegments(text, font)
  preparedByKey.set(key, p)
  return p
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

function getBlockedInterval(obs: Rect, bandTop: number, bandBottom: number, hPad: number, vPad: number): Interval | null {
  if (bandBottom <= obs.y - vPad || bandTop >= obs.y + obs.height + vPad) return null
  return { left: obs.x - hPad, right: obs.x + obs.width + hPad }
}

function layoutColumn(
  prepared: PreparedTextWithSegments,
  startCursor: LayoutCursor,
  region: Rect,
  lineHeight: number,
  obstacles: Rect[],
  hPad: number,
  vPad: number,
): { lines: PositionedLine[]; cursor: LayoutCursor; bottom: number } {
  let cursor: LayoutCursor = startCursor
  let lineTop = region.y
  const lines: PositionedLine[] = []

  while (lineTop + lineHeight <= region.y + region.height) {
    const blocked: Interval[] = []
    for (const obs of obstacles) {
      const iv = getBlockedInterval(obs, lineTop, lineTop + lineHeight, hPad, vPad)
      if (iv !== null) blocked.push(iv)
    }
    const slots = carveSlots({ left: region.x, right: region.x + region.width }, blocked)
    if (slots.length === 0) { lineTop += lineHeight; continue }

    // Use leftmost slot (editorial/magazine float behaviour).
    // Fall back to widest if leftmost is too narrow to fit a word.
    const MIN_SLOT = 80
    let slot = slots[0]!
    if (slot.right - slot.left < MIN_SLOT) {
      for (let i = 1; i < slots.length; i++) {
        if (slots[i]!.right - slots[i]!.left >= MIN_SLOT) { slot = slots[i]!; break }
      }
    }
    const width = slot.right - slot.left
    if (width < 40) { lineTop += lineHeight; continue }

    const line = layoutNextLine(prepared, cursor, width)
    if (line === null) break

    lines.push({ x: Math.round(slot.left), y: Math.round(lineTop), text: line.text })
    cursor = line.end
    lineTop += lineHeight
  }
  const bottom = lines.length > 0 ? lines[lines.length - 1]!.y + lineHeight : region.y
  return { lines, cursor, bottom }
}

// --- DOM pools ---
let titleLineEls: HTMLSpanElement[] = []
let bodyLineEls: HTMLSpanElement[] = []
let quote1LineEls: HTMLSpanElement[] = []
let quote2LineEls: HTMLSpanElement[] = []
let quoteMarkEls: HTMLSpanElement[] = []

function syncPool(pool: HTMLSpanElement[], length: number): HTMLSpanElement[] {
  while (pool.length < length) {
    const el = document.createElement('span')
    el.className = 'line'
    stage.appendChild(el)
    pool.push(el)
  }
  while (pool.length > length) pool.pop()!.remove()
  return pool
}

function applyLines(pool: HTMLSpanElement[], lines: PositionedLine[], font: string, lineHeight: number, color: string) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!
    const el = pool[i]!
    el.textContent = l.text
    el.style.left = `${l.x}px`
    el.style.top = `${l.y}px`
    el.style.font = font
    el.style.lineHeight = `${lineHeight}px`
    el.style.color = color
  }
}

// --- Wait for fonts ---
await document.fonts.ready
const preparedTitle = getPrepared(TITLE_TEXT, TITLE_FONT)
const preparedBody = getPrepared(BODY_TEXT, BODY_FONT)
const preparedQ1 = getPrepared(QUOTE_1_FULL, QUOTE_FONT)
const preparedQ2 = getPrepared(QUOTE_2_FULL, QUOTE_FONT)

// --- Bounce ---
function updateBounce(pageWidth: number, pageHeight: number): void {
  if (isDragging) return
  bounce.x += bounce.vx
  bounce.y += bounce.vy
  if (bounce.x <= 0) { bounce.x = 0; bounce.vx = Math.abs(bounce.vx) }
  if (bounce.y <= 0) { bounce.y = 0; bounce.vy = Math.abs(bounce.vy) }
  if (bounce.x + bounce.w >= pageWidth) { bounce.x = pageWidth - bounce.w; bounce.vx = -Math.abs(bounce.vx) }
  if (bounce.y + bounce.h >= pageHeight) { bounce.y = pageHeight - bounce.h; bounce.vy = -Math.abs(bounce.vy) }
}

// --- Render ---
function render(): void {
  const pageWidth = page.clientWidth
  const pageHeight = page.clientHeight
  const stageHeight = stage.clientHeight

  updateBounce(pageWidth, pageHeight)

  zuckContainer.style.left = `${Math.round(bounce.x)}px`
  zuckContainer.style.top = `${Math.round(bounce.y)}px`
  zuckContainer.style.transform = 'rotate(-1.19deg)'

  // Zuck rect in stage coordinates
  const pageRect = page.getBoundingClientRect()
  const stageRect = stage.getBoundingClientRect()
  const stageOffsetTop = stageRect.top - pageRect.top
  const zuckInStage: Rect = { x: bounce.x, y: bounce.y - stageOffsetTop, width: bounce.w, height: bounce.h }
  const obstacles = [zuckInStage]

  const gutter = 75
  const textWidth = Math.min(380, pageWidth - gutter * 2)
  const hPad = 4
  const vPad = 2

  // --- Title ---
  const titleRegion: Rect = { x: gutter, y: 40, width: textWidth, height: TITLE_LINE_HEIGHT * 3 }
  const titleResult = layoutColumn(preparedTitle, { segmentIndex: 0, graphemeIndex: 0 }, titleRegion, TITLE_LINE_HEIGHT, obstacles, hPad, vPad)
  titleLineEls = syncPool(titleLineEls, titleResult.lines.length)
  applyLines(titleLineEls, titleResult.lines, TITLE_FONT, TITLE_LINE_HEIGHT, 'var(--ink)')

  // --- Body paragraph ---
  const bodyTop = titleResult.bottom + 10
  const bodyRegion: Rect = { x: gutter, y: bodyTop, width: textWidth, height: BODY_LINE_HEIGHT * 10 }
  const bodyResult = layoutColumn(preparedBody, { segmentIndex: 0, graphemeIndex: 0 }, bodyRegion, BODY_LINE_HEIGHT, obstacles, hPad, vPad)
  bodyLineEls = syncPool(bodyLineEls, bodyResult.lines.length)
  applyLines(bodyLineEls, bodyResult.lines, BODY_FONT, BODY_LINE_HEIGHT, 'var(--ink-muted)')

  // --- Divider position ---
  const dividerY = bodyResult.bottom + 20
  bgTop.style.height = `${dividerY}px`
  bgBottom.style.height = `${stageHeight - dividerY - 8}px`
  dividerLine.style.top = `${dividerY}px`

  // --- Quotes ---
  const quoteTextWidth = Math.min(356, pageWidth - gutter * 2)
  const qHPad = 4
  const qVPad = 2

  const qm1Y = dividerY + 28
  const q1Top = qm1Y + 26
  const q1Region: Rect = { x: gutter, y: q1Top, width: quoteTextWidth, height: stageHeight * 0.45 }
  const q1Result = layoutColumn(preparedQ1, { segmentIndex: 0, graphemeIndex: 0 }, q1Region, QUOTE_LINE_HEIGHT, obstacles, qHPad, qVPad)
  quote1LineEls = syncPool(quote1LineEls, q1Result.lines.length)
  applyLines(quote1LineEls, q1Result.lines, QUOTE_FONT, QUOTE_LINE_HEIGHT, 'var(--ink)')

  const qm2Y = q1Result.bottom + 24
  const q2Top = qm2Y + 26
  const q2Height = Math.max(0, stageHeight - q2Top - 16)
  const q2Region: Rect = { x: gutter, y: q2Top, width: quoteTextWidth, height: q2Height }
  const q2Result = layoutColumn(preparedQ2, { segmentIndex: 0, graphemeIndex: 0 }, q2Region, QUOTE_LINE_HEIGHT, obstacles, qHPad, qVPad)
  quote2LineEls = syncPool(quote2LineEls, q2Result.lines.length)
  applyLines(quote2LineEls, q2Result.lines, QUOTE_FONT, QUOTE_LINE_HEIGHT, 'var(--ink)')

  // --- Quote marks ---
  const qms = [{ x: gutter, y: qm1Y }, { x: gutter, y: qm2Y }]
  while (quoteMarkEls.length < qms.length) {
    const el = document.createElement('span')
    el.className = 'quote-mark'
    stage.appendChild(el)
    quoteMarkEls.push(el)
  }
  while (quoteMarkEls.length > qms.length) quoteMarkEls.pop()!.remove()
  for (let i = 0; i < qms.length; i++) {
    const el = quoteMarkEls[i]!
    el.textContent = '\u201C'
    el.style.left = `${qms[i]!.x}px`
    el.style.top = `${qms[i]!.y}px`
    el.style.fontSize = '32px'
  }

  requestAnimationFrame(render)
}

requestAnimationFrame(render)
