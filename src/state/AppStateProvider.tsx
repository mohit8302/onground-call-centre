import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AGENT_PROFILE, CHANNELS, DEMO_RECENT_CALLS, LEADS } from '../data/mockData'
import { clearPersistedState, usePersistentState } from '../lib/usePersistentState'
import { makeId, nowClock } from '../lib/format'
import type { CallRecord, ChatMessage, ConsentRecord, ScreenId } from '../types'
import { AppStateContext } from './appContext'
import type { AppStateApi } from './appContext'

// Bump this when the stored shape changes so old demo data is discarded.
const STATE_VERSION = 'v1'

export default function AppStateProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = usePersistentState<ScreenId>(`${STATE_VERSION}:screen`, 'dashboard')
  const [activeChannelId, setActiveChannelId] = usePersistentState(`${STATE_VERSION}:channel`, CHANNELS[0].id)
  const [recentCalls, setRecentCalls] = usePersistentState<CallRecord[]>(`${STATE_VERSION}:calls`, DEMO_RECENT_CALLS)
  // Only messages the user sent are stored; seeds always come from mock data.
  const [sentMessages, setSentMessages] = usePersistentState<Record<string, ChatMessage[]>>(`${STATE_VERSION}:messages`, {})
  const [needsInputAnswers, setNeedsInputAnswers] = usePersistentState<Record<string, string>>(`${STATE_VERSION}:needs-input`, {})
  const [completedTasks, setCompletedTasks] = usePersistentState<string[]>(`${STATE_VERSION}:tasks`, [])
  const [consents, setConsents] = usePersistentState<ConsentRecord[]>(`${STATE_VERSION}:consents`, [])

  const [leadsModalIndex, setLeadsModalIndex] = useState<number | null>(null)
  const [sopReviewCallId, setSopReviewCallId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
  }, [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 3000)
  }, [])

  const navigate = useCallback(
    (next: ScreenId) => {
      setScreen(next)
      window.scrollTo({ top: 0 })
    },
    [setScreen],
  )

  const openChannel = useCallback(
    (channelId: string) => {
      setActiveChannelId(channelId)
      navigate('pulse-channel')
    },
    [setActiveChannelId, navigate],
  )

  const addCall = useCallback(
    (record: CallRecord) => setRecentCalls((calls) => [record, ...calls]),
    [setRecentCalls],
  )

  const messagesFor = useCallback(
    (channelId: string) => {
      const seed = CHANNELS.find((c) => c.id === channelId)?.seed ?? []
      return [...seed, ...(sentMessages[channelId] ?? [])]
    },
    [sentMessages],
  )

  const sendMessage = useCallback(
    (channelId: string, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const message: ChatMessage = {
        id: makeId('msg'),
        author: AGENT_PROFILE.name,
        initials: AGENT_PROFILE.initials,
        text: trimmed,
        sentAt: nowClock(),
        mine: true,
      }
      setSentMessages((all) => ({ ...all, [channelId]: [...(all[channelId] ?? []), message] }))
    },
    [setSentMessages],
  )

  const answerNeedsInput = useCallback(
    (channelId: string, answer: string) => {
      setNeedsInputAnswers((all) => ({ ...all, [channelId]: answer }))
      sendMessage(channelId, answer)
    },
    [setNeedsInputAnswers, sendMessage],
  )

  const addConsent = useCallback(
    (record: ConsentRecord) => setConsents((all) => [record, ...all]),
    [setConsents],
  )

  const toggleTask = useCallback(
    (taskId: string) =>
      setCompletedTasks((done) => (done.includes(taskId) ? done.filter((id) => id !== taskId) : [...done, taskId])),
    [setCompletedTasks],
  )

  const openLeadsModal = useCallback((leadId?: string) => {
    const index = leadId ? LEADS.findIndex((l) => l.id === leadId) : 0
    setLeadsModalIndex(Math.max(0, index))
  }, [])

  const resetDemo = useCallback(() => {
    clearPersistedState()
    setScreen('dashboard')
    setActiveChannelId(CHANNELS[0].id)
    setRecentCalls(DEMO_RECENT_CALLS)
    setSentMessages({})
    setNeedsInputAnswers({})
    setCompletedTasks([])
    setConsents([])
    showToast('Demo data reset')
  }, [setScreen, setActiveChannelId, setRecentCalls, setSentMessages, setNeedsInputAnswers, setCompletedTasks, setConsents,
    showToast])

  const api = useMemo<AppStateApi>(
    () => ({
      screen,
      navigate,
      activeChannelId,
      openChannel,
      recentCalls,
      addCall,
      messagesFor,
      sendMessage,
      needsInputAnswers,
      answerNeedsInput,
      consents,
      addConsent,
      completedTasks,
      toggleTask,
      leadsModalIndex,
      openLeadsModal,
      setLeadsModalIndex,
      sopReviewCallId,
      setSopReviewCallId,
      toast,
      showToast,
      resetDemo,
    }),
    [screen, navigate, activeChannelId, openChannel, recentCalls, addCall, messagesFor, sendMessage, needsInputAnswers,
      answerNeedsInput, consents, addConsent, completedTasks, toggleTask, leadsModalIndex, openLeadsModal, sopReviewCallId, toast, showToast,
      resetDemo],
  )

  return <AppStateContext.Provider value={api}>{children}</AppStateContext.Provider>
}
