import VoiceBot from '@/components/VoiceBot'

export default function Home() {
  return (
    <main className="min-h-screen p-4">
      <h1 className="text-2xl font-bold text-center mb-8">Retell Voice Bot</h1>
      <VoiceBot />
    </main>
  )
}