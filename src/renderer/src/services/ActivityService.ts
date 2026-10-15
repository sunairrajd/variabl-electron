import { db } from '../lib/firebase'
import { doc, runTransaction } from 'firebase/firestore'
import { useAuthStore } from '../stores/useAuthStore'
import { getStoredScreenId } from './DeviceSyncService'

export async function recordPlaylistRotation(playlistId: string, displayId: string | null): Promise<void> {
  try {
    const authStore = useAuthStore.getState()
    const deviceToken = authStore.deviceToken
    let userId: string | null = authStore.firebaseUser?.uid || null

    if (!userId && deviceToken) {
      try {
        const payload = JSON.parse(atob(deviceToken.split('.')[1]))
        userId = payload.uid || payload.user_id || null
      } catch (e) {
        console.warn('[ActivityService] Could not decode token for userId')
      }
    }


    if (!userId && !deviceToken) {
      console.warn('[ActivityService] No userId or deviceToken available; skipping rotation record.')
      return
    }

    const screenId = displayId ? getStoredScreenId(displayId) : null
    const now = Date.now()
    const dateStr = new Date(now).toISOString().slice(0, 10) // UTC YYYY-MM-DD
    const eventId = `rot_${screenId || 'scr'}_${playlistId || 'ply'}_${now}_${Math.random().toString(36).substring(2, 9)}`

    const payload = {
      screenId,
      playlistId,
      eventId,
      timestamp: now,
      date: dateStr
    }

    let apiSucceeded = false

    // 1. Send to backend API via IPC handler
    if (deviceToken) {
      try {
        const baseUrl = 'https://tabrevolver.variabl.co'
        await window.electronAPI.invoke('track-rotation', baseUrl, deviceToken, payload)
        apiSucceeded = true
        console.log('[ActivityService] Successfully recorded rotation via backend API:', { eventId, date: dateStr })
      } catch (apiErr: any) {
        console.warn('[ActivityService] Backend API recording failed (will attempt direct Firestore):', apiErr?.message || apiErr)
      }
    }

    // 2. Client-side Firestore transaction fallback if API was unavailable or not deployed yet
    if (!apiSucceeded && userId) {
      try {
        const userRef = doc(db, 'users_variabl', userId)
        const dailyRef = doc(db, 'users_variabl', userId, 'user_daily_activity', dateStr)
        const eventRef = doc(db, 'users_variabl', userId, 'rotation_events', eventId)

        await runTransaction(db, async (transaction) => {
          const eventDoc = await transaction.get(eventRef)
          if (eventDoc.exists()) {
            // Idempotent: already processed
            return
          }

          const userDoc = await transaction.get(userRef)
          const dailyDoc = await transaction.get(dailyRef)

          const userData = userDoc.exists() ? userDoc.data() : null
          const dailyData = dailyDoc.exists() ? dailyDoc.data() : null

          const currentTotal = userData?.totalRotations || 0
          const hasFirstRotation = Boolean(userData?.firstRotationAt)
          const currentDailyRotations = dailyData?.rotations || 0

          // A. Record idempotent event
          transaction.set(eventRef, {
            eventId,
            screenId: screenId || null,
            playlistId: playlistId || null,
            createdAt: now,
            date: dateStr,
          })

          // B. Update user document stats
          const userUpdates: Record<string, any> = {
            totalRotations: currentTotal + 1,
            lastRotationAt: now,
            updatedAt: now,
          }
          if (!hasFirstRotation) {
            userUpdates.firstRotationAt = now
          }
          transaction.set(userRef, userUpdates, { merge: true })

          // C. Update daily activity subcollection
          transaction.set(dailyRef, {
            date: dateStr,
            rotations: currentDailyRotations + 1,
            lastActiveAt: now,
          }, { merge: true })
        })

        console.log('[ActivityService] Successfully recorded rotation via direct Firestore transaction:', { eventId, date: dateStr })
      } catch (fsErr: any) {
        console.warn('[ActivityService] Direct Firestore transaction failed:', fsErr?.message || fsErr)
      }
    }
  } catch (err) {
    console.error('[ActivityService] Failed to record playlist rotation:', err)
  }
}
