import { createContext, useContext } from 'react'
import type { CallRecord, ChatMessage, ConsentRecord, ScreenId } from '../types'

export interface AppStateApi {
  screen: ScreenId
  navigate: (screen: ScreenId) => void
  activeChannelId: string
  openChannel: (channelId: string) => void

  recentCalls: CallRecord[]
  addCall: (record: CallRecord) => void

  messagesFor: (channelId: string) => ChatMessage[]
  sendMessage: (channelId: string, text: string) => void
  needsInputAnswers: Record<string, string>
  answerNeedsInput: (channelId: string, answer: string) => void

  consents: ConsentRecord[]
  addConsent: (record: ConsentRecord) => void

  completedTasks: string[]
  toggleTask: (taskId: string) => void

  leadsModalIndex: number | null
  openLeadsModal: (leadId?: string) => void
  setLeadsModalIndex: (index: number | null) => void

  sopReviewCallId: string | null
  setSopReviewCallId: (id: string | null) => void

  toast: string
  showToast: (message: string) => void

  resetDemo: () => void
}

export const AppStateContext = createContext<AppStateApi | null>(null)

export function useAppState() {
  const api = useContext(AppStateContext)
  if (!api) throw new Error('useAppState must be used inside <AppStateProvider>')
  return api
}
