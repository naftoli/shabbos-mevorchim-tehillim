import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { translatePage } from '@/services/api.js'
import {
  htmlAttrsFor,
  readStoredLang,
  restorePage,
  translateDocument,
  TRANSLATION_UNAVAILABLE,
  writeStoredLang,
} from '@/lib/pageTranslate.js'

// The language the visible page is in. English is the site language.
// Hebrew, Russian, Italian, and French come from POST /translate.
// The choice is remembered only after a translation actually lands.

const LanguageContext = createContext(null)

function storage() {
  try { return globalThis.localStorage } catch { return null }
}

function applyAttrs(lang) {
  const attrs = htmlAttrsFor(lang)
  document.documentElement.dir = attrs.dir
  document.documentElement.lang = attrs.lang
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => readStoredLang(storage()))
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const cacheRef = useRef(new Map())
  const keepNotice = useRef(false)
  const gen = useRef(0)

  const choose = useCallback((next) => {
    keepNotice.current = false
    setNotice('')
    setLang(next === 'he' || next === 'ru' || next === 'it' || next === 'fr' ? next : 'en')
  }, [])

  useEffect(() => {
    const mine = ++gen.current
    const isCurrent = () => mine === gen.current
    let observer
    let timer
    let running = false
    let queued = false
    let dead = false

    applyAttrs(lang)

    const fail = () => {
      if (!isCurrent() || dead) return
      dead = true
      restorePage()
      applyAttrs('en')
      writeStoredLang(storage(), 'en')
      keepNotice.current = true
      setNotice(TRANSLATION_UNAVAILABLE)
      setPending(false)
      setLang('en')
    }

    const run = async () => {
      if (!isCurrent() || dead) return
      if (lang === 'en') {
        restorePage()
        applyAttrs('en')
        writeStoredLang(storage(), 'en')
        setPending(false)
        if (!keepNotice.current) setNotice('')
        keepNotice.current = false
        return
      }
      if (running) {
        queued = true
        return
      }
      running = true
      try {
        do {
          queued = false
          await translateDocument(
            document.body,
            lang,
            cacheRef.current,
            translatePage,
            isCurrent,
            () => { if (isCurrent()) setPending(true) },
          )
        } while (queued && isCurrent() && !dead)
        if (!isCurrent() || dead) return
        writeStoredLang(storage(), lang)
        setNotice('')
        setPending(false)
      } catch {
        fail()
      } finally {
        running = false
      }
    }

    run()

    if (lang !== 'en') {
      observer = new MutationObserver(() => {
        if (!isCurrent() || dead) return
        window.clearTimeout(timer)
        timer = window.setTimeout(() => { run() }, 40)
      })
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['placeholder', 'aria-label', 'alt', 'title'],
      })
    }

    return () => {
      gen.current += 1
      dead = true
      observer?.disconnect()
      window.clearTimeout(timer)
    }
  }, [lang])

  const value = useMemo(() => ({ lang, choose, pending, notice }), [lang, choose, pending, notice])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider')
  return ctx
}
