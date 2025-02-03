import { NextResponse } from 'next/server';
import Retell from 'retell-sdk';
import { serverRetellConfig } from '@/lib/retell-config';
import type { RetellCall, GetCallsResponse, TransformedCall, CustomAnalysisData } from '@/types/retell';

export async function GET() {
  try {
    if (!serverRetellConfig.apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    console.log('Initializing Retell client...');
    const client = new Retell({
      apiKey: serverRetellConfig.apiKey,
    });

    console.log('Fetching calls from Retell API...');
    const callsResponse = await client.call.list({
      limit: 50,
      pagination_key: undefined
    });

    console.log('Raw calls response:', JSON.stringify(callsResponse, null, 2));

    if (!callsResponse || !Array.isArray(callsResponse)) {
      console.error('Invalid response format:', callsResponse);
      throw new Error('Unexpected response format from Retell API');
    }

    // For each call, fetch its detailed analysis using the Get Call API
    const callsWithAnalysis = await Promise.all(
      callsResponse.map(async (call) => {
        try {
          // Get detailed call data including analysis results
          const detailedCall = await client.call.retrieve(call.call_id);
          
          console.log(`Detailed call data for ${call.call_id}:`, JSON.stringify(detailedCall, null, 2));
          
          // Extract analysis data from the response
          const callAnalysis = detailedCall.call_analysis || {};
          const customAnalysis = (callAnalysis.custom_analysis_data || {}) as CustomAnalysisData;

          console.log(`Custom analysis fields for call ${call.call_id}:`, JSON.stringify(customAnalysis, null, 2));

          const transformedCall: TransformedCall = {
            call_id: call.call_id,
            call_status: call.call_status,
            duration: call.duration,
            created_at: call.created_at || new Date().toISOString(),
            analysis: {
              // Custom analysis fields from custom_analysis_data
              name: customAnalysis.name || '',
              kidName: customAnalysis['name of the kid'] || '',
              kidAge: customAnalysis['age of kid'] || '',
              scenario: customAnalysis.scenario || '',
              advice: customAnalysis['our advice'] || '',
              callerAction: customAnalysis['what caller did for the situation'] || '',
              // Standard call analysis fields
              callSummary: callAnalysis.call_summary || '',
              userSentiment: callAnalysis.user_sentiment || 'Unknown',
              callSuccessful: callAnalysis.call_successful || false,
            }
          };

          return transformedCall;
        } catch (error) {
          console.error(`Error fetching analysis for call ${call.call_id}:`, error);
          // Return a default structure if analysis fetch fails
          return {
            call_id: call.call_id,
            call_status: call.call_status,
            duration: call.duration,
            created_at: call.created_at || new Date().toISOString(),
            analysis: {
              name: '',
              kidName: '',
              kidAge: '',
              scenario: '',
              advice: '',
              callerAction: '',
              callSummary: '',
              userSentiment: 'Unknown',
              callSuccessful: false,
            }
          };
        }
      })
    );

    const response: GetCallsResponse = {
      data: callsWithAnalysis,
      pagination_key: undefined // Since we're not using pagination in this implementation
    };

    console.log('Final response:', JSON.stringify(response, null, 2));
    return NextResponse.json(response);
  } catch (error) {
    console.error('[get-calls] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 