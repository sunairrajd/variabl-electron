interface ImageSceneProps {
  src: string
}

export function ImageScene({ src }: ImageSceneProps) {
  return (
    <div 
      className="w-full h-full bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${src})` }}
    />
  )
}
