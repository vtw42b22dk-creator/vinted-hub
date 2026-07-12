'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type RealtimeStatus = 'connecting' | 'live' | 'polling'

export function useSupabaseRealtime(onChange: () => void, tables: string[] = ['conversas', 'artigos_vinted']) {
  const onChangeRef = useRef(onChange)
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const supabase = createClient()
    let channel = supabase.channel(`hub-live-${tables.join('-')}`)

    for (const table of tables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => onChangeRef.current()
      )
    }

    channel.subscribe((state) => {
      if (state === 'SUBSCRIBED') setStatus('live')
      else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') setStatus('polling')
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tables])

  return status
}
