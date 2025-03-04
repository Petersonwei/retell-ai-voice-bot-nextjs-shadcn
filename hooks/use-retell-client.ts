import { useCallback, useEffect, useRef, useState } from 'react'
import { RetellWebClient } from 'retell-client-js-sdk'
import { retellConfig } from '@/lib/retell-config'

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

  // Initialize Retell client on hook mount
  useEffect(() => {
    clientRef.current = new RetellWebClient()
    console.log('[RetellClient] Client initialized')
    setIsInitialized(true)

    // Cleanup on unmount
    return () => {
      if (clientRef.current) {
        console.log('[RetellClient] Cleaning up client')
        clientRef.current.removeAllListeners()
        clientRef.current.stopCall()
      }
    }
  }, [])

  // Set up event listeners for the Retell client
  useEffect(() => {
    if (!clientRef.current || !isInitialized) return

    // Handle real-time updates from the call
    clientRef.current.on("update", (update: { 
      transcript?: { role: string; content: string }[];
      llmResponse?: string;
      response?: string | { content?: string; text?: string }
    }) => {
      console.log('[RetellClient] Received update:', update)
      
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
      onSentenceComplete()
    })

    // Handle errors during the call
    clientRef.current.on("error", (error) => {
      console.error('[RetellClient] Error:', error)
      onError(error.message || 'An error occurred')
    })

    // Handle call ending
    clientRef.current.on("call_ended", () => {
      console.log('[RetellClient] Call ended')
      onCallEnded()
    })

    // Cleanup event listeners
    return () => {
      if (clientRef.current) {
        clientRef.current.removeAllListeners()
      }
    }
  }, [isInitialized, onCallEnded, onError, onResponseUpdate, onSentenceComplete, onTranscriptUpdate])

  // Start a call
  const startCall = useCallback(async () => {
    if (!clientRef.current) return
    
    try {
      onLoading(true)
      
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
      
      onCallStarted()
    } catch (err) {
      console.error('[RetellClient] Error starting call:', err)
      onError(err instanceof Error ? err.message : 'Failed to start call')
      onLoading(false)
    }
  }, [onCallStarted, onError, onLoading])

  // End a call
  const endCall = useCallback(async () => {
    if (!clientRef.current) return
    
    try {
      await clientRef.current.stopCall()
      onCallEnded()
    } catch (err) {
      console.error('[RetellClient] Error ending call:', err)
      onError(err instanceof Error ? err.message : 'Failed to end call')
    }
  }, [onCallEnded, onError])

  return {
    startCall,
    endCall,
    isInitialized
  }
} 