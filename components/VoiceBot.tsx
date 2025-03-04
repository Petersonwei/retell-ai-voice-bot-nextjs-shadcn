'use client' // Marks this as a client-side component in Next.js

// Import necessary hooks, components and types
import { useCallback, useEffect, useRef, useState } from 'react'
import { RetellWebClient } from "retell-client-js-sdk"
import { v4 as uuidv4 } from 'uuid'
import { retellConfig } from '@/lib/retell-config'
import '../types/retell-client'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Phone, PhoneOff } from "lucide-react"

// Interface for chat messages between user and assistant
interface Message {
  id: string
  type: 'response' | 'transcription' // Whether it's a direct response or transcribed speech
  role?: string // 'user' or 'assistant'
  content: string
  timestamp: Date
  isComplete?: boolean // Whether the message is complete
}

// Main state interface for the VoiceBot component
interface VoiceBotState {
  isCallActive: boolean // Whether a call is currently in progress
  isLoading: boolean // Loading state for API calls
  error: string | null // Error message if something goes wrong
  callStatus: 'idle' | 'ongoing' | 'ended' | 'error' // Current status of the call
  messages: Message[] // Array of chat messages
}

export default function VoiceBot() {
  const { toast } = useToast()
  const clientRef = useRef<RetellWebClient | null>(null) // Ref to store Retell client instance
  const [state, setState] = useState<VoiceBotState>({
    isCallActive: false,
    isLoading: false,
    error: null,
    callStatus: 'idle',
    messages: []
  })

  // Initialize Retell client on component mount
  useEffect(() => {
    clientRef.current = new RetellWebClient()
    console.log('[VoiceBot] Client initialized')

    // Cleanup on unmount
    return () => {
      if (clientRef.current) {
        console.log('[VoiceBot] Cleaning up client')
        clientRef.current.removeAllListeners()
        clientRef.current.stopCall()
      }
    }
  }, [])

  // Helper function to update state partially
  const updateState = useCallback((update: Partial<VoiceBotState>) => {
    setState(prev => ({ ...prev, ...update }))
  }, [])

  // Handler to start a new call
  const startCall = useCallback(async () => {
    if (!clientRef.current) return
    
    try {
      updateState({ isLoading: true, error: null })
      
      // Create a new call via API
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
      
      // Initialize call with Retell client
      await clientRef.current.startCall({ 
        accessToken: access_token,
        sampleRate: 24000,
        captureDeviceId: 'default',
        emitRawAudioSamples: false
      })
      
      updateState({ 
        isCallActive: true, 
        isLoading: false,
        callStatus: 'ongoing' 
      })
    } catch (err) {
      console.error('[VoiceBot] Error starting call:', err)
      updateState({
        error: err instanceof Error ? err.message : 'Failed to start call',
        isLoading: false,
        callStatus: 'error'
      })
    }
  }, [updateState])

  // Handler to end an active call
  const endCall = useCallback(async () => {
    if (!clientRef.current) return
    
    try {
      await clientRef.current.stopCall()
      updateState({ 
        isCallActive: false,
        callStatus: 'ended'
      })
    } catch (err) {
      console.error('[VoiceBot] Error ending call:', err)
      updateState({
        error: err instanceof Error ? err.message : 'Failed to end call',
        callStatus: 'error'
      })
    }
  }, [updateState])

  // Set up event listeners for the Retell client
  useEffect(() => {
    if (!clientRef.current) return

    // Handle real-time updates from the call
    clientRef.current.on("update", (update: { 
      transcript?: { role: string; content: string }[];
      llmResponse?: string;
      response?: string | { content?: string; text?: string }
    }) => {
      console.log('[VoiceBot] Received update:', update)
      
      // Handle new speech transcriptions
      if (update.transcript && Array.isArray(update.transcript)) {
        const latestTranscript = update.transcript[update.transcript.length - 1]
        if (!latestTranscript) return

        const role = latestTranscript.role.toLowerCase() === 'agent' ? 'assistant' : 'user'
        const content = latestTranscript.content.trim()

        if (!content) return

        setState(prev => {
          // Find the last message from the same role that isn't complete
          const lastIncompleteMessageIndex = [...prev.messages].reverse()
            .findIndex(m => m.role === role && !m.isComplete)
          
          if (lastIncompleteMessageIndex === -1) {
            // No incomplete message found, create new one
            return {
              ...prev,
              messages: [...prev.messages, {
                id: uuidv4(),
                type: 'transcription',
                role: role,
                content: content,
                timestamp: new Date(),
                isComplete: false
              }]
            }
          } else {
            // Update the existing incomplete message
            const actualIndex = prev.messages.length - 1 - lastIncompleteMessageIndex
            const updatedMessages = [...prev.messages]
            updatedMessages[actualIndex] = {
              ...updatedMessages[actualIndex],
              content: content
            }
            return {
              ...prev,
              messages: updatedMessages
            }
          }
        })
      }

      // Handle bot responses - mark them as complete immediately
      if (update.response) {
        const responseContent = typeof update.response === 'object'
          ? update.response.content || update.response.text || JSON.stringify(update.response)
          : update.response

        setState(prev => ({
          ...prev,
          messages: [...prev.messages, {
            id: uuidv4(),
            type: 'response',
            role: 'assistant',
            content: responseContent,
            timestamp: new Date(),
            isComplete: true
          }]
        }))
      }
    })

    // When a sentence is complete, mark the last incomplete message as complete
    clientRef.current.on("sentence_complete", () => {
      setState(prev => {
        const lastIncompleteMessageIndex = prev.messages.findIndex(m => !m.isComplete)
        if (lastIncompleteMessageIndex === -1) return prev

        const updatedMessages = [...prev.messages]
        updatedMessages[lastIncompleteMessageIndex] = {
          ...updatedMessages[lastIncompleteMessageIndex],
          isComplete: true
        }
        return {
          ...prev,
          messages: updatedMessages
        }
      })
    })

    // Handle errors during the call
    clientRef.current.on("error", (error) => {
      console.error('[VoiceBot] Error:', error)
      updateState({ 
        error: error.message || 'An error occurred',
        callStatus: 'error'
      })
      toast({
        title: "Call Error",
        description: error.message || 'An error occurred',
        variant: "destructive"
      })
    })

    // Handle call ending
    clientRef.current.on("call_ended", () => {
      console.log('[VoiceBot] Call ended')
      updateState({ 
        isCallActive: false,
        callStatus: 'ended'
      })
    })

    // Cleanup event listeners
    return () => {
      if (clientRef.current) {
        clientRef.current.removeAllListeners()
      }
    }
  }, [updateState, toast])

  // Render UI
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        {/* Call control button and status */}
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={state.isCallActive ? endCall : startCall}
            disabled={state.isLoading}
            variant={state.isCallActive ? "destructive" : "default"}
          >
            {state.isLoading ? (
              <span>Initializing...</span>
            ) : state.isCallActive ? (
              <>
                <PhoneOff className="mr-2 h-4 w-4" />
                End Call
              </>
            ) : (
              <>
                <Phone className="mr-2 h-4 w-4" />
                Start Call
              </>
            )}
          </Button>
          
          <span className="text-sm text-muted-foreground">
            Status: {state.callStatus}
          </span>
        </div>

        {/* Error display */}
        {state.error && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-md">
            {state.error}
          </div>
        )}

        {/* Chat message display */}
        <ScrollArea className="h-[500px] rounded-md border p-4">
          <div className="space-y-4">
            {state.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <Card className={`max-w-[80%] ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  <CardContent className="p-3">
                    <p className="text-sm opacity-70">
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </p>
                    <p className="mt-1">{message.content}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}