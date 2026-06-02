import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { useAppStore, type Playlist } from '@/stores/useAppStore'

interface PlaylistPickerStepProps {
  onNext: () => void
  onBack: () => void
}

const EMOJIS = ['🌱', '🔥', '🏀', '🍒', '🚀', '🦖', '📂', '💡', '🎵', '⚡️']
const getEmoji = (index: number) => EMOJIS[index % EMOJIS.length]

export default function PlaylistPickerStep({ onNext, onBack }: PlaylistPickerStepProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [updateReady, setUpdateReady] = useState(false)
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

  useEffect(() => {
    const cleanup = window.electronAPI.on('update-downloaded', () => {
      setUpdateReady(true)
    })
    return cleanup
  }, [])

  return (
    <div className="flex flex-col justify-between items-center w-full h-full p-[3vw] opacity-0 animate-screen-enter relative">
      {updateReady && (
        <Button
          onClick={() => window.electronAPI.invoke('install-update')}
          className="absolute top-[2vw] right-[3vw] rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
        >
          Restart to Update
        </Button>
      )}

      {/* Pinned Header Spacer & Title Area */}
      <div className="w-full flex flex-col items-center">
        <div className="w-full flex items-center justify-between">
          <div className="h-[clamp(2.5rem,3.2vw,4.5rem)] w-[clamp(2.5rem,3.2vw,4.5rem)] opacity-0" />
          <div className="h-[clamp(2.5rem,3.2vw,4.5rem)]" />
        </div>

        <div className="text-center max-w-[45vw] min-w-[320px] mt-[1vw]">
          <h1 className="text-[clamp(1.2rem,2vw,2.8rem)] font-light text-slate-700 mb-[1vw] tracking-[-1px] leading-[1.1]">
            Choose a playlist to start
          </h1>
          <p className="text-[clamp(0.75rem,0.9vw,1.2rem)] font-normal text-slate-400">
            Select a playlist to start displaying content instantly
          </p>
        </div>
      </div>

      {/* Centered Content */}
      <div className="flex flex-col items-center justify-center flex-1 my-[2vw] w-full max-w-[80vw]">
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-[1vw]">
            <Loader2 className="h-[clamp(1.5rem,2vw,2.5rem)] w-[clamp(1.5rem,2vw,2.5rem)] text-slate-500 animate-spin" />
            <p className="text-[clamp(0.75rem,0.9vw,1.2rem)] text-slate-500">Loading your playlists...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center gap-[1vw] text-center">
            <p className="text-[clamp(0.75rem,0.9vw,1.2rem)] text-red-500">Error: {(error as Error).message || 'Failed to load playlists'}</p>
            <Button onClick={() => refetch()} variant="outline" className="rounded-full mt-[1vw] h-[clamp(2rem,2.5vw,3rem)] text-[clamp(0.75rem,0.9vw,1.1rem)]">
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && (!playlists || playlists.length === 0) && (
          <div className="flex flex-col items-center justify-center gap-[0.5vw] text-center">
            <div className="text-[clamp(2rem,3vw,4rem)] mb-[0.25vw]">📂</div>
            <p className="text-[clamp(0.75rem,0.9vw,1.5rem)] font-normal text-slate-800">No playlists found</p>
            <p className="text-[clamp(1rem,1.2vw,1.5rem)] text-slate-400 mt-[0.05vw]">
              Create your first playlist at{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  window.electronAPI.invoke('open-external', 'https://variabl.co/app')
                }}
                className="underline hover:text-slate-600 transition-colors cursor-pointer"
              >
                variabl.co/app
              </a>
              {' '}to display them here
            </p>
          </div>
        )}

        {!isLoading && !error && playlists && playlists.length > 0 && (
          <div className="flex gap-[1.5vw] flex-wrap justify-center overflow-y-auto max-h-[50vh] p-[1vw] pb-[3vw] hide-scrollbar w-full">
            {playlists.map((playlist, idx) => {
              const isSelected = selectedId === playlist.id
              const emoji = playlist.emoji || '🌱'

              const totalSeconds = playlist.tabs?.reduce((acc, tab) => {
                const isYouTube = tab.type === 'youtube' || tab.faviconURL?.includes('youtube.com')
                const isFixed = playlist.rotationType === 'fixed'
                const interval = isYouTube
                  ? (tab.interval || 30)
                  : (isFixed
                    ? (playlist.defaultInterval || 30)
                    : (tab.interval || playlist.defaultInterval || 30))
                return acc + interval
              }, 0) || 0

              const minutes = Math.floor(totalSeconds / 60)
              const seconds = totalSeconds % 60
              const totalDuration = minutes > 0 ? `${minutes}m ${seconds > 0 ? `${seconds}s` : ''}` : `${seconds}s`

              const tabsCount = playlist.tabs?.length || 0

              return (
                <button
                  key={playlist.id}
                  onClick={() => setSelectedId(playlist.id)}
                  className={`bg-white rounded-[1.2vw] border-1 active:border-2  px-[1.5vw] pt-[2vw] pb-[2vw] transition-all duration-300 ease-out relative cursor-pointer flex flex-col items-center w-[clamp(160px,16vw,260px)] group ${isSelected
                    ? 'border-gray-400 shadow-[0_12px_32px_rgba(0,0,0,0.08)] scale-[1.02]'
                    : 'border-gray-200 border-1  active:border-2 hover:shadow-[0_12px_32px_rgba(0,0,0,0.04)] hover:border-gray-300 hover:-translate-y-[0.3vw] active:scale-[0.98] active:translate-y-0 active:shadow-[0_4px_12px_rgba(0,0,0,0.02)]'
                    }`}
                  style={{ fontFamily: 'var(--font-geist-sans)' }}
                >
                  {/* Emoji */}
                  <div className="mb-[1vw] transform group-hover:scale-110 transition-transform duration-300 ease-out">
                    <span className="text-[clamp(1.5rem,2.2vw,3rem)]">{emoji}</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-[clamp(0.8rem,0.95vw,1.2rem)] font-normal text-slate-800 mb-[0.5vw] mt-[0.5vw] text-center text-ellipsis overflow-hidden max-w-full">
                    {playlist.name}
                  </h3>

                  {/* Duration */}
                  <p
                    className="text-[clamp(0.6rem,0.75vw,0.9rem)] text-gray-500 text-center"
                    style={{ fontFamily: 'var(--font-geist-mono)' }}
                  >
                    {tabsCount} {tabsCount === 1 ? 'tab' : 'tabs'} · {totalDuration}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Pinned Footer */}
      <div className="w-full flex flex-col justify-center items-center gap-[1vw]">
        <Button
          onClick={() => {
            const selected = playlists?.find((p) => p.id === selectedId)
            if (selected) {
              setSelectedPlaylist(selected)
            }
            onNext()
          }}
          disabled={!selectedId || !playlists || playlists.length === 0}
          className="rounded-xl bg-[#2a2a2a] hover:bg-black text-white px-[4vw] w-full max-w-[280px] 4k:max-w-[400px] h-[clamp(2.5rem,3.2vw,4.5rem)] text-[clamp(0.8rem,0.95vw,1.25rem)] font-medium cursor-pointer transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.97] hover:shadow-lg hover:shadow-black/5 disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:scale-100 disabled:active:scale-100 disabled:pointer-events-auto disabled:cursor-not-allowed disabled:shadow-none disabled:opacity-100 animate-cta-enter"
        >
          Start playing
        </Button>
      </div>
    </div>
  )
}

