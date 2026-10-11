import { createContext, useContext } from 'react'
import type { CallRecord } from '../types'

export type CallStatus =
  | 'connecting' // registering with the PeerJS signalling server
  | 'ready' // registered, idle, can place or receive calls
  | 'offline' // lost the signalling server, user can retry
  | 'calling' // outgoing call placed, waiting for the other side
  | 'ringing' // incoming call waiting for accept/reject
  | 'in-call' // remote audio is flowing

/** Business context attached to a call, so it can be logged against a lead. */
export interface CallTarget {
  label: string
  leadId?: string
  /** Known PeerJS ID to prefill (e.g. calling back a live missed call). */
  peerId?: string
  purpose: 'lead' | 'callback' | 'practice' | 'manual'
}

/** A finished, connected call waiting for the agent to pick an outcome. */
export interface PendingWrapUp {
  record: CallRecord
}

export interface CallApi {
  myId: string
  status: CallStatus
  error: string
  remotePeerId: string
  target: CallTarget | null
  isMuted: boolean
  elapsedSec: number
  dockOpen: boolean
  wrapUp: PendingWrapUp | null
  /** Opens the dialer, optionally tagged with a lead / purpose. */
  openDialer: (target?: CallTarget) => void
  closeDock: () => void
  startCall: (peerId: string) => Promise<void>
  acceptCall: () => Promise<void>
  rejectCall: () => void
  hangUp: () => void
  toggleMute: () => void
  reconnect: () => void
  clearError: () => void
  finishWrapUp: (outcome: string | null) => void
}

export const CallContext = createContext<CallApi | null>(null)

export function useCall() {
  const api = useContext(CallContext)
  if (!api) throw new Error('useCall must be used inside <CallProvider>')
  return api
}
