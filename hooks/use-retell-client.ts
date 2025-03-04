import { useCallback, useEffect, useRef, useState } from 'react'
import { RetellWebClient } from 'retell-client-js-sdk'
import { retellConfig } from '@/lib/retell-config'

// Constants for call management
const MIN_CALL_DURATION_MS = 10000 // Minimum call duration (10 seconds) to prevent accidental endings
const INACTIVITY_TIMEOUT_MS = 300000 // Inactivity timeout (5 minutes)
const DEBOUNCE_TIME_MS = 500 // Debounce time for client operations

interface RetellClientOptions {
  onCallStarted: () => void
  onCallEnded: () => void
  onError: (error: string) => void
  onLoading: (isLoading: boolean) => void
  onTranscriptUpdate: (role: string, content: string) => void
  onResponseUpdate: (content: string) => void
  onSentenceComplete: () => void
}

export function useRetellClient({
  onCallStarted,
  onCallEnded,
  onError,
  onLoading,
  onTranscriptUpdate,
  onResponseUpdate,
  onSentenceComplete
}: RetellClientOptions) {
  const clientRef = useRef<RetellWebClient | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const callStartTimeRef = useRef<number | null>(null)
  const lastActivityTimeRef = useRef<number | null>(null)
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isEndingCallRef = useRef<boolean>(false)
  const isStartingCallRef = useRef<boolean>(false)
  const operationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup function to ensure proper resource release
  const cleanupClient = useCallback(() => {
    console.log('[RetellClient] Running cleanup')
    
    // Clear any pending operation timeouts
    if (operationTimeoutRef.current) {
      clearTimeout(operationTimeoutRef.current)
      operationTimeoutRef.current = null
    }
    
    // Clear any inactivity timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
    
    // Clean up the client if it exists
    if (clientRef.current) {
      console.log('[RetellClient] Removing listeners and stopping call')
      
      try {
        // Remove all event listeners first
        clientRef.current.removeAllListeners()
        
        // Then try to stop the call if one is active
        if (callStartTimeRef.current) {
          clientRef.current.stopCall()
        }
      } catch (err) {
        console.error('[RetellClient] Error during cleanup:', err)
      } finally {
        // Always null out the client reference
        clientRef.current = null
      }
    }
    
    // Reset all state
    callStartTimeRef.current = null
    lastActivityTimeRef.current = null
    isEndingCallRef.current = false
    isStartingCallRef.current = false
  }, [])

  // Initialize Retell client
  const initializeClient = useCallback(() => {
    // Clean up any existing client first
    cleanupClient()
    
    // Create a new client
    console.log('[RetellClient] Initializing new client')
    clientRef.current = new RetellWebClient()
    setIsInitialized(true)
  }, [cleanupClient])

  // Initialize on mount
  useEffect(() => {
    initializeClient()
    
    // Cleanup on unmount
    return () => {
      cleanupClient()
    }
  }, [initializeClient, cleanupClient])

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    lastActivityTimeRef.current = Date.now()
    
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }
    
    // Set new timer
    inactivityTimerRef.current = setTimeout(() => {
      console.log('[RetellClient] Inactivity timeout reached')
      // Only end call if it's been active for longer than the minimum duration
      if (callStartTimeRef.current && Date.now() - callStartTimeRef.current > MIN_CALL_DURATION_MS) {
        endCall()
      }
    }, INACTIVITY_TIMEOUT_MS)
  }, [])

  // Set up event listeners for the Retell client
  useEffect(() => {
    if (!clientRef.current || !isInitialized) return
    
    console.log('[RetellClient] Setting up event listeners')

    // Handle real-time updates from the call
    clientRef.current.on("update", (update: { 
      transcript?: { role: string; content: string }[];
      llmResponse?: string;
      response?: string | { content?: string; text?: string }
    }) => {
      console.log('[RetellClient] Received update:', update)
      resetInactivityTimer()
      
      // Handle new speech transcriptions
      if (update.transcript && Array.isArray(update.transcript)) {
        const latestTranscript = update.transcript[update.transcript.length - 1]
        if (!latestTranscript) return

        const role = latestTranscript.role.toLowerCase() === 'agent' ? 'assistant' : 'user'
        const content = latestTranscript.content.trim()

        if (!content) return

        onTranscriptUpdate(role, content)
      }

      // Handle bot responses - mark them as complete immediately
      if (update.response) {
        const responseContent = typeof update.response === 'object'
          ? update.response.content || update.response.text || JSON.stringify(update.response)
          : update.response

        onResponseUpdate(responseContent)
      }
    })

    // When a sentence is complete, mark the last incomplete message as complete
    clientRef.current.on("sentence_complete", () => {
      resetInactivityTimer()
      onSentenceComplete()
    })

    // Handle errors during the call
    clientRef.current.on("error", (error) => {
      console.error('[RetellClient] Error:', error)
      onError(error.message || 'An error occurred')
      
      // Reset flags
      isStartingCallRef.current = false
      isEndingCallRef.current = false
    })

    // Handle call ending
    clientRef.current.on("call_ended", () => {
      console.log('[RetellClient] Call ended event received')
      
      // Reset flags
      isStartingCallRef.current = false
      isEndingCallRef.current = false
      
      // Clean up resources
      cleanupClient()
      
      // Notify the parent component
      onCallEnded()
    })

    // Cleanup event listeners on unmount or when dependencies change
    return () => {
      if (clientRef.current) {
        console.log('[RetellClient] Removing event listeners')
        clientRef.current.removeAllListeners()
      }
    }
  }, [isInitialized, onCallEnded, onError, onResponseUpdate, onSentenceComplete, onTranscriptUpdate, resetInactivityTimer, cleanupClient])

  // Start a call with debouncing to prevent multiple simultaneous calls
  const startCall = useCallback(async () => {
    // Prevent multiple simultaneous call starts
    if (isStartingCallRef.current || isEndingCallRef.current) {
      console.log('[RetellClient] Call operation already in progress, ignoring start request')
      return
    }
    
    // Set starting flag
    isStartingCallRef.current = true
    
    // Clear any pending operation timeouts
    if (operationTimeoutRef.current) {
      clearTimeout(operationTimeoutRef.current)
    }
    
    // Debounce the operation
    operationTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('[RetellClient] Starting call')
        onLoading(true)
        
        // Initialize a fresh client
        initializeClient()
        
        if (!clientRef.current) {
          throw new Error('Client initialization failed')
        }
        
        const response = await fetch('/api/retell/create-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: retellConfig.agentId,
            apiKey: retellConfig.apiKey
          }),
        })

        if (!response.ok) throw new Error('Failed to create call')
        
        const { access_token } = await response.json()
        
        await clientRef.current.startCall({ 
          accessToken: access_token,
          sampleRate: 24000,
          captureDeviceId: 'default',
          emitRawAudioSamples: false
        })
        
        // Record call start time and reset activity timer
        callStartTimeRef.current = Date.now()
        resetInactivityTimer()
        
        onCallStarted()
      } catch (err) {
        console.error('[RetellClient] Error starting call:', err)
        onError(err instanceof Error ? err.message : 'Failed to start call')
        onLoading(false)
        cleanupClient()
      } finally {
        isStartingCallRef.current = false
      }
    }, DEBOUNCE_TIME_MS)
  }, [onCallStarted, onError, onLoading, resetInactivityTimer, cleanupClient, initializeClient])

  // End a call with debouncing to prevent multiple simultaneous calls
  const endCall = useCallback(async () => {
    // Prevent multiple simultaneous call endings
    if (isEndingCallRef.current || isStartingCallRef.current) {
      console.log('[RetellClient] Call operation already in progress, ignoring end request')
      return
    }
    
    // Check if call has been active for minimum duration
    if (callStartTimeRef.current && Date.now() - callStartTimeRef.current < MIN_CALL_DURATION_MS) {
      console.log('[RetellClient] Call too short, not ending yet')
      return
    }
    
    // Set ending flag
    isEndingCallRef.current = true
    
    // Clear any pending operation timeouts
    if (operationTimeoutRef.current) {
      clearTimeout(operationTimeoutRef.current)
    }
    
    // Debounce the operation
    operationTimeoutRef.current = setTimeout(async () => {
      if (!clientRef.current) {
        isEndingCallRef.current = false
        return
      }
      
      try {
        console.log('[RetellClient] Ending call')
        await clientRef.current.stopCall()
        // onCallEnded will be triggered by the call_ended event
      } catch (err) {
        console.error('[RetellClient] Error ending call:', err)
        onError(err instanceof Error ? err.message : 'Failed to end call')
        cleanupClient()
        onCallEnded()
      }
    }, DEBOUNCE_TIME_MS)
  }, [onCallEnded, onError, cleanupClient])

  return {
    startCall,
    endCall,
    isInitialized
  }
} 