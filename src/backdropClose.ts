import type { MouseEvent, PointerEvent } from 'react'

let pressedTarget: EventTarget | null = null
let releasedTarget: EventTarget | null = null

export function closeOnBackdropClick(event: MouseEvent<HTMLElement>, onClose: () => void) {
  const bothOnBackdrop = pressedTarget === event.currentTarget && releasedTarget === event.currentTarget
  pressedTarget = null
  releasedTarget = null
  if (event.target === event.currentTarget && bothOnBackdrop) onClose()
}

export const backdropPress = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => {
    pressedTarget = event.target
  },
  onPointerUp: (event: PointerEvent<HTMLElement>) => {
    releasedTarget = event.target
  },
}

export function backdropClose(onClose: () => void) {
  return {
    ...backdropPress,
    onClick: (event: MouseEvent<HTMLElement>) => closeOnBackdropClick(event, onClose),
  }
}
