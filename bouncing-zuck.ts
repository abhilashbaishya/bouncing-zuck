import { layoutNextLine, prepareWithSegments, type LayoutCursor, type PreparedTextWithSegments } from '@chenglou/pretext'
import zuckCompositeUrl from './assets/zuck-composite.png'
import zodiacFontUrl from './assets/Zodiak-Regular.woff2'
import diatypeMedUrl from './assets/ABCDiatype-Medium-Trial.woff2'
import diatypeRegUrl from './assets/ABCDiatype-Regular-Trial.woff'
import quoteMarkUrl from './assets/quote-mark.svg'

// --- Figma specs ---
// Page: 595px, gutter: 32px, content: 531px
// Title: 56px ABCDiatype Medium, lh 0.96, tracking -1.68px, 2 lines, left: 32, top center: 86px
// Body: 16px ABCDiatype Regular, lh 24px, #606776, left: 32, top: 160px
// Divider: top ~312px
// Pink section: top ~320px, h 380px
// Quotes: Zodiak 16px lh 24px, gap 32px, vertically centered

const _compact = window.innerWidth < 480

const GUTTER = 32
const TITLE_SIZE = _compact ? 36 : 56
const TITLE_FONT = `500 ${TITLE_SIZE}px "ABCDiatype", sans-serif`
const TITLE_LINE_HEIGHT = Math.round(TITLE_SIZE * 0.96)
const TITLE_TRACKING = `${_compact ? -1.12 : -1.68}px`

const BODY_FONT = `400 ${_compact ? 15 : 16}px "ABCDiatype", sans-serif`
const BODY_LINE_HEIGHT = _compact ? 22 : 24

const QUOTE_FONT = `400 16px "Zodiak", Georgia, serif`
const QUOTE_LINE_HEIGHT = 24

const ATTR_FONT = `500 14px "ABCDiatype", sans-serif`
const ATTR_LINE_HEIGHT = 20

// --- Content (exact Figma text) ---
// Title split into exact 2 lines (pretext can't account for CSS letter-spacing)
const TITLE_LINE_1 = 'The gap between '
const TITLE_LINE_2 = 'Privacy & Engineering'

const BODY_TEXT = `Engineering teams are instructed to  innovate and release new products at a fast clip. On the other hand, privacy teams must rigorously evaluate every aspect of each upcoming product and feature to ensure compliance with privacy policies. This can lead to a disconnect between the teams and delay new product releases or worse, create privacy debt.`

const QUOTE_1_TEXT = `We do not have an adequate level of control and explainability over how our systems use data, and thus we can't confidently make controlled policy changes or external commitments  And yet, this is exactly what regulators expect us to do, increasing our risk of mistakes and misrepresentation.`
const QUOTE_1_ATTR = `Leaked internal document at Meta`

const QUOTE_2_TEXT = `Twitter doesn't understand how much data it collects, why it collects it, and how it's supposed to be used`
const QUOTE_2_ATTR = `Peiter \u201cMudge\u201d Zatko \u2013 Former Head of Security`

const ZUCK_W = _compact ? 64 : 80
const ZUCK_H = _compact ? 95 : 119
const ZUCK_SPEED = 1.8

type PositionedLine = { x: number; y: number; text: string }
type Rect = { x: number; y: number; width: number; height: number }
type Interval = { left: number; right: number }

const bounce = { x: 200, y: 160, vx: ZUCK_SPEED, vy: ZUCK_SPEED * 0.75, w: ZUCK_W, h: ZUCK_H }

