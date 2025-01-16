export interface WebCallResponse {
    call_id: string;
    web_call_link: string;
    access_token: string;
    agent_id: string;
    call_status: 'registered' | 'ongoing' | 'ended' | 'error';
    call_type: 'web_call';
    metadata?: Record<string, unknown>;
    transcript?: string;
    call_analysis?: {
      call_successful?: boolean;
      call_summary?: string;
      user_sentiment?: 'Negative' | 'Positive' | 'Neutral' | 'Unknown';
    };
    endCall?: () => Promise<void>;
  }
  
  export interface RetellClient {
    createWebCall: (params: { agent_id: string }) => Promise<WebCallResponse>;
    call: {
      endCall: (callId: string) => Promise<void>;
      retrieve: (callId: string) => Promise<any>;
    };
    agent_id: string;
  }