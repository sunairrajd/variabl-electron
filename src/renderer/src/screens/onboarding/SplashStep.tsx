import { useEffect, useState } from 'react'
import tabRevolverLogo from '../../assets/tabrevolver.svg'
import variablLogo from '../../assets/variabl.svg'
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react'

interface SplashStepProps {
  onNext: () => void
}

export default function SplashStep({ onNext }: SplashStepProps) {
  const [mounted, setMounted] = useState(false)
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    // Give the WebGL shaders a moment to compile before fading in
    const fadeTimer = setTimeout(() => {
      setMounted(true)
    }, 800)

    // Automatically transition after a short delay
    const timer = setTimeout(onNext, 8000)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(timer)
    }
  }, [onNext])

  useEffect(() => {
    window.electronAPI.invoke('get-app-version').then((v: string) => {
      setVersion(v)
    }).catch(console.error)
  }, [])

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
      <div className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-[2000ms] ease-in-out ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <ShaderGradientCanvas style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <ShaderGradient
            animate="on"
            axesHelper="off"
            bgColor1="#000000"
            bgColor2="#000000"
            brightness={1.5}
            cAzimuthAngle={180}
            cDistance={3.6}
            cPolarAngle={90}
            cameraZoom={1}
            color1="#DAFA51"
            color2="#7dd6db"
            color3="#e0fa94"
            destination="onCanvas"
            embedMode="off"
            envPreset="city"
            format="gif"
            fov={45}
            frameRate={10}
            gizmoHelper="hide"
            grain="off"
            lightType="3d"
            pixelDensity={1}
            positionX={-1.4}
            positionY={0}
            positionZ={0}
            range="disabled"
            rangeEnd={40}
            rangeStart={0}
            reflection={0.1}
            rotationX={0}
            rotationY={10}
            rotationZ={50}
            shader="defaults"
            type="plane"
            uAmplitude={1}
            uDensity={1.3}
            uFrequency={5.5}
            uSpeed={0.5}
            uStrength={4}
            uTime={0}
            wireframe={false}
          />
        </ShaderGradientCanvas>
      </div>

      <div className="relative z-10 flex items-center gap-[6vw]">
        <img src={variablLogo} alt="Variabl" className="h-[clamp(1.25rem,1.8vw,4.5rem)] w-auto object-contain opacity-0 animate-reveal [animation-delay:800ms]" />
        <img src={tabRevolverLogo} alt="Tab Revolver" className="h-[clamp(1.25rem,1.8vw,4.5rem)] w-auto object-contain opacity-0 animate-reveal [animation-delay:800ms]" />
      </div>
      
      {version && (
        <div className="absolute bottom-[3vw] left-0 right-0 flex justify-center z-10">
          <div className="opacity-0 animate-reveal [animation-delay:1000ms] text-slate-400 font-mono text-[clamp(0.6rem,0.8vw,1rem)] tracking-widest uppercase">
            v{version}
          </div>
        </div>
      )}
    </div>
  )
}