// --- DOM ---
const stage = document.getElementById('stage') as HTMLDivElement
const page = document.querySelector('.page') as HTMLElement
const bgTop = document.getElementById('bg-top') as HTMLDivElement
const bgBottom = document.getElementById('bg-bottom') as HTMLDivElement
const dividerLine = document.getElementById('divider-line') as HTMLDivElement
const svgNS = 'http://www.w3.org/2000/svg'
const dividerSvg = document.createElementNS(svgNS, 'svg')
dividerSvg.setAttribute('width', '592')
dividerSvg.setAttribute('height', '8')
dividerSvg.setAttribute('viewBox', '0 0 592 8')
dividerSvg.style.cssText = 'display:block;'
for (let i = 0; i < 37; i++) {
  const x = i * 16
  const p = document.createElementNS(svgNS, 'path')
  p.setAttribute('d', `M${x + 16} 8H${x}L${x + 7.91579} 0L${x + 16} 8Z`)
  p.setAttribute('fill', '#F9F0F6')
  dividerSvg.appendChild(p)
}
dividerLine.appendChild(dividerSvg)

function resolveAssetUrl(url: string): string {
  if (/^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url
  if (url.startsWith('/')) return new URL(url, window.location.origin).href
  return new URL(url, import.meta.url).href
}

// --- Zuck ---
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
  isDragging = true; zuckContainer.classList.add('dragging')
  dragOffsetX = e.offsetX; dragOffsetY = e.offsetY; e.preventDefault()
})
zuckContainer.addEventListener('touchstart', (e) => {
  isDragging = true; zuckContainer.classList.add('dragging')
  const t = e.touches[0]!; const r = zuckContainer.getBoundingClientRect()
  dragOffsetX = t.clientX - r.left; dragOffsetY = t.clientY - r.top; e.preventDefault()
}, { passive: false })
window.addEventListener('mousemove', (e) => {
  if (!isDragging) return
  const pr = page.getBoundingClientRect()
  bounce.x = Math.max(0, Math.min(e.clientX - pr.left - dragOffsetX, page.clientWidth - bounce.w))
  bounce.y = Math.max(0, Math.min(e.clientY - pr.top - dragOffsetY, stage.clientHeight - bounce.h))
})
window.addEventListener('touchmove', (e) => {
  if (!isDragging) return
  const t = e.touches[0]!; const pr = page.getBoundingClientRect()
  bounce.x = Math.max(0, Math.min(t.clientX - pr.left - dragOffsetX, page.clientWidth - bounce.w))
  bounce.y = Math.max(0, Math.min(t.clientY - pr.top - dragOffsetY, stage.clientHeight - bounce.h))
}, { passive: true })
window.addEventListener('mouseup', () => {
  if (!isDragging) return; isDragging = false; zuckContainer.classList.remove('dragging')
  bounce.vx = ZUCK_SPEED * (Math.random() > 0.5 ? 1 : -1)
  bounce.vy = ZUCK_SPEED * 0.75 * (Math.random() > 0.5 ? 1 : -1)
})
window.addEventListener('touchend', () => {
  if (!isDragging) return; isDragging = false; zuckContainer.classList.remove('dragging')
  bounce.vx = ZUCK_SPEED * (Math.random() > 0.5 ? 1 : -1)
  bounce.vy = ZUCK_SPEED * 0.75 * (Math.random() > 0.5 ? 1 : -1)
})

// --- Pretext ---
const preparedByKey = new Map<string, PreparedTextWithSegments>()
function getPrepared(text: string, font: string): PreparedTextWithSegments {
  const key = `${font}::${text}`
  const cached = preparedByKey.get(key)
  if (cached) return cached
  const p = prepareWithSegments(text, font)
  preparedByKey.set(key, p)
  return p
}

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
    let placedAny = false
    for (const slot of slots) {
      const width = slot.right - slot.left
      if (width < 40) continue
      const line = layoutNextLine(prepared, cursor, width)
      if (line === null) continue
      lines.push({ x: Math.round(slot.left), y: Math.round(lineTop), text: line.text })
      cursor = line.end
      placedAny = true
    }
    if (!placedAny) break
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
let attrEls: HTMLSpanElement[] = []

function syncPool(pool: HTMLSpanElement[], length: number): HTMLSpanElement[] {
  while (pool.length < length) {
    const el = document.createElement('span'); el.className = 'line'
    stage.appendChild(el); pool.push(el)
  }
  while (pool.length > length) pool.pop()!.remove()
  return pool
}

