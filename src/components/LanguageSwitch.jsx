import { TARGET_LANGS } from '@/lib/pageTranslate.js'
import { useLanguage } from '@/context/LanguageContext.jsx'

const CHOICES = [{ code: 'en', label: 'English' }, ...TARGET_LANGS]

function itemClass(on) {
  return `min-h-11 rounded-full px-2.5 font-cond text-[16px] uppercase leading-none tracking-[0.04em] sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-[15px] ${
    on ? 'bg-white text-green shadow-sm' : 'text-green hover:bg-white/50'
  }`
}

// English restores the original page. It is not sent to POST /translate.
// The four language names stay in English so the control itself is not
// swapped out from under the reader.
export default function LanguageSwitch() {
  const { lang, choose } = useLanguage()
  return (
    <div role="group" aria-label="Language" data-no-translate dir="ltr" className="flex flex-wrap items-center gap-1">
      {CHOICES.map((item) => (
        <button
          key={item.code}
          type="button"
          aria-pressed={lang === item.code}
          onClick={() => choose(item.code)}
          className={itemClass(lang === item.code)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
