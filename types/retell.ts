export interface WebCallResponse {
    call_id: string;
    web_call_link: string;
    access_token: string;
    agent_id: string;
    call_status: 'registered' | 'ongoing' | 'ended' | 'error';
    call_type: 'web_call';
    metadata?: Record<string, unknown>;
    transcript?: string;
    call_analysis?: CallAnalysis;
    endCall?: () => Promise<void>;
}

export interface CustomAnalysisData {
    name?: string;
    'name of the kid'?: string;
    'age of kid'?: string;
    scenario?: string;
    'our advice'?: string;
    'what caller did for the situation'?: string;
    [key: string]: string | undefined;
}

export interface CallAnalysis {
    in_voicemail?: boolean;
    user_sentiment?: 'Negative' | 'Positive' | 'Neutral' | 'Unknown';
    call_successful?: boolean;
    call_summary?: string;
    custom_analysis_data?: CustomAnalysisData;
    agent_task_completion_rating?: string;
    call_completion_rating?: string;
}

export interface RetellCall {
    call_id: string;
    call_status: 'registered' | 'ongoing' | 'ended' | 'error';
    duration?: number;
    created_at?: string;
    call_analysis?: CallAnalysis;
    metadata?: Record<string, unknown>;
    call_type?: string;
    access_token?: string;
}

export interface TransformedAnalysis {
    name: string;
    kidName: string;
    kidAge: string;
    scenario: string;
    advice: string;
    callerAction: string;
    callSummary: string;
    userSentiment: string;
    callSuccessful: boolean;
}

export interface TransformedCall {
    call_id: string;
    call_status: string;
    duration?: number;
    created_at: string;
    analysis: TransformedAnalysis;
}

export interface GetCallsResponse {
    data: TransformedCall[];
    pagination_key?: string;
}

export interface CallListParams {
    limit: number;
    pagination_key?: string;
}

export interface CallRetrieveParams {
    include_call_analysis?: boolean;
}

export interface CallListResponse {
    [index: number]: RetellCall;
    length: number;
    forEach: (callback: (call: RetellCall) => void) => void;
    map: <T>(callback: (call: RetellCall) => T) => T[];
}

export interface RetellClient {
    createWebCall: (params: { agent_id: string }) => Promise<WebCallResponse>;
    call: {
        endCall: (callId: string) => Promise<void>;
        retrieve: (callId: string, params?: CallRetrieveParams) => Promise<RetellCall>;
        list: (params: CallListParams) => Promise<CallListResponse>;
    };
    agent_id: string;
}