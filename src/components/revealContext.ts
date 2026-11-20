import { createContext, useContext } from 'react'

export type RevealRequest = {
  label: string
  value: string
  /** When given, the value is editable inside the modal. */
  onChange?: (value: string) => void
}

export const RevealContext = createContext<(request: RevealRequest) => void>(() => {})

/** Asks for the account password, then shows the secret in a modal. */
export const useReveal = () => useContext(RevealContext)
