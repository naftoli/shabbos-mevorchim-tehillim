import { classNameIsHebrew, formatClassName } from '@/lib/formatClassName.js'

// <bdi> isolates the label from the English around it. An all-Hebrew name also
// uses the Hebrew face, which isolates and sets RTL on its own.
export default function ClassName({ name, className = '' }) {
  const text = formatClassName(name)
  if (!text) return null
  const hebrew = classNameIsHebrew(text) && !/[A-Za-z]/.test(text)
  const cls = [hebrew ? 'font-heb' : '', className].filter(Boolean).join(' ')
  return <bdi className={cls || undefined}>{text}</bdi>
}
