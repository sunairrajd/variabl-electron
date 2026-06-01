import { PlaylistTab } from '@/stores/useAppStore'
import { useEffect, useRef } from 'react'

interface Props {
  tab: PlaylistTab
  isActive: boolean
  onReady: () => void
  onFail: () => void
}

export default function MessageRenderer({ tab, isActive, onReady }: Props) {
  const onReadyRef = useRef(onReady)

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    onReadyRef.current()
  }, [])

  const text = (tab as any).message || tab.title || ''
  const backgroundColor = tab.backgroundColor || '#000000'
  const fontColor = tab.fontColor || '#ffffff'
  
  // Calculate scaled down factor based on text length to auto-adjust size dynamically relative to container size
  const textLength = text.length || 1;
  const scaleFactor = Math.max(0.06, 0.12 - Math.max(0, textLength - 15) * 0.0006);

  return (
    <div 
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
      style={{
        backgroundColor,
        color: fontColor,
        containerType: 'size',
        lineHeight: '1.3',
        wordBreak: 'break-word',
      }}
    >
      <div
        className="font-medium max-w-full break-words px-8 leading-snug whitespace-pre-wrap text-center"
        style={{
          fontSize: `calc(min(100cqw, 100cqh) * ${scaleFactor})`,
        }}
      >
        {text}
      </div>
    </div>
  )
}
