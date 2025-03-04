'use client' // Marks this as a client-side component in Next.js

// Import necessary hooks, components and types
import { useCallback, useEffect, useRef, useState } from 'react'
import { RetellWebClient } from "retell-client-js-sdk"
import { v4 as uuidv4 } from 'uuid'
import { retellConfig } from '@/lib/retell-config'
import '../types/retell-client'
import '../types/speech-recognition'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react"

// Interface for chat messages between user and assistant
interface Message {
  id: string
  type: 'response' | 'transcription' | 'system' // Added system type for wake word notifications
  role?: string
  content: string
  timestamp: Date
  isComplete?: boolean
}

// Main state interface for the VoiceBot component
interface VoiceBotState {
  isCallActive: boolean
  isLoading: boolean
  error: string | null
  callStatus: 'idle' | 'ongoing' | 'ended' | 'error'
  messages: Message[]
  isListeningForWakeWord: boolean
  liveTranscript: string
  liveTranscriptRole: string | null
}

const WAKE_WORD = 'hey assistant' // You can change this to any wake word you prefer

export default function VoiceBot() {
  const { toast } = useToast()
  const clientRef = useRef<RetellWebClient | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  
  const [state, setState] = useState<VoiceBotState>({
    isCallActive: false,
    isLoading: false,
    error: null,
    callStatus: 'idle',
    messages: [],
    isListeningForWakeWord: false,
    liveTranscript: '',
    liveTranscriptRole: null
  })

  // Initialize wake word detection
  const initializeWakeWordDetection = useCallback(() => {
    if (!('webkitSpeechRecognition' in window)) {
      toast({
        title: "Error",
        description: "Speech recognition is not supported in your browser.",
        variant: "destructive"
      })
      return
    }

    // Use type assertion to handle the SpeechRecognition constructor
    const SpeechRecognition = (window.webkitSpeechRecognition || window.SpeechRecognition) as SpeechRecognitionConstructor
    const recognition = new SpeechRecognition()
    
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript.toLowerCase())
        .join(' ')

      if (transcript.includes(WAKE_WORD)) {
        stopWakeWordDetection()
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, {
            id: uuidv4(),
            type: 'system',
            content: 'Wake word detected! Starting conversation...',
            timestamp: new Date(),
            isComplete: true
          }]
        }))
        startCall()
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[Wake Word Detection] Error:', event.error)
      toast({
        title: "Wake Word Detection Error",
        description: event.error,
        variant: "destructive"
      })
    }

    recognitionRef.current = recognition
  }, [toast])

  // Start wake word detection
  const startWakeWordDetection = useCallback(() => {
    if (!recognitionRef.current) {
      initializeWakeWordDetection()
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.start()
      setState(prev => ({ 
        ...prev, 
        isListeningForWakeWord: true,
        messages: [...prev.messages, {
          id: uuidv4(),
          type: 'system',
          content: `Listening for wake word: "${WAKE_WORD}"`,
          timestamp: new Date(),
          isComplete: true
        }]
      }))
    }
  }, [initializeWakeWordDetection])

  // Stop wake word detection
  const stopWakeWordDetection = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setState(prev => ({ ...prev, isListeningForWakeWord: false }))
    }
  }, [])

  // Initialize Retell client on component mount
  useEffect(() => {
    clientRef.current = new RetellWebClient()
    console.log('[VoiceBot] Client initialized')
    
    // Start listening for wake word by default
    startWakeWordDetection()

    // Cleanup on unmount
    return () => {
      if (clientRef.current) {
        console.log('[VoiceBot] Cleaning up client')
        clientRef.current.removeAllListeners()
        clientRef.current.stopCall()
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [startWakeWordDetection])

  // Helper function to update state partially
  const updateState = useCallback((update: Partial<VoiceBotState>) => {
    setState(prev => ({ ...prev, ...update }))
  }, [])

  // Modified startCall to work with wake word system
  const startCall = useCallback(async () => {
    if (!clientRef.current) return
    
    try {
      updateState({ isLoading: true, error: null })
      
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
      // If call fails, go back to wake word detection
      startWakeWordDetection()
    }
  }, [updateState])

  // Modified endCall to restart wake word detection
  const endCall = useCallback(async () => {
    if (!clientRef.current) return
    
    try {
      await clientRef.current.stopCall()
      updateState({ 
        isCallActive: false,
        callStatus: 'ended'
      })
      // After call ends, go back to wake word detection
      startWakeWordDetection()
    } catch (err) {
      console.error('[VoiceBot] Error ending call:', err)
      updateState({
        error: err instanceof Error ? err.message : 'Failed to end call',
        callStatus: 'error'
      })
    }
  }, [updateState, startWakeWordDetection])

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

  // Modified UI to show wake word detection status
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        {/* Control buttons and status */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <Button
              onClick={state.isListeningForWakeWord ? stopWakeWordDetection : startWakeWordDetection}
              disabled={state.isCallActive}
              variant="outline"
            >
              {state.isListeningForWakeWord ? (
                <>
                  <MicOff className="mr-2 h-4 w-4" />
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  Listen for Wake Word
                </>
              )}
            </Button>
            
            <Button
              onClick={state.isCallActive ? endCall : startCall}
              disabled={state.isLoading || state.isListeningForWakeWord}
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
          </div>
          
          <span className="text-sm text-muted-foreground">
            Status: {state.isListeningForWakeWord ? 'Listening for wake word' : state.callStatus}
          </span>
        </div>

        {/* Error display */}
        {state.error && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-md">
            {state.error}
          </div>
        )}

        {/* Live transcript display */}
        {state.liveTranscript && (
          <div className="mb-4">
            <Card className={`max-w-[80%] ${
              state.liveTranscriptRole === 'user' 
                ? 'bg-primary text-primary-foreground ml-auto' 
                : 'bg-muted'
            }`}>
              <CardContent className="p-3">
                <p className="text-sm opacity-70">
                  {state.liveTranscriptRole === 'user' ? 'You' : 'Assistant'}
                </p>
                <p className="mt-1">{state.liveTranscript}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Chat history display */}
        <ScrollArea className="h-[500px] rounded-md border p-4">
          <div className="space-y-4">
            {state.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.type === 'system' 
                    ? 'justify-center' 
                    : message.role === 'user' 
                      ? 'justify-end' 
                      : 'justify-start'
                }`}
              >
                <Card className={`max-w-[80%] ${
                  message.type === 'system'
                    ? 'bg-secondary text-secondary-foreground'
                    : message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                }`}>
                  <CardContent className="p-3">
                    {message.type !== 'system' && (
                      <p className="text-sm opacity-70">
                        {message.role === 'user' ? 'You' : 'Assistant'}
                      </p>
                    )}
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