// Office-only API. The public pages do not import this module, so the demo
// WhatsApp numbers stay out of the public bundle. Live numbers come from the
// staff routes and are never returned by the public graphics API.

import { IS_DEMO } from '@/lib/liveMode.js'
import * as mashpia from './mashpia.js'
import {
  demoMarkGraphicsSent,
  demoMarkSchoolSent,
  demoOfficePlatoonGraphics,
  demoSaveWhatsapp,
} from '@/lib/platoonGraphicsOfficeDemo.js'

export function getOfficePlatoonGraphics(period) {
  if (!IS_DEMO) return mashpia.getOfficePlatoonGraphics(period)
  return demoOfficePlatoonGraphics(period)
}

export function saveSchoolWhatsapp(schoolId, whatsapp) {
  if (!IS_DEMO) return mashpia.saveSchoolWhatsapp(schoolId, whatsapp)
  return demoSaveWhatsapp(schoolId, whatsapp)
}

export function markPlatoonGraphicsSent(body) {
  if (!IS_DEMO) return mashpia.markPlatoonGraphicsSent(body)
  return demoMarkGraphicsSent(body)
}

export function markSchoolGraphicsSent(schoolId) {
  if (!IS_DEMO) return mashpia.markSchoolGraphicsSent(schoolId)
  return demoMarkSchoolSent(schoolId)
}
