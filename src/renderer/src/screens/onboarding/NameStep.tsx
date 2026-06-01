import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'

interface NameStepProps {
  onNext: () => void
  onBack: () => void
}

export default function NameStep({ onNext, onBack }: NameStepProps) {
  const [name, setName] = useState('')
  const setScreenData = useAuthStore((s) => s.setScreenData)

  const handleContinue = () => {
    if (!name.trim()) return
    const displayId = crypto.randomUUID()
    setScreenData(name.trim(), displayId)
    onNext()
  }

  return (
    <div className="flex flex-col justify-between items-center w-full h-full p-12 opacity-0 animate-screen-enter">
      {/* Pinned Header */}
      <div className="w-full flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 transition-all duration-200 ease-out active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div className="h-10 w-10" />
      </div>

      {/* Centered Content */}
      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-md">
        <h1 className="text-3xl font-medium text-slate-800 mb-2">Give your screen a name</h1>
        <p className="text-sm text-slate-400 mb-12">choose a playlist to start displaying content instantly.</p>
        
        <div className="flex items-center w-full bg-white/50 border border-slate-200/60 rounded-xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-slate-200 transition-all">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-200 via-emerald-100 to-amber-100 ml-2 shadow-inner" />
          <div className="w-3 h-3 text-slate-400 ml-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>
          <input 
            type="text" 
            placeholder="Screen name" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleContinue()
            }}
            className="flex-1 bg-transparent border-none outline-none px-4 text-center text-slate-700 placeholder:text-slate-300 text-sm"
          />
        </div>
      </div>

      {/* Pinned Footer */}
      <div className="w-full flex justify-center mb-8">
        <Button 
          onClick={handleContinue}
          disabled={!name.trim()}
          className="rounded-full bg-[#2a2a2a] hover:bg-black text-white px-10 h-10 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
