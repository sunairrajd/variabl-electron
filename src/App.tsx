import { useEffect } from 'react'
import { useAppStore } from './stores/useAppStore'
import { useAuthStore } from './stores/useAuthStore'
import { Login } from './pages/Login'
import { Onboarding } from './pages/Onboarding'
import { Player } from './pages/Player'
import { AnimatePresence, motion } from 'framer-motion'

function App() {
  const { state, setState } = useAppStore()
  const { token } = useAuthStore()

  useEffect(() => {
    if (token && state === 'login') {
      setState('onboarding')
    } else if (!token) {
      setState('login')
    }
  }, [token, state, setState])

  return (
    <div className="w-screen h-screen bg-background text-text overflow-hidden relative">
      <AnimatePresence mode="wait">
        {state === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <Login />
          </motion.div>
        )}
        {state === 'onboarding' && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <Onboarding />
          </motion.div>
        )}
        {state === 'player' && (
          <motion.div
            key="player"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            <Player />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
