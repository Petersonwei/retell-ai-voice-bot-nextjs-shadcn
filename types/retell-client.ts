import { EventEmitter } from 'events';

interface TranscriptItem {
  role: string;
  content: string;
}

export class RetellWebClient extends EventEmitter {
  agent_id?: string;
  access_token?: string;
  voice_id?: string;
  language?: string;
  sampleRate?: number;
  private debug: boolean = true;

  constructor() {
    super();
    this.log('RetellWebClient initialized');
  }

  private log(...args: any[]) {
    if (this.debug) {
      console.log('[RetellWebClient]', ...args);
    }
  }

  disconnect(): Promise<void> {
    this.log('Disconnecting...');
    return Promise.resolve();
  }

  initializeDevices(): Promise<void> {
    this.log('Initializing devices...');
    return Promise.resolve();
  }

  setVoiceConfig(config: { voice_id: string; language: string }): Promise<void> {
    this.log('Setting voice config:', config);
    return Promise.resolve();
  }

  startCall(config: { 
    accessToken: string;
    sampleRate?: number;
    captureDeviceId?: string;
    playbackDeviceId?: string;
    emitRawAudioSamples?: boolean;
  }): Promise<void> {
    this.log('Starting call with config:', config);
    return Promise.resolve();
  }

  stopCall(): void {
    this.log('Stopping call...');
    try {
      this.log('Emitting call_ended event');
      this.emit('call_ended');
      this.log('Call ended successfully');
    } catch (error) {
      this.log('Error in stopCall:', error);
      this.emit('error', { message: 'Error stopping call' });
    }
  }

  removeAllListeners(): this {
    this.log('Removing all listeners');
    super.removeAllListeners();
    return this;
  }
}

export type { TranscriptItem };