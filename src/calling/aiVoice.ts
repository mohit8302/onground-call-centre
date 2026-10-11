/**
 * Browser speech for the AI call: speech-to-text with the Web Speech API's
 * SpeechRecognition (Chrome and Edge send the audio to their own speech
 * service), and text-to-speech with speechSynthesis (runs on the device).
 */

export type VoiceLanguage = 'en-IN' | 'hi-IN'

// SpeechRecognition isn't in TypeScript's DOM types yet; this is the part we use.
interface RecognitionResultEvent {
  resultIndex: number
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
}

interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionResultEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const canListen = () => recognitionCtor() !== null
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export interface ListenHandlers {
  onInterim: (text: string) => void
  onFinal: (text: string) => void
  /** Recognition stopped without a final result (silence, or the service ended it). */
  onIdle: () => void
  onError: (code: string) => void
}

/** Listens for one utterance. Returns a function that stops listening. */
export function listenOnce(language: VoiceLanguage, handlers: ListenHandlers): () => void {
  const Ctor = recognitionCtor()
  if (!Ctor) {
    handlers.onError('unsupported')
    return () => {}
  }
  const rec = new Ctor()
  rec.lang = language
  rec.continuous = false
  rec.interimResults = true
  let gotFinal = false
  let stopped = false

  rec.onresult = (e) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i]
      if (result.isFinal) {
        gotFinal = true
        const text = result[0].transcript.trim()
        if (text) handlers.onFinal(text)
      } else {
        interim += result[0].transcript
      }
    }
    if (!gotFinal) handlers.onInterim(interim)
  }
  rec.onerror = (e) => {
    // "no-speech" and "aborted" are normal; the caller just listens again.
    if (e.error !== 'no-speech' && e.error !== 'aborted') handlers.onError(e.error)
  }
  rec.onend = () => {
    if (!gotFinal && !stopped) handlers.onIdle()
  }
  rec.start()
  return () => {
    stopped = true
    rec.abort()
  }
}

function pickVoice(language: VoiceLanguage) {
  const voices = window.speechSynthesis.getVoices()
  const base = language.split('-')[0]
  return (
    voices.find((v) => v.lang === language) ??
    voices.find((v) => v.lang.replace('_', '-') === language) ??
    (base === 'en' ? voices.find((v) => v.lang === 'en-GB') : undefined) ??
    voices.find((v) => v.lang.startsWith(base)) ??
    null
  )
}

/**
 * Speaks the text sentence by sentence (Chrome cuts off long utterances) and
 * resolves when done. A timeout fallback resolves anyway if the browser never
 * reports the end, e.g. when no voice is installed.
 */
export function speak(text: string, language: VoiceLanguage): { done: Promise<void>; cancel: () => void } {
  if (!canSpeak() || !text) return { done: Promise.resolve(), cancel: () => {} }
  const synth = window.speechSynthesis
  synth.cancel()
  const sentences = text.match(/[^.!?।]+[.!?।]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text]
  const voice = pickVoice(language)
  let finish = () => {}
  const done = new Promise<void>((resolve) => {
    finish = resolve
  })

  // Rough speaking time plus slack: about 160 words a minute.
  const words = text.split(/\s+/).length
  const fallback = window.setTimeout(() => finish(), words * 450 + 3000)

  // Kept in an array so the utterances aren't garbage-collected mid-speech,
  // which would stop their end events from firing.
  const utterances = sentences.map((sentence, i) => {
    const u = new SpeechSynthesisUtterance(sentence)
    u.lang = language
    if (voice) u.voice = voice
    if (i === sentences.length - 1) {
      u.onend = () => finish()
      u.onerror = () => finish()
    }
    return u
  })
  utterances.forEach((u) => synth.speak(u))
  done.then(() => window.clearTimeout(fallback))

  return {
    done,
    cancel: () => {
      synth.cancel()
      finish()
    },
  }
}

// Chrome loads its voice list asynchronously; ask early so it's ready.
if (canSpeak()) window.speechSynthesis.getVoices()
