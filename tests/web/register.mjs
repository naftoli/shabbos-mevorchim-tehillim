// Apply the `@/` alias before any test file loads. node --test runs each file
// in its own process and passes this --import through.
import { register } from 'node:module'

register('./loader.mjs', import.meta.url)
