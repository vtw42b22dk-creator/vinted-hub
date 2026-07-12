import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key)
}

export async function resolveUserId(req: Request): Promise<string | null> {
  const secret = req.headers.get('x-sync-secret')
  if (!secret) return null

  const supabase = getAdminClient()
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('sync_secret', secret)
    .maybeSingle()

  return data?.id ?? null
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
}
