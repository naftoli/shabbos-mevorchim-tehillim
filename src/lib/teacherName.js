// Mashpia stores a placeholder in classes.class_teacher when no teacher was
// entered. Those are not a name. A real name is returned trimmed; a
// placeholder (case-insensitive, after trim) is returned as no teacher so
// the "· teacher" chip and its title stay hidden.

const PLACEHOLDER_TEACHERS = new Set(['na', 'n/a', 'none', '-', '0'])

export function teacherName(value) {
  const text = String(value ?? '').trim()
  if (!text || PLACEHOLDER_TEACHERS.has(text.toLowerCase())) return ''
  return text
}
