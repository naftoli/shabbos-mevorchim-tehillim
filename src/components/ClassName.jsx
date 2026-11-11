import { classNameIsHebrew, formatClassName, hebrewClassLabel } from '@/lib/formatClassName.js'

// <bdi> isolates the label from the English around it. An all-Hebrew name also
// uses the Hebrew face, which isolates and sets RTL on its own.
export default function ClassName({ name, className = '' }) {
  const text = formatClassName(name)
  if (!text) return null
  const hebrew = classNameIsHebrew(text) && !/[A-Za-z]/.test(text)
  const cls = [hebrew ? 'font-heb' : '', className].filter(Boolean).join(' ')
  return <bdi className={cls || undefined}>{text}</bdi>
}

// Class-report label: Hebrew letters when the name maps (אא, אב), otherwise
// the same letters-only label ClassName already shows.
export function HebrewClassName({ name, grade, className = '' }) {
  const text = hebrewClassLabel(name, grade)
  if (!text) return null
  const hebrew = /[\u0590-\u05FF]/.test(text) && !/[A-Za-z0-9]/.test(text)
  if (!hebrew) return <ClassName name={name} className={className} />
  const cls = ['font-heb', className].filter(Boolean).join(' ')
  return <bdi dir="rtl" className={cls}>{text}</bdi>
}