function applyLines(pool: HTMLSpanElement[], lines: PositionedLine[], font: string, lineHeight: number, color: string) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!; const el = pool[i]!
    el.textContent = l.text
    el.style.left = `${l.x}px`; el.style.top = `${l.y}px`
    el.style.font = font; el.style.lineHeight = `${lineHeight}px`; el.style.color = color
    el.style.right = ''; el.style.width = ''; el.style.textAlign = ''; el.style.letterSpacing = ''
  }
}

function syncAttrPool(n: number): HTMLSpanElement[] {
  while (attrEls.length < n) {
    const el = document.createElement('span'); el.className = 'line'
    stage.appendChild(el); attrEls.push(el)
  }
  while (attrEls.length > n) attrEls.pop()!.remove()
  return attrEls
}

// --- Load fonts ---
const zodiak = new FontFace('Zodiak', `url(${zodiacFontUrl}) format("woff2")`, { weight: '400', style: 'normal' })
const diatypeMed = new FontFace('ABCDiatype', `url(${diatypeMedUrl}) format("woff2")`, { weight: '500', style: 'normal' })
const diatypeReg = new FontFace('ABCDiatype', `url(${diatypeRegUrl}) format("woff")`, { weight: '400', style: 'normal' })
document.fonts.add(zodiak); document.fonts.add(diatypeMed); document.fonts.add(diatypeReg)
await Promise.allSettled([
  zodiak.load(), diatypeMed.load(), diatypeReg.load(), document.fonts.ready,
  document.fonts.load(TITLE_FONT), document.fonts.load(BODY_FONT),
  document.fonts.load(QUOTE_FONT), document.fonts.load(ATTR_FONT),
])
const preparedBody = getPrepared(BODY_TEXT, BODY_FONT)
const preparedQ1 = getPrepared(QUOTE_1_TEXT, QUOTE_FONT)
const preparedQ2 = getPrepared(QUOTE_2_TEXT, QUOTE_FONT)

// --- Bounce ---
function updateBounce(pageWidth: number, stageHeight: number): void {
  if (isDragging) return
  bounce.x += bounce.vx; bounce.y += bounce.vy
  if (bounce.x <= 0) { bounce.x = 0; bounce.vx = ZUCK_SPEED }
  if (bounce.y <= 0) { bounce.y = 0; bounce.vy = ZUCK_SPEED * 0.75 }
  if (bounce.x + bounce.w >= pageWidth) { bounce.x = pageWidth - bounce.w; bounce.vx = -ZUCK_SPEED }
  if (bounce.y + bounce.h >= stageHeight) { bounce.y = stageHeight - bounce.h; bounce.vy = -ZUCK_SPEED * 0.75 }
}

