'use client'

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

interface Message {
  id: string
  type: 'response' | 'transcription'
  role?: string
  content: string
  timestamp: Date
}

interface VoiceBotState {
  isCallActive: boolean
  isLoading: boolean
  error: string | null
  callStatus: 'idle' | 'ongoing' | 'ended' | 'error'
  messages: Message[]
}

export default function VoiceBot() {
  const { toast } = useToast()
  const clientRef = useRef<RetellWebClient | null>(null)
  const [state, setState] = useState<VoiceBotState>({
    isCallActive: false,
    isLoading: false,
    error: null,
    callStatus: 'idle',
    messages: []
  })

  useEffect(() => {
    clientRef.current = new RetellWebClient()
    console.log('[VoiceBot] Client initialized')

    return () => {
      if (clientRef.current) {
        console.log('[VoiceBot] Cleaning up client')
        clientRef.current.removeAllListeners()
        clientRef.current.stopCall()
      }
    }
  }, [])

  const updateState = useCallback((update: Partial<VoiceBotState>) => {
    setState(prev => ({ ...prev, ...update }))
  }, [])

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
    }
  }, [updateState])

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

  useEffect(() => {
    if (!clientRef.current) return

    clientRef.current.on("transcription", (message) => {
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, {
          id: uuidv4(),
          type: 'transcription',
          role: 'user',
          content: message.text,
          timestamp: new Date()
        }]
      }))
    })

    clientRef.current.on("response", (message) => {
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, {
          id: uuidv4(),
          type: 'response',
          role: 'assistant',
          content: message.content,
          timestamp: new Date()
        }]
      }))
    })

    clientRef.current.on("error", (error) => {
      updateState({ 
        error: error.message || 'An error occurred',
        callStatus: 'error'
      })
    })

    clientRef.current.on("call_ended", () => {
      updateState({ 
        isCallActive: false,
        callStatus: 'ended'
      })
    })

    return () => {
      if (clientRef.current) {
        clientRef.current.removeAllListeners()
      }
    }
  }, [updateState])

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
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

        {state.error && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-md">
            {state.error}
          </div>
        )}

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