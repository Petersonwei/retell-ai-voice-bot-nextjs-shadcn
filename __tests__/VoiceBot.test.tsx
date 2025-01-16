import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import VoiceBot from '../components/VoiceBot'
import { RetellWebClient } from "retell-client-js-sdk"

// Enhanced mock implementation
const mockEventHandlers: Record<string, Function[]> = {}
const mockOn = jest.fn((event, handler) => {
  mockEventHandlers[event] = mockEventHandlers[event] || []
  mockEventHandlers[event].push(handler)
  return { removeListener: jest.fn() }
})

const mockStartCall = jest.fn().mockResolvedValue(undefined)
const mockStopCall = jest.fn().mockResolvedValue(undefined)
const mockDisconnect = jest.fn().mockResolvedValue(undefined)
const mockRemoveAllListeners = jest.fn()

// Mock RetellWebClient
jest.mock('retell-client-js-sdk', () => ({
  RetellWebClient: jest.fn().mockImplementation(() => ({
    on: mockOn,
    removeAllListeners: mockRemoveAllListeners,
    startCall: mockStartCall,
    stopCall: mockStopCall,
    disconnect: mockDisconnect,
    initializeDevices: jest.fn().mockResolvedValue(undefined)
  }))
}))

describe('VoiceBot', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.keys(mockEventHandlers).forEach(key => {
      mockEventHandlers[key] = []
    })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'mock-token' })
    })
  })

  it('initializes with correct default state', () => {
    render(<VoiceBot />)
    expect(screen.getByText('Start Call')).toBeInTheDocument()
    expect(screen.queryByText(/Error/)).not.toBeInTheDocument()
  })

  it('handles complete call lifecycle', async () => {
    render(<VoiceBot />)
    
    // Start call
    await act(async () => {
      fireEvent.click(screen.getByText('Start Call'))
    })

    // Verify call setup
    expect(mockStartCall).toHaveBeenCalledWith({
      accessToken: 'mock-token',
      sampleRate: 24000,
      captureDeviceId: 'default',
      emitRawAudioSamples: false
    })

    // Simulate transcription
    await act(async () => {
      const transcriptionHandler = mockEventHandlers['transcription']?.[0]
      if (transcriptionHandler) {
        transcriptionHandler({ text: 'Hello' })
      }
    })
    expect(screen.getByText('Hello')).toBeInTheDocument()

    // End call by clicking end button
    await act(async () => {
      const endButton = screen.getByText('End Call')
      fireEvent.click(endButton)
    })

    expect(mockStopCall).toHaveBeenCalled()
    expect(screen.getByText('Start Call')).toBeInTheDocument()
  })

  it('handles errors during call', async () => {
    render(<VoiceBot />)

    // Start call
    await act(async () => {
      fireEvent.click(screen.getByText('Start Call'))
    })

    // Simulate error
    await act(async () => {
      const errorHandler = mockEventHandlers['error']?.[0]
      if (errorHandler) {
        errorHandler(new Error('Test error'))
      }
    })

    // Click end call button to trigger stopCall
    await act(async () => {
      const endButton = screen.getByText('End Call')
      fireEvent.click(endButton)
    })

    expect(screen.getByText(/Test error/)).toBeInTheDocument()
    expect(mockStopCall).toHaveBeenCalled()
  })

  it('cleans up resources on unmount', async () => {
    const { unmount } = render(<VoiceBot />)
    
    await act(async () => {
      unmount()
    })

    expect(mockRemoveAllListeners).toHaveBeenCalled()
  })
}) 