import { useEffect } from 'react'
import { PlaylistItem } from '../types'
import { motion, AnimatePresence } from 'framer-motion'
import { WebsiteScene } from './WebsiteScene.tsx'
import { ImageScene } from './ImageScene.tsx'
import { VideoScene } from './VideoScene.tsx'

interface SceneRendererProps {
  item: PlaylistItem
}

export function SceneRenderer({ item }: SceneRendererProps) {
  // Clean up native views when changing scenes
  useEffect(() => {
    return () => {
      if (item.type === 'website') {
        // We handle hide in the component cleanup, but good to ensure
      }
    }
  }, [item])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={item.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1, ease: 'easeInOut' }}
        className="absolute inset-0 w-full h-full"
      >
        {item.type === 'website' && <WebsiteScene url={item.url!} />}
        {item.type === 'image' && <ImageScene src={item.src!} />}
        {item.type === 'video' && <VideoScene src={item.src!} />}
      </motion.div>
    </AnimatePresence>
  )
}