// --- Render ---
function render(): void {
  const pageWidth = page.clientWidth
  const stageHeight = stage.clientHeight

  updateBounce(pageWidth, stageHeight)
  zuckContainer.style.left = `${Math.round(bounce.x)}px`
  zuckContainer.style.top = `${Math.round(bounce.y)}px`
  zuckContainer.style.transform = 'rotate(-1.19deg)'

  const pageRect = page.getBoundingClientRect()
  const stageRect = stage.getBoundingClientRect()
  const stageOffsetTop = stageRect.top - pageRect.top
  const zuckInStage: Rect = { x: bounce.x, y: bounce.y - stageOffsetTop, width: bounce.w, height: bounce.h }
  const obstacles = [zuckInStage]

  const gutter = GUTTER
  const textWidth = pageWidth - gutter * 2
  const hPad = 6
  const vPad = 4

  // --- Title: always pinned to gutter, Zuck floats over it via z-index ---
  const titleTopY = Math.max(16, Math.round(86 - TITLE_LINE_HEIGHT))
  // On mobile "Privacy & Engineering" is too wide for one line — split into 3
  const titleTextLines = _compact
    ? ['The gap between', 'Privacy &', 'Engineering']
    : [TITLE_LINE_1, TITLE_LINE_2]
  const titleLines: PositionedLine[] = titleTextLines.map((text, i) => ({
    x: gutter, y: titleTopY + TITLE_LINE_HEIGHT * i, text,
  }))
  const titleBottom = titleTopY + TITLE_LINE_HEIGHT * titleTextLines.length
  titleLineEls = syncPool(titleLineEls, titleTextLines.length)
  applyLines(titleLineEls, titleLines, TITLE_FONT, TITLE_LINE_HEIGHT, '#1b1d22')
  for (const el of titleLineEls) {
    el.style.letterSpacing = TITLE_TRACKING
    el.style.fontFeatureSettings = "'liga' 0"
  }

  // --- Body: Figma top=160px, flows around Zuck ---
  const bodyTop = Math.max(titleBottom + 12, _compact ? 140 : 160)
  const bodyRegion: Rect = { x: gutter, y: bodyTop, width: textWidth, height: BODY_LINE_HEIGHT * 20 }
  const bodyResult = layoutColumn(preparedBody, { segmentIndex: 0, graphemeIndex: 0 }, bodyRegion, BODY_LINE_HEIGHT, obstacles, hPad, vPad)
  bodyLineEls = syncPool(bodyLineEls, bodyResult.lines.length)
  applyLines(bodyLineEls, bodyResult.lines, BODY_FONT, BODY_LINE_HEIGHT, '#606776')
  for (const el of bodyLineEls) el.style.fontFeatureSettings = "'salt' 1"

  // --- Divider: Figma ~312px ---
  const dividerY = Math.max(bodyResult.bottom + 16, _compact ? 280 : 312)
  bgTop.style.height = `${dividerY}px`
  bgBottom.style.height = `${stageHeight - dividerY - 8}px`
  dividerLine.style.top = `${dividerY}px`

  // --- Quotes: vertically centered in pink section ---
  const pinkTop = dividerY + 8
  const pinkHeight = stageHeight - pinkTop
  const qmH = 16 + 14  // quote mark + gap to text

  if (_compact) {
    // On mobile: show only Quote 1 (Meta leak), centered vertically
    const q1LinesEst = 6
    const q1HEst = qmH + q1LinesEst * QUOTE_LINE_HEIGHT + 8 + ATTR_LINE_HEIGHT * 2
    const quoteBlockStart = pinkTop + Math.max(24, Math.round((pinkHeight - q1HEst) / 2))

    const qm1Y = quoteBlockStart
    const q1Top = qm1Y + 16 + 14
    const q1Region: Rect = { x: gutter, y: q1Top, width: textWidth, height: QUOTE_LINE_HEIGHT * 10 }
    const q1Result = layoutColumn(preparedQ1, { segmentIndex: 0, graphemeIndex: 0 }, q1Region, QUOTE_LINE_HEIGHT, obstacles, hPad, vPad)
    quote1LineEls = syncPool(quote1LineEls, q1Result.lines.length)
    applyLines(quote1LineEls, q1Result.lines, QUOTE_FONT, QUOTE_LINE_HEIGHT, '#363a45')
    quote2LineEls = syncPool(quote2LineEls, 0)

    const attr1Y = q1Result.bottom + 8
    syncAttrPool(1)
    const el = attrEls[0]!
    el.textContent = QUOTE_1_ATTR; el.style.left = `${gutter}px`; el.style.top = `${attr1Y}px`
    el.style.font = ATTR_FONT; el.style.lineHeight = `${ATTR_LINE_HEIGHT}px`
    el.style.color = '#1b1d22'; el.style.letterSpacing = '-0.14px'
    el.style.width = `${textWidth}px`; el.style.whiteSpace = 'normal'
    el.style.right = ''; el.style.textAlign = ''

    const qms = [{ x: gutter, y: qm1Y }]
    while (quoteMarkEls.length < 1) {
      const qel = document.createElement('span'); qel.className = 'quote-mark'
      const qimg = document.createElement('img'); qimg.src = resolveAssetUrl(quoteMarkUrl); qimg.alt = '"'
      qel.appendChild(qimg); stage.appendChild(qel); quoteMarkEls.push(qel)
    }
    while (quoteMarkEls.length > 1) quoteMarkEls.pop()!.remove()
    const qel = quoteMarkEls[0]!
    qel.style.left = `${qms[0]!.x}px`; qel.style.top = `${qms[0]!.y}px`
  } else {
    // Desktop: show both quotes
    const q1LinesEst = 5; const q2LinesEst = 3
    const q1H = qmH + q1LinesEst * QUOTE_LINE_HEIGHT + 8 + ATTR_LINE_HEIGHT
    const q2H = qmH + q2LinesEst * QUOTE_LINE_HEIGHT + 6 + ATTR_LINE_HEIGHT
    const totalQuoteH = q1H + 32 + q2H
    const quoteBlockStart = pinkTop + Math.max(24, Math.round((pinkHeight - totalQuoteH) / 2))

    const qm1Y = quoteBlockStart
    const q1Top = qm1Y + 16 + 14
    const q1Region: Rect = { x: gutter, y: q1Top, width: textWidth, height: QUOTE_LINE_HEIGHT * 8 }
    const q1Result = layoutColumn(preparedQ1, { segmentIndex: 0, graphemeIndex: 0 }, q1Region, QUOTE_LINE_HEIGHT, obstacles, hPad, vPad)
    quote1LineEls = syncPool(quote1LineEls, q1Result.lines.length)
    applyLines(quote1LineEls, q1Result.lines, QUOTE_FONT, QUOTE_LINE_HEIGHT, '#363a45')

    const attr1Y = q1Result.bottom + 8

    const qm2Y = attr1Y + ATTR_LINE_HEIGHT + 32
    const q2Top = qm2Y + 16 + 14
    const q2Height = Math.max(0, stageHeight - q2Top - 24)
    const q2Region: Rect = { x: gutter, y: q2Top, width: textWidth, height: q2Height }
    const q2Result = layoutColumn(preparedQ2, { segmentIndex: 0, graphemeIndex: 0 }, q2Region, QUOTE_LINE_HEIGHT, obstacles, hPad, vPad)
    quote2LineEls = syncPool(quote2LineEls, q2Result.lines.length)
    applyLines(quote2LineEls, q2Result.lines, QUOTE_FONT, QUOTE_LINE_HEIGHT, '#363a45')

    const attr2Y = q2Result.bottom + 6

    syncAttrPool(2)
    for (const [i, d] of [{ text: QUOTE_1_ATTR, y: attr1Y }, { text: QUOTE_2_ATTR, y: attr2Y }].entries()) {
      const el = attrEls[i]!
      el.textContent = d.text; el.style.left = `${gutter}px`; el.style.top = `${d.y}px`
      el.style.font = ATTR_FONT; el.style.lineHeight = `${ATTR_LINE_HEIGHT}px`
      el.style.color = '#1b1d22'; el.style.letterSpacing = '-0.14px'
      el.style.width = `${textWidth}px`; el.style.whiteSpace = 'normal'
      el.style.right = ''; el.style.textAlign = ''
    }

    const qms = [{ x: gutter, y: qm1Y }, { x: gutter, y: qm2Y }]
    while (quoteMarkEls.length < qms.length) {
      const qel = document.createElement('span'); qel.className = 'quote-mark'
      const qimg = document.createElement('img'); qimg.src = resolveAssetUrl(quoteMarkUrl); qimg.alt = '"'
      qel.appendChild(qimg); stage.appendChild(qel); quoteMarkEls.push(qel)
    }
    while (quoteMarkEls.length > qms.length) quoteMarkEls.pop()!.remove()
    for (let i = 0; i < qms.length; i++) {
      const qel = quoteMarkEls[i]!
      qel.style.left = `${qms[i]!.x}px`; qel.style.top = `${qms[i]!.y}px`
    }
  }

  requestAnimationFrame(render)
}

requestAnimationFrame(render)
