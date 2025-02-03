import { NextResponse } from 'next/server';
import Retell from 'retell-sdk';
import { retellConfig } from '@/lib/retell-config';

export async function GET() {
  try {
    if (!retellConfig.apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    const client = new Retell({
      apiKey: retellConfig.apiKey,
    });

    // Fetch calls with correct pagination parameters
    const calls = await client.call.list({
      limit: 50,  // Number of calls to fetch
      pagination_key: undefined,
    });


    return NextResponse.json(calls);
  } catch (error) {
    console.error('[get-calls] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 