'use client' // Marks this as a client-side component in Next.js

// Import necessary hooks, components and types
import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { retellConfig } from '@/lib/retell-config'
import '../types/retell-client'
import '../types/speech-recognition'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react"
import { useRetellClient } from '@/hooks/use-retell-client'

// Interface for chat messages between user and assistant
export interface Message {
  id: string
  type: 'response' | 'transcription' | 'system' // Added system type for wake word notifications
  role?: string
  content: string
  timestamp: Date
  isComplete?: boolean
}

// Main state interface for the VoiceBot component
export interface VoiceBotState {
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

// Component for displaying call controls (buttons)
interface CallControlsProps {
  isCallActive: boolean
  isLoading: boolean
  isListeningForWakeWord: boolean
  callStatus: string
  onStartCall: () => void
  onEndCall: () => void
  onStartWakeWordDetection: () => void
  onStopWakeWordDetection: () => void
}

function CallControls({
  isCallActive,
  isLoading,
  isListeningForWakeWord,
  callStatus,
  onStartCall,
  onEndCall,
  onStartWakeWordDetection,
  onStopWakeWordDetection
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex gap-2">
        <Button
          onClick={isListeningForWakeWord ? onStopWakeWordDetection : onStartWakeWordDetection}
          disabled={isCallActive}
          variant="outline"
        >
          {isListeningForWakeWord ? (
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
          onClick={isCallActive ? onEndCall : onStartCall}
          disabled={isLoading || isListeningForWakeWord}
          variant={isCallActive ? "destructive" : "default"}
        >
          {isLoading ? (
            <span>Initializing...</span>
          ) : isCallActive ? (
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
        Status: {isListeningForWakeWord ? 'Listening for wake word' : callStatus}
      </span>
    </div>
  )
}

// Component for displaying error messages
interface ErrorDisplayProps {
  error: string | null
}

function ErrorDisplay({ error }: ErrorDisplayProps) {
  if (!error) return null
  
  return (
    <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-md">
      {error}
    </div>
  )
}

// Component for displaying live transcript
interface LiveTranscriptProps {
  transcript: string
  role: string | null
}

function LiveTranscript({ transcript, role }: LiveTranscriptProps) {
  if (!transcript) return null
  
  return (
    <div className="mb-4">
      <Card className={`max-w-[80%] ${
        role === 'user' 
          ? 'bg-primary text-primary-foreground ml-auto' 
          : 'bg-muted'
      }`}>
        <CardContent className="p-3">
          <p className="text-sm opacity-70">
            {role === 'user' ? 'You' : 'Assistant'}
          </p>
          <p className="mt-1">{transcript}</p>
        </CardContent>
      </Card>
    </div>
  )
}

// Component for displaying a single message
interface MessageItemProps {
  message: Message
}

function MessageItem({ message }: MessageItemProps) {
  return (
    <div
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
  )
}

// Component for displaying the message list
interface MessageListProps {
  messages: Message[]
}

function MessageList({ messages }: MessageListProps) {
  return (
    <ScrollArea className="h-[500px] rounded-md border p-4">
      <div className="space-y-4">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
      </div>
    </ScrollArea>
  )
}

// Component for handling wake word detection
interface WakeWordDetectorProps {
  isActive: boolean
  onWakeWordDetected: () => void
  onError: (error: string) => void
}

function useWakeWordDetection({ 
  isActive, 
  onWakeWordDetected, 
  onError 
}: WakeWordDetectorProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const { toast } = useToast()
  const wakeWordDetectedRef = useRef<boolean>(false)
  const isRecognitionActiveRef = useRef<boolean>(false)

  // Cleanup function to ensure proper resource release
  const cleanupRecognition = useCallback(() => {
    if (recognitionRef.current && isRecognitionActiveRef.current) {
      try {
        console.log('[Wake Word Detection] Stopping recognition during cleanup')
        recognitionRef.current.stop()
        isRecognitionActiveRef.current = false
      } catch (err) {
        console.error('[Wake Word Detection] Error during cleanup:', err)
      }
    }
    
    // Reset state
    wakeWordDetectedRef.current = false
  }, [])

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

    // Clean up any existing recognition instance
    cleanupRecognition()

    // Use type assertion to handle the SpeechRecognition constructor
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript.toLowerCase())
        .join(' ')

      if (transcript.includes(WAKE_WORD) && !wakeWordDetectedRef.current) {
        wakeWordDetectedRef.current = true
        stopDetection()
        onWakeWordDetected()
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[Wake Word Detection] Error:', event.error)
      isRecognitionActiveRef.current = false
      onError(event.error)
    }

    recognition.onend = () => {
      console.log('[Wake Word Detection] Recognition ended')
      isRecognitionActiveRef.current = false
    }

    recognitionRef.current = recognition
  }, [toast, onWakeWordDetected, onError, cleanupRecognition])

  // Start detection
  const startDetection = useCallback(() => {
    // Reset the wake word detected flag
    wakeWordDetectedRef.current = false
    
    // If recognition is already active, don't try to start it again
    if (isRecognitionActiveRef.current) {
      console.log('[Wake Word Detection] Recognition already active, not starting again')
      return
    }
    
    // Initialize if needed
    if (!recognitionRef.current) {
      initializeWakeWordDetection()
    }
    
    if (recognitionRef.current) {
      try {
        console.log('[Wake Word Detection] Starting recognition')
        recognitionRef.current.start()
        isRecognitionActiveRef.current = true
      } catch (err) {
        console.error('[Wake Word Detection] Error starting recognition:', err)
        isRecognitionActiveRef.current = false
        
        // If there was an error, reinitialize and try again after a delay
        setTimeout(() => {
          initializeWakeWordDetection()
          if (recognitionRef.current && !isRecognitionActiveRef.current) {
            try {
              recognitionRef.current.start()
              isRecognitionActiveRef.current = true
            } catch (retryErr) {
              console.error('[Wake Word Detection] Error on retry:', retryErr)
            }
          }
        }, 500)
      }
    }
  }, [initializeWakeWordDetection])

  // Stop detection
  const stopDetection = useCallback(() => {
    if (recognitionRef.current && isRecognitionActiveRef.current) {
      try {
        console.log('[Wake Word Detection] Stopping recognition')
        recognitionRef.current.stop()
        isRecognitionActiveRef.current = false
      } catch (err) {
        console.error('[Wake Word Detection] Error stopping recognition:', err)
      }
    }
  }, [])

  // Effect to start/stop detection based on isActive prop
  useEffect(() => {
    console.log('[Wake Word Detection] isActive changed:', isActive)
    
    if (isActive) {
      // Only start if not already active
      if (!isRecognitionActiveRef.current) {
        // Add a small delay to ensure any previous instance has fully cleaned up
        const timer = setTimeout(() => {
          startDetection()
        }, 300)
        return () => clearTimeout(timer)
      }
    } else {
      stopDetection()
    }
    
    // Cleanup on unmount
    return () => {
      cleanupRecognition()
    }
  }, [isActive, startDetection, stopDetection, cleanupRecognition])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRecognition()
    }
  }, [cleanupRecognition])

  return {
    startDetection,
    stopDetection
  }
}

// Main VoiceBot component
export default function VoiceBot() {
  const { toast } = useToast()
  
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
  
  // Prevent multiple simultaneous call starts
  const isStartingCallRef = useRef<boolean>(false)

  // Helper function to update state partially
  const updateState = useCallback((update: Partial<VoiceBotState>) => {
    setState(prev => ({ ...prev, ...update }))
  }, [])

  // Handle wake word detection
  const handleWakeWordDetected = useCallback(() => {
    // Prevent multiple simultaneous call starts
    if (isStartingCallRef.current || state.isCallActive || state.isLoading) return
    
    updateState({
      isListeningForWakeWord: false,
      messages: [...state.messages, {
        id: uuidv4(),
        type: 'system',
        content: 'Wake word detected! Starting conversation...',
        timestamp: new Date(),
        isComplete: true
      }]
    })
    
    // Set flag to prevent multiple calls
    isStartingCallRef.current = true
    
    // Small delay to ensure UI updates before starting call
    setTimeout(() => {
      startCall()
      isStartingCallRef.current = false
    }, 500)
  }, [state.messages, state.isCallActive, state.isLoading])

  // Handle wake word detection errors
  const handleWakeWordError = useCallback((error: string) => {
    toast({
      title: "Wake Word Detection Error",
      description: error,
      variant: "destructive"
    })
  }, [toast])

  // Start wake word detection
  const startWakeWordDetection = useCallback(() => {
    // Don't start wake word detection if a call is active or loading
    if (state.isCallActive || state.isLoading) return
    
    updateState({ 
      isListeningForWakeWord: true,
      messages: [...state.messages, {
        id: uuidv4(),
        type: 'system',
        content: `Listening for wake word: "${WAKE_WORD}"`,
        timestamp: new Date(),
        isComplete: true
      }]
    })
  }, [state.messages, state.isCallActive, state.isLoading])

  // Stop wake word detection
  const stopWakeWordDetection = useCallback(() => {
    updateState({ isListeningForWakeWord: false })
  }, [])

  // Use the wake word detection hook
  useWakeWordDetection({
    isActive: state.isListeningForWakeWord,
    onWakeWordDetected: handleWakeWordDetected,
    onError: handleWakeWordError
  })

  // Use the Retell client hook
  const { 
    startCall, 
    endCall,
    isInitialized
  } = useRetellClient({
    onCallStarted: () => {
      updateState({ 
        isCallActive: true, 
        isLoading: false,
        callStatus: 'ongoing' 
      })
    },
    onCallEnded: () => {
      updateState({ 
        isCallActive: false,
        callStatus: 'ended',
        isLoading: false
      })
      
      // Add a small delay before starting wake word detection again
      setTimeout(() => {
        startWakeWordDetection()
      }, 1000)
    },
    onError: (error: string) => {
      updateState({
        error: error,
        callStatus: 'error',
        isCallActive: false,
        isLoading: false
      })
      
      // Add a small delay before starting wake word detection again
      setTimeout(() => {
        startWakeWordDetection()
      }, 1000)
    },
    onLoading: (isLoading: boolean) => {
      updateState({ isLoading })
    },
    onTranscriptUpdate: (role: string, content: string) => {
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
    },
    onResponseUpdate: (content: string) => {
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, {
          id: uuidv4(),
          type: 'response',
          role: 'assistant',
          content: content,
          timestamp: new Date(),
          isComplete: true
        }]
      }))
    },
    onSentenceComplete: () => {
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
    }
  })

  // Start listening for wake word by default
  useEffect(() => {
    if (isInitialized && !state.isCallActive && !state.isLoading) {
      // Small delay to ensure everything is properly initialized
      const timer = setTimeout(() => {
        startWakeWordDetection()
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [isInitialized, state.isCallActive, state.isLoading, startWakeWordDetection])

  // Handle starting a call
  const handleStartCall = useCallback(() => {
    // Prevent multiple simultaneous call starts
    if (isStartingCallRef.current || state.isCallActive || state.isLoading) return
    
    isStartingCallRef.current = true
    updateState({ 
      error: null,
      isListeningForWakeWord: false
    })
    
    startCall()
    isStartingCallRef.current = false
  }, [startCall, state.isCallActive, state.isLoading])

  // Handle ending a call
  const handleEndCall = useCallback(() => {
    updateState({ isLoading: true })
    endCall()
  }, [endCall])

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        {/* Control buttons and status */}
        <CallControls
          isCallActive={state.isCallActive}
          isLoading={state.isLoading}
          isListeningForWakeWord={state.isListeningForWakeWord}
          callStatus={state.callStatus}
          onStartCall={handleStartCall}
          onEndCall={handleEndCall}
          onStartWakeWordDetection={startWakeWordDetection}
          onStopWakeWordDetection={stopWakeWordDetection}
        />

        {/* Error display */}
        <ErrorDisplay error={state.error} />

        {/* Live transcript display */}
        <LiveTranscript 
          transcript={state.liveTranscript} 
          role={state.liveTranscriptRole} 
        />

        {/* Chat history display */}
        <MessageList messages={state.messages} />
      </CardContent>
    </Card>
  )
}