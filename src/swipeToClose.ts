const OVERLAY_SELECTOR = '.modal-backdrop'

const AXIS_LOCK_PX = 8
const CLOSE_DISTANCE_PX = 110
const FLICK_DISTANCE_PX = 40
const FLICK_VELOCITY = 0.6
const SLIDE_OUT_MS = 220
const SNAP_BACK_MS = 200
const UNMOUNT_CHECK_MS = 80
const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'

type Drag = {
  overlay: HTMLElement
  panel: HTMLElement
  startX: number
  startY: number
  startedAt: number
  mode: 'pending' | 'drag' | 'ignore'
  dy: number
}

function topOverlay() {
  const overlays = document.querySelectorAll<HTMLElement>(OVERLAY_SELECTOR)
  return overlays[overlays.length - 1] ?? null
}

function isScrolledInside(target: Element, overlay: Element) {
  for (let el: Element | null = target; el && el !== overlay; el = el.parentElement) {
    if (!(el instanceof HTMLElement) || el.scrollTop <= 0) continue
    const overflowY = getComputedStyle(el).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') return true
  }
  return false
}

function snapBack({ overlay, panel, dy }: Drag) {
  panel.style.transform = ''
  overlay.style.opacity = ''
  panel.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], { duration: SNAP_BACK_MS, easing: EASING })
}

function requestClose() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

function slideOut(drag: Drag) {
  const { overlay, panel, dy } = drag
  const options = { duration: SLIDE_OUT_MS, easing: 'ease-in', fill: 'forwards' } as const
  panel.animate([{ transform: `translateY(${dy}px)` }, { transform: `translateY(${window.innerHeight}px)` }], options)
  const fade = overlay.animate([{ opacity: Number(overlay.style.opacity) || 1 }, { opacity: 0 }], options)

  const finish = () => {
    requestClose()
    window.setTimeout(() => {
      if (!overlay.isConnected) return
      overlay.getAnimations().forEach((a) => a.cancel())
      panel.getAnimations().forEach((a) => a.cancel())
      snapBack(drag)
    }, UNMOUNT_CHECK_MS)
  }
  fade.finished.then(finish).catch(finish)
}

export function installSwipeToClose() {
  let drag: Drag | null = null

  const onStart = (event: TouchEvent) => {
    drag = null
    if (event.touches.length !== 1) return

    const target = event.target
    if (!(target instanceof Element)) return

    const overlay = topOverlay()
    const panel = overlay?.firstElementChild
    if (!overlay || !(panel instanceof HTMLElement)) return
    if (!panel.contains(target)) return
    const inHeader = target.closest('.editor-head') !== null
    if (!inHeader && target.closest('input, textarea, select, [role=slider]')) return
    if (!inHeader && isScrolledInside(target, overlay)) return

    const touch = event.touches[0]
    drag = { overlay, panel, startX: touch.clientX, startY: touch.clientY, startedAt: performance.now(), mode: 'pending', dy: 0 }
  }

  const onMove = (event: TouchEvent) => {
    if (!drag) return

    const touch = event.touches[0]
    const dx = touch.clientX - drag.startX
    const dy = touch.clientY - drag.startY

    if (drag.mode === 'pending') {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return
      drag.mode = dy > Math.abs(dx) ? 'drag' : 'ignore'
    }

    if (drag.mode !== 'drag') return
    if (event.cancelable) event.preventDefault()

    drag.dy = Math.max(0, dy)
    drag.panel.style.transform = `translateY(${drag.dy}px)`
    drag.overlay.style.opacity = String(1 - Math.min(drag.dy / (window.innerHeight * 0.6), 0.7))
  }

  const onEnd = () => {
    const current = drag
    drag = null
    if (!current || current.mode !== 'drag') return

    const velocity = current.dy / Math.max(performance.now() - current.startedAt, 1)
    const shouldClose = current.dy > CLOSE_DISTANCE_PX || (velocity > FLICK_VELOCITY && current.dy > FLICK_DISTANCE_PX)

    if (shouldClose) slideOut(current)
    else snapBack(current)
  }

  document.addEventListener('touchstart', onStart, { passive: true })
  document.addEventListener('touchmove', onMove, { passive: false })
  document.addEventListener('touchend', onEnd, { passive: true })
  document.addEventListener('touchcancel', onEnd, { passive: true })
}
