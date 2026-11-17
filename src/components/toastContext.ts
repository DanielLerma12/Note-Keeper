import { createContext, useContext } from 'react'

export type ToastAction = { label: string; run: () => void }
export type ToastFn = (message: string, action?: ToastAction) => void

export const ToastContext = createContext<ToastFn>(() => {})

export const useToast = () => useContext(ToastContext)
