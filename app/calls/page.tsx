'use client'

import { useEffect, useState } from 'react'
import { TransformedCall } from '@/types/retell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function CallsPage() {
  const [calls, setCalls] = useState<TransformedCall[]>([])
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
        setCalls(data.data) // Access the nested data array
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
                  <div>
                    <span className="font-semibold">Created:</span>{' '}
                    {new Date(call.created_at).toLocaleString()}
                  </div>
                  {call.duration && (
                    <div>
                      <span className="font-semibold">Duration:</span>{' '}
                      {Math.round(call.duration / 1000)}s
                    </div>
                  )}
                  <div className="border-t pt-2 mt-2">
                    <h3 className="font-semibold mb-2">Analysis</h3>
                    <div className="grid gap-2 text-sm">
                      <div>
                        <span className="font-semibold">Name:</span> {call.analysis.name}
                      </div>
                      <div>
                        <span className="font-semibold">Kid's Name:</span> {call.analysis.kidName}
                      </div>
                      <div>
                        <span className="font-semibold">Kid's Age:</span> {call.analysis.kidAge}
                      </div>
                      <div>
                        <span className="font-semibold">Scenario:</span> {call.analysis.scenario}
                      </div>
                      <div>
                        <span className="font-semibold">Advice Given:</span> {call.analysis.advice}
                      </div>
                      <div>
                        <span className="font-semibold">Caller Action:</span> {call.analysis.callerAction}
                      </div>
                      <div>
                        <span className="font-semibold">Call Summary:</span> {call.analysis.callSummary}
                      </div>
                      <div>
                        <span className="font-semibold">Sentiment:</span> {call.analysis.userSentiment}
                      </div>
                      <div>
                        <span className="font-semibold">Call Successful:</span>{' '}
                        {call.analysis.callSuccessful ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
} 