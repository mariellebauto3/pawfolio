import { createContext, useContext } from 'react'

// Prototype-only state: which role is being viewed and that account's status.
export const Proto = createContext(null)
export const useProto = () => useContext(Proto)

export const roleHome = { guest: '/', pet: '/feed', human: '/feed', admin: '/admin' }
