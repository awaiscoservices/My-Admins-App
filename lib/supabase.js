import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client, created on first use rather than on import.
 *
 * It used to be built at module scope:
 *
 *   export const supabase = createBrowserClient(url, key)
 *
 * which runs as soon as any page imports this file — including while Next
 * collects page data during `next build`. If the two NEXT_PUBLIC_ variables
 * were missing, the whole build failed with a webpack stack trace pointing at
 * a minified chunk, naming whichever page happened to be first. That is what
 * broke preview deployments whose env vars were only set for Production.
 *
 * Deferring creation means a missing variable fails at the point something
 * actually tries to talk to Supabase, with a message that says which variable
 * is missing. Builds no longer depend on runtime configuration.
 *
 * Cookie-based session, so middleware.js can see that the user is signed in.
 */
let client = null

function getClient() {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    const missing = [
      !url && 'NEXT_PUBLIC_SUPABASE_URL',
      !key && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ].filter(Boolean)
    throw new Error(
      `Supabase is not configured: ${missing.join(' and ')} ` +
      `${missing.length > 1 ? 'are' : 'is'} not set. ` +
      'Add them in Vercel under Settings - Environment Variables, ticking ' +
      'every environment you deploy to (Preview as well as Production), ' +
      'then redeploy.'
    )
  }

  client = createBrowserClient(url, key)
  return client
}

/**
 * Stands in for the client itself, so every existing
 * `import { supabase } from '../lib/supabase'` keeps working unchanged.
 * The real client is built the first time any property is read.
 */
export const supabase = new Proxy({}, {
  get(_target, prop) {
    const real = getClient()
    const value = real[prop]
    return typeof value === 'function' ? value.bind(real) : value
  },
  set(_target, prop, value) {
    getClient()[prop] = value
    return true
  },
  has(_target, prop) {
    return prop in getClient()
  },
})
