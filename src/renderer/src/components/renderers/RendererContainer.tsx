import { PlaylistTab } from '@/stores/useAppStore'
import YouTubeRenderer from './YouTubeRenderer'
import ImageRenderer from './ImageRenderer'
import MessageRenderer from './MessageRenderer'
import GSheetRenderer from './GSheetRenderer'

interface RendererProps {
  tab: PlaylistTab | null
  isActive: boolean
  isPaused?: boolean
  onFinish?: () => void
  onReady: () => void
  onFail: () => void
}

export default function RendererContainer({ tab, isActive, isPaused, onFinish, onReady, onFail }: RendererProps) {
  if (!tab) return null

  const isYouTube = tab.type === 'youtube' || tab.faviconURL?.includes('youtube.com') || tab.url?.includes('youtube.com') || tab.url?.includes('youtu.be')
  const isImage = tab.type === 'image'
  const isMessage = tab.type === 'message' || tab.type === 'announcement'
  const isGSheet = tab.type === 'gsheet'

  if (isYouTube) {
    return <YouTubeRenderer tab={tab} isActive={isActive} isPaused={isPaused} onFinish={onFinish} onReady={onReady} onFail={onFail} />
  }

  if (isImage) {
    return <ImageRenderer tab={tab} isActive={isActive} onReady={onReady} onFail={onFail} />
  }

  if (isMessage) {
    return <MessageRenderer tab={tab} isActive={isActive} onReady={onReady} onFail={onFail} />
  }

  if (isGSheet) {
    return <GSheetRenderer tab={tab} isActive={isActive} onReady={onReady} onFail={onFail} />
  }

  return null
}
