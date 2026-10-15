import { db } from '../lib/firebase'
import { doc, runTransaction } from 'firebase/firestore'
import { useAuthStore } from '../stores/useAuthStore'
import { getStoredScreenId } from './DeviceSyncService'

interface PendingActivityBatch {
  count: number
  playlistId: string | null
  displayId: string | null
  lastCompletedAt: number | null
}

const pendingBatch: PendingActivityBatch = {
  count: 0,
  playlistId: null,
  displayId: null,
  lastCompletedAt: null
}

let flushTimer: NodeJS.Timeout | null = null
const FLUSH_INTERVAL_MS = 5 * 60 * 1000 // Buffer rotations and send at most once every 5 minutes
const MAX_BATCH_SIZE = 50 // Or send immediately if 50 rotations accumulate

/**
 * Buffers a completed playlist rotation in memory.
 * Instead of firing a network request on every single rotation,
 * rotations are batched and flushed periodically to avoid flooding the server/Firestore.
 */
export function recordPlaylistRotation(playlistId: string, displayId: string | null): void {
  const now = Date.now()
  pendingBatch.count += 1
  pendingBatch.playlistId = playlistId
  pendingBatch.displayId = displayId
  pendingBatch.lastCompletedAt = now

  console.log(`[ActivityService] Buffered rotation (pending batch: ${pendingBatch.count})`)

  // Flush immediately if buffer reaches MAX_BATCH_SIZE
  if (pendingBatch.count >= MAX_BATCH_SIZE) {
    flushPendingRotations()
    return
  }

  // Otherwise, schedule flush after FLUSH_INTERVAL_MS if not already scheduled
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null
      flushPendingRotations()
    }, FLUSH_INTERVAL_MS)
  }
}

/**
 * Flushes all pending rotations to the backend and Firestore in a single atomic request.
 */
export async function flushPendingRotations(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }

  if (pendingBatch.count <= 0) return

  const countToFlush = pendingBatch.count
  const playlistId = pendingBatch.playlistId
  const displayId = pendingBatch.displayId
  const now = pendingBatch.lastCompletedAt || Date.now()

  // Reset batch counter immediately to avoid race conditions with incoming rotations
  pendingBatch.count = 0
  pendingBatch.lastCompletedAt = null

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
    const dateStr = new Date(now).toISOString().slice(0, 10) // UTC YYYY-MM-DD
    const eventId = `rot_${screenId || 'scr'}_${playlistId || 'ply'}_${now}_${Math.random().toString(36).substring(2, 9)}`

    const payload = {
      screenId,
      playlistId,
      eventId,
      count: countToFlush,
      timestamp: now,
      date: dateStr
    }

    let apiSucceeded = false

    // 1. Send batched update to backend API via IPC handler
    if (deviceToken) {
      try {
        const baseUrl = 'https://tabrevolver.variabl.co'
        await window.electronAPI.invoke('track-rotation', baseUrl, deviceToken, payload)
        apiSucceeded = true
        console.log(`[ActivityService] Flushed ${countToFlush} rotation(s) via backend API:`, { eventId, date: dateStr })
      } catch (apiErr: any) {
        console.warn('[ActivityService] Backend API recording failed (will attempt direct Firestore):', apiErr?.message || apiErr)
      }
    }

    // 2. Client-side Firestore transaction fallback if API was unavailable
    if (!apiSucceeded && userId) {
      try {
        const userRef = doc(db, 'users_variabl', userId)
        const dailyRef = doc(db, 'users_variabl', userId, 'user_daily_activity', dateStr)
        const eventRef = doc(db, 'users_variabl', userId, 'rotation_events', eventId)

        await runTransaction(db, async (transaction) => {
          const eventDoc = await transaction.get(eventRef)
          if (eventDoc.exists()) {
            return
          }

          const userDoc = await transaction.get(userRef)
          const dailyDoc = await transaction.get(dailyRef)

          const userData = userDoc.exists() ? userDoc.data() : null
          const dailyData = dailyDoc.exists() ? dailyDoc.data() : null

          const currentTotal = userData?.totalRotations || 0
          const hasFirstRotation = Boolean(userData?.firstRotationAt)
          const currentDailyRotations = dailyData?.rotations || 0

          // A. Record idempotent event with batch count
          transaction.set(eventRef, {
            eventId,
            screenId: screenId || null,
            playlistId: playlistId || null,
            count: countToFlush,
            createdAt: now,
            date: dateStr,
          })

          // B. Update user document stats
          const userUpdates: Record<string, any> = {
            totalRotations: currentTotal + countToFlush,
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
            rotations: currentDailyRotations + countToFlush,
            lastActiveAt: now,
          }, { merge: true })
        })

        console.log(`[ActivityService] Flushed ${countToFlush} rotation(s) via direct Firestore transaction:`, { eventId, date: dateStr })
      } catch (fsErr: any) {
        console.warn('[ActivityService] Direct Firestore transaction failed:', fsErr?.message || fsErr)
      }
    }
  } catch (err) {
    console.error('[ActivityService] Failed to flush rotation activity:', err)
  }
}

// Ensure any buffered rotations are flushed before window unloads
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (pendingBatch.count > 0) {
      flushPendingRotations().catch(console.error)
    }
  })
}
