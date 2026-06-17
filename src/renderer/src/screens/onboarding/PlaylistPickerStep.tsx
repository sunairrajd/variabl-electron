import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Monitor, Tv, CheckCircle2, Circle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { useAppStore, type Playlist } from '@/stores/useAppStore'
import { MonitorInfo } from '../../../../shared/ipc'
import { syncDeviceAndScreens } from '../../services/DeviceSyncService'

interface PlaylistPickerStepProps {
  onNext: () => void
  onBack: () => void
}

const MonitorItem = ({
  monitor,
  assigned,
  isSelected,
  onClick
}: {
  monitor: MonitorInfo,
  assigned: Playlist | null | undefined,
  isSelected: boolean,
  onClick: () => void
}) => {
  const isTv = monitor.label.toLowerCase().includes('tv') || monitor.label.toLowerCase().includes('bravia')

  return (
    <button
      onClick={onClick}
      className={`group flex flex-row items-center px-6 py-6 rounded-[16px] w-full text-left transition-all duration-200 ease-out cursor-pointer active:scale-[0.98] ${isSelected
        ? 'bg-slate-200/80'
        : 'bg-transparent hover:bg-slate-50'
        }`}
    >
      <div className={`mr-4 transition-colors duration-200 ${isSelected ? 'text-slate-600' : 'text-slate-400 group-hover:text-slate-500'}`}>
        {isTv ? <Tv size={24} strokeWidth={1.5} /> : <Monitor size={24} strokeWidth={1.5} />}
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <span className={`text-[16px] font-normal transition-colors duration-200 truncate ${isSelected ? 'text-slate-600' : 'text-slate-600 group-hover:text-slate-800'}`}>
          {monitor.label}
        </span>
        <span className="text-[14px] text-slate-600 font-light flex items-center gap-1.5 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis font-light">
          {assigned === null || assigned === undefined ? (
            <>
              <div className="relative w-[14px] font-light h-[14px] rounded-full border-[1.5px] border-slate-400 opacity-70 shrink-0">
                <div className="absolute top-1/2 left-0 w-full h-[1.5px] bg-slate-400 -rotate-45 -translate-y-1/2" />
              </div>
              No playlist selected
            </>
          ) : (
            <>
              <span className="text-[14px] shrink-0 opacity-90">{assigned.emoji || '🌱'}</span>
              <span className="truncate">{assigned.name}</span>
            </>
          )}
        </span>
      </div>
    </button>
  )
}

const PlaylistItem = ({
  playlist,
  isSelected,
  onClick,
  disabled
}: {
  playlist: Playlist,
  isSelected: boolean,
  onClick: () => void,
  disabled: boolean
}) => {
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
      onClick={onClick}
      disabled={disabled}
      className={`group flex flex-row items-center px-6 transition-all duration-300 ease-out cursor-pointer w-full bg-white rounded-[20px] border ${isSelected
        ? 'border-slate-200 shadow-[0_4px_16px_rgba(0,0,0,0.06)] py-6 scale-[1.01]'
        : 'border-slate-200 hover:border-slate-200 py-4 scale-100 opacity-80 hover:opacity-100'
        } ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'active:scale-[0.98]'}`}
    >
      <div className="mr-4 transition-transform duration-200 group-active:scale-90 shrink-0">
        {isSelected ? (
          <CheckCircle2 size={24} className="text-slate-700 fill-slate-700" color="white" strokeWidth={1} />
        ) : (
          <Circle size={24} className="text-slate-300 group-hover:text-slate-400" strokeWidth={1.5} />
        )}
      </div>
      <div className={`mr-3 text-[26px] transition-transform duration-200 shrink-0 ${isSelected ? 'scale-110' : ''}`}>
        {emoji}
      </div>
      <div className="flex flex-col items-start flex-1 overflow-hidden">
        <span className={`text-[16px] font-normal transition-colors duration-200 truncate w-full text-left ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
          {playlist.name}
        </span>
        <span className="text-[13px] text-slate-400 mt-0.5 font-normal transition-colors duration-200 truncate w-full text-left">
          {tabsCount} {tabsCount === 1 ? 'slide' : 'slides'} · {totalDuration}
        </span>
      </div>
    </button>
  )
}

export default function PlaylistPickerStep({ onNext, onBack }: PlaylistPickerStepProps) {
  const [monitors, setMonitors] = useState<MonitorInfo[]>([])
  const [selectedMonitorId, setSelectedMonitorId] = useState<number | null>(null)
  const [assignments, setAssignments] = useState<Record<number, Playlist | null>>({})

  const [updateReady, setUpdateReady] = useState(false)
  const deviceToken = useAuthStore((s) => s.deviceToken)
  const setMonitorAssignments = useAppStore((s) => s.setMonitorAssignments)
  const setSelectedPlaylist = useAppStore((s) => s.setSelectedPlaylist)
  const baseUrl = 'https://tabrevolver.variabl.co'

  useEffect(() => {
    window.electronAPI.invoke('get-monitors').then((res) => {
      setMonitors(res)
      if (res.length > 0) {
        const primary = res.find((m) => m.isPrimary) || res[0]
        setSelectedMonitorId(primary.id)
      }
    })
  }, [])

  const { data: playlists, isLoading, error, refetch } = useQuery<Playlist[]>({
    queryKey: ['playlists', deviceToken],
    queryFn: async () => {
      if (!deviceToken) return []
      try {
        const res = await window.electronAPI.invoke('fetch-playlists', baseUrl, deviceToken)
        return res
      } catch (err: any) {
        console.error('IPC fetch failed, attempting direct fetch fallback:', err)

        if (err.message && err.message.includes('401')) {
          const newToken = await useAuthStore.getState().refreshAuthToken()
          if (!newToken) {
            useAuthStore.getState().logout()
            onBack()
            throw new Error('Session expired. Please sign in again.')
          }
          // Retry the IPC fetch if token refreshed
          return await window.electronAPI.invoke('fetch-playlists', baseUrl, newToken)
        }

        try {
          // Fallback to direct fetch in case of developer process restarts not having registered IPC yet
          const response = await fetch(`${baseUrl}/api/playlists`, {
            headers: {
              'Authorization': `Bearer ${deviceToken}`
            }
          })
          if (!response.ok) {
            if (response.status === 401) {
              const newToken = await useAuthStore.getState().refreshAuthToken()
              if (!newToken) {
                useAuthStore.getState().logout()
                onBack()
                throw new Error('Session expired. Please sign in again.')
              }
              // Retry the fetch
              const retryResponse = await fetch(`${baseUrl}/api/playlists`, {
                headers: { 'Authorization': `Bearer ${newToken}` }
              })
              if (!retryResponse.ok) {
                throw new Error(`Failed to fetch playlists: ${retryResponse.status}`)
              }
              return retryResponse.json()
            }
            throw new Error(`Failed to fetch playlists: ${response.status}`)
          }
          return response.json()
        } catch (fetchErr: any) {
          if (fetchErr.message === 'Session expired. Please sign in again.') {
            throw fetchErr
          }
          throw err // throw the original IPC error if fetch fallback also fails (e.g. CORS)
        }
      }
    },
    enabled: !!deviceToken
  })

  // Auto-select the first playlist once they load for the primary monitor
  useEffect(() => {
    if (playlists && playlists.length > 0 && selectedMonitorId && assignments[selectedMonitorId] === undefined) {
      setAssignments((prev) => ({
        ...prev,
        [selectedMonitorId]: playlists[0]
      }))
    }
  }, [playlists, selectedMonitorId])

  useEffect(() => {
    const cleanup = window.electronAPI.on('update-downloaded', () => {
      setUpdateReady(true)
    })
    return cleanup
  }, [])

  const handleStartPlaying = () => {
    setMonitorAssignments(assignments)
    
    // Save assignments to localStorage for secondary windows to read
    try {
      localStorage.setItem('monitorAssignments', JSON.stringify(assignments))
    } catch (e) {
      console.error('Failed to save assignments to localStorage', e)
    }

    // Trigger main process to spawn any secondary player windows
    window.electronAPI.invoke('start-secondary-players', assignments).catch(err => {
      console.error('Failed to start secondary players:', err)
    })

    // Sync device and screen details to localStorage and Firebase
    syncDeviceAndScreens(monitors, assignments)

    // For backward compatibility with the single-playlist player
    const primaryMonitorId = monitors.find(m => m.isPrimary)?.id
    if (primaryMonitorId) {
      useAppStore.getState().setSelectedMonitorId(primaryMonitorId)
      if (assignments[primaryMonitorId]) {
        setSelectedPlaylist(assignments[primaryMonitorId])
        onNext()
      } else {
        useAppStore.getState().navigate('inactive')
      }
    } else {
      // Find the first assigned playlist
      const firstAssigned = Object.values(assignments).find(p => p !== null && p !== undefined)
      if (firstAssigned) {
        setSelectedPlaylist(firstAssigned)
        onNext()
      } else {
        useAppStore.getState().navigate('inactive')
      }
    }
  }

  // Check if there is at least one monitor with a playlist assigned
  const hasAnyAssignment = Object.values(assignments).some(p => p !== null && p !== undefined)

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

      {/* Header Area */}
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
            Choose a playlist to start displaying content instantly.
          </p>
        </div>
      </div>

      {/* Content Layout */}
      <div className="flex flex-row w-full max-w-[860px] flex-1 min-h-0 max-h-[55vh] mt-[2vw] mb-[2vw] justify-center  border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[40px] py-6 px-4 relative">

        {/* Left Column: CONNECTED DISPLAYS */}
        <div className="flex-1 flex flex-col pt-2 h-full pr-[5vw] lg:pr-[30px] relative">
          {/* Fading Divider Line */}
          <div
            className="absolute right-0 top-0 bottom-0 w-[1px] bg-slate-200"
            style={{
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)'
            }}
          />
          <div className="w-full flex flex-col overflow-y-auto hide-scrollbar flex-1 relative">
            <div className="flex flex-col min-h-full w-full">
              <div className="flex-1 min-h-[10vh] shrink-0" />

              <div className="flex flex-col gap-0.5 w-full">
                <h3 className="text-[12px] font-medium text-slate-600 mb-2 tracking-wide shrink-0 px-2">CONNECTED DISPLAYS</h3>
                {monitors.map((m, i) => (
                  <div
                    key={m.id}
                  >
                    <MonitorItem
                      monitor={m}
                      assigned={assignments[m.id]}
                      isSelected={selectedMonitorId === m.id}
                      onClick={() => setSelectedMonitorId(m.id)}
                    />
                  </div>
                ))}
                {monitors.length === 0 && (
                  <div className="text-sm text-slate-400 px-4 py-6 text-center border border-dashed border-slate-300 rounded-2xl">
                    No displays found
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-[10vh] shrink-0" />
            </div>
          </div>
        </div>

        {/* Right Column: Playlists */}
        <div
          className="flex-1 flex flex-col overflow-y-auto hide-scrollbar pl-[5vw] lg:pl-[30px] h-full relative"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)'
          }}
        >
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-[1vw] h-full">
              <Loader2 className="h-6 w-6 text-slate-300 animate-spin" />
              <p className="text-sm text-slate-400">Loading playlists...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center gap-[1vw] text-center h-full">
              <p className="text-sm text-red-500">{(error as Error).message}</p>
              <Button onClick={() => refetch()} variant="outline" className="rounded-full mt-2 h-10 text-sm">
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !error && (
            <div className="flex flex-col min-h-full w-full pr-4">
              <div className="flex-1 min-h-[5vh] shrink-0" />

              {/* Playlists */}
              <div className="flex flex-col gap-2 w-full">
                {playlists?.map((playlist, i) => (
                  <div
                    key={playlist.id}
                  >
                    <PlaylistItem
                      playlist={playlist}
                      isSelected={selectedMonitorId !== null && assignments[selectedMonitorId]?.id === playlist.id}
                      onClick={() => {
                        if (selectedMonitorId) {
                          setAssignments(prev => {
                            const isAlreadySelected = prev[selectedMonitorId]?.id === playlist.id;
                            return { ...prev, [selectedMonitorId]: isAlreadySelected ? null : playlist };
                          });
                        }
                      }}
                      disabled={!selectedMonitorId}
                    />
                  </div>
                ))}
              </div>

              <div className="flex-1 min-h-[5vh] shrink-0" />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="w-full flex flex-col justify-center items-center gap-[1vw]">
        <Button
          onClick={handleStartPlaying}
          disabled={!hasAnyAssignment}
          className={`rounded-xl px-[4vw] w-full max-w-[280px] 4k:max-w-[400px] h-[clamp(2.5rem,3.2vw,4.5rem)] text-[clamp(0.8rem,0.95vw,1.25rem)] font-medium transition-all duration-200 ease-out flex items-center justify-center gap-2 animate-cta-enter ${!hasAnyAssignment ? 'bg-slate-200 text-slate-400 cursor-not-allowed hover:scale-100 active:scale-100 hover:shadow-none pointer-events-none' : 'bg-[#2a2a2a] hover:bg-black text-white hover:scale-[1.02] active:scale-[0.97] hover:shadow-lg hover:shadow-black/5 cursor-pointer'}`}
        >
          Start playing
        </Button>
      </div>
    </div>
  )
}
