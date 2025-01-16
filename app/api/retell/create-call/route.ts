import { NextResponse } from 'next/server';
import Retell from 'retell-sdk';

export async function POST(request: Request) {
  try {
    const { agentId, apiKey } = await request.json();

    if (!agentId || !apiKey) {
      return NextResponse.json(
        { error: 'Agent ID and API key are required' }, 
        { status: 400 }
      );
    }

    const client = new Retell({
      apiKey: apiKey,
    });

    const webCallResponse = await client.call.createWebCall({ 
      agent_id: agentId,
      metadata: {
        customer_name: "User"
      }
    });

    return NextResponse.json(webCallResponse);
  } catch (error) {
    console.error('[create-call] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}