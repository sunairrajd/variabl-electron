import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { useAppStore, type Playlist } from '@/stores/useAppStore'

interface PlaylistPickerStepProps {
  onNext: () => void
  onBack: () => void
}

// Playlist interface imported from useAppStore


const EMOJIS = ['🌱', '🔥', '🏀', '🍒', '🚀', '🦖', '📂', '💡', '🎵', '⚡️']
const getEmoji = (index: number) => EMOJIS[index % EMOJIS.length]

export default function PlaylistPickerStep({ onNext, onBack }: PlaylistPickerStepProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const deviceToken = useAuthStore((s) => s.deviceToken)
  const setSelectedPlaylist = useAppStore((s) => s.setSelectedPlaylist)
  const baseUrl = 'https://tabrevolver.variabl.co'

  const { data: playlists, isLoading, error, refetch } = useQuery<Playlist[]>({
    queryKey: ['playlists', deviceToken],
    queryFn: async () => {
      if (!deviceToken) return []
      try {
        const res = await window.electronAPI.invoke('fetch-playlists', baseUrl, deviceToken)
        return res
      } catch (err: any) {
        console.error('IPC fetch failed, attempting direct fetch fallback:', err)
        // Fallback to direct fetch in case of developer process restarts not having registered IPC yet
        const response = await fetch(`${baseUrl}/api/playlists`, {
          headers: {
            'Authorization': `Bearer ${deviceToken}`
          }
        })
        if (!response.ok) {
          throw new Error('Failed to fetch playlists')
        }
        return response.json()
      }
    },
    enabled: !!deviceToken
  })

  // Auto-select the first playlist once they load
  useEffect(() => {
    if (playlists && playlists.length > 0 && !selectedId) {
      setSelectedId(playlists[0].id)
    }
  }, [playlists, selectedId])

  return (
    <div className="relative flex flex-col items-center w-full h-full p-12 opacity-0 animate-screen-enter">
      <button 
        onClick={onBack}
        className="absolute left-12 top-12 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 transition-[transform,colors] duration-[160ms] ease-emil-out active:scale-[0.85] cursor-pointer"
      >
        <ArrowLeft className="h-5 w-5 text-slate-600" />
      </button>

      <div className="text-center max-w-md mt-8 mb-16">
        <h1 className="text-3xl font-medium text-slate-800 mb-3 leading-tight">
          Choose a playlist to start
        </h1>
        <p className="text-sm text-slate-400">
          choose a playlist to start displaying content instantly.
        </p>
      </div>
      
      {isLoading && (
        <div className="flex flex-col items-center justify-center mb-auto gap-3 py-12">
          <Loader2 className="h-8 w-8 text-slate-500 animate-spin" />
          <p className="text-sm text-slate-500">Loading your playlists...</p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center mb-auto gap-3 py-12 max-w-sm text-center">
          <p className="text-sm text-red-500">Error: {(error as Error).message || 'Failed to load playlists'}</p>
          <Button onClick={() => refetch()} variant="outline" className="rounded-full mt-4 h-9">
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && (!playlists || playlists.length === 0) && (
        <div className="flex flex-col items-center justify-center mb-auto gap-3 py-12 max-w-sm text-center">
          <div className="text-4xl mb-2">📂</div>
          <p className="text-sm font-medium text-slate-800">No playlists found</p>
          <p className="text-xs text-slate-400">
            Create playlists on the Variabl website to display them here.
          </p>
        </div>
      )}

      {!isLoading && !error && playlists && playlists.length > 0 && (
        <div className="flex gap-8 mb-auto flex-wrap justify-center max-w-4xl">
          {playlists.map((playlist, idx) => {
            const isSelected = selectedId === playlist.id
            const emoji = getEmoji(idx)
            return (
              <button
                key={playlist.id}
                onClick={() => setSelectedId(playlist.id)}
                className="group relative flex flex-col items-center transition-transform duration-[160ms] ease-emil-out active:scale-[0.95]"
              >
                {isSelected && (
                  <div className="absolute -left-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#4a4a4a] text-white shadow-sm opacity-100 transition-opacity">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </div>
                )}
                
                <div className={`relative flex h-32 w-32 flex-col items-center justify-center rounded-full bg-white transition-shadow ${isSelected ? 'shadow-[0_4px_20px_rgba(0,0,0,0.08)]' : 'shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_15px_rgba(0,0,0,0.06)]'} border border-slate-50 mb-4`}>
                  <div className="text-3xl mb-1">{emoji}</div>
                  <div className="text-[11px] font-medium text-slate-800 truncate max-w-[90px]">{playlist.name}</div>
                  <div className="text-[9px] text-slate-400">Synced</div>
                </div>
                
                <div className="text-[10px] text-slate-400">
                  {playlist.tabs?.length || 0} tabs • {playlist.defaultInterval || 30}s interval
                </div>
              </button>
            )
          })}
        </div>
      )}
      
      <div className="mt-8 mb-4">
        <Button 
          onClick={() => {
            const selected = playlists?.find((p) => p.id === selectedId)
            if (selected) {
              setSelectedPlaylist(selected)
            }
            onNext()
          }}
          disabled={!selectedId}
          className="rounded-full bg-[#2a2a2a] hover:bg-black text-white px-10 h-10 font-medium disabled:opacity-50 cursor-pointer"
        >
          Start playing
        </Button>
      </div>
    </div>
  )
}

