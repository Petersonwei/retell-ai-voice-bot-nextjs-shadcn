'use client'

import { useEffect, useState } from 'react'
import { WebCallResponse } from '@/types/retell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function CallsPage() {
  const [calls, setCalls] = useState<WebCallResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCalls() {
      try {
        const response = await fetch('/api/retell/get-calls')
        if (!response.ok) {
          throw new Error('Failed to fetch calls')
        }
        const data = await response.json()
        setCalls(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load calls')
      } finally {
        setLoading(false)
      }
    }

    fetchCalls()
  }, [])

  if (loading) {
    return <div className="flex justify-center p-8">Loading calls...</div>
  }

  if (error) {
    return (
      <div className="flex justify-center p-8 text-destructive">
        Error: {error}
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">Call History</h1>
      <ScrollArea className="h-[600px]">
        <div className="grid gap-4">
          {calls.map((call) => (
            <Card key={call.call_id}>
              <CardHeader>
                <CardTitle className="text-lg">
                  Call ID: {call.call_id}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  <div>
                    <span className="font-semibold">Status:</span> {call.call_status}
                  </div>
                  {call.call_analysis && (
                    <>
                      <div>
                        <span className="font-semibold">Sentiment:</span>{' '}
                        {call.call_analysis.user_sentiment}
                      </div>
                      {call.call_analysis.call_summary && (
                        <div>
                          <span className="font-semibold">Summary:</span>
                          <p className="mt-1 text-sm">
                            {call.call_analysis.call_summary}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {call.transcript && (
                    <div>
                      <span className="font-semibold">Transcript:</span>
                      <p className="mt-1 text-sm whitespace-pre-wrap">
                        {call.transcript}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
} 