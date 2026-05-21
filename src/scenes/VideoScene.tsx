interface VideoSceneProps {
  src: string
}

export function VideoScene({ src }: VideoSceneProps) {
  return (
    <video
      className="w-full h-full object-cover"
      src={src}
      autoPlay
      muted
      loop
      playsInline
    />
  )
}
