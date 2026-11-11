import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyLocale,
  htmlAttrsFor,
  readStoredLang,
  restorePage,
  writeStoredLang,
} from '@/lib/pageTranslate.js'

// The language of the visible page. English is the site language.
// Hebrew, Russian, Italian, and French come from the static locale files.
// The choice is remembered in this browser.

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
  const gen = useRef(0)

  const choose = useCallback((next) => {
    setLang(next === 'he' || next === 'ru' || next === 'it' || next === 'fr' ? next : 'en')
  }, [])

  useEffect(() => {
    const mine = ++gen.current
    let timer
    applyAttrs(lang)
    writeStoredLang(storage(), lang)

    const run = () => {
      if (mine !== gen.current) return
      if (lang === 'en') {
        restorePage()
        applyAttrs('en')
        return
      }
      applyLocale(document.body, lang)
    }
    run()

    const observer = new MutationObserver(() => {
      if (mine !== gen.current || lang === 'en') return
      window.clearTimeout(timer)
      timer = window.setTimeout(run, 30)
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'aria-label', 'alt', 'title'],
    })

    return () => {
      gen.current += 1
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [lang])

  const value = useMemo(() => ({ lang, choose, pending: false, notice: '' }), [lang, choose])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider')
  return ctx
}
