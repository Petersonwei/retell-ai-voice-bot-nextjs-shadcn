export const retellConfig = {
    apiKey: process.env.NEXT_PUBLIC_RETELL_API_KEY,
    agentId: process.env.NEXT_PUBLIC_RETELL_AGENT_ID,
    websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL,
  };
  
  export function validateRetellConfig() {
    const missingVars = [];
    
    if (!retellConfig.apiKey) missingVars.push('NEXT_PUBLIC_RETELL_API_KEY');
    if (!retellConfig.agentId) missingVars.push('NEXT_PUBLIC_RETELL_AGENT_ID');
    if (!retellConfig.websocketUrl) missingVars.push('NEXT_PUBLIC_WEBSOCKET_URL');
    
    if (missingVars.length > 0) {
      console.error('Missing required Retell configuration:', missingVars);
      return false;
    }
    
    return true;
  }