import { capitalize, toSingular } from '../utils/inflection.js';

export function getGatewayTemplate(name: string): string {
  const singular = toSingular(name);
  const singularCapitalized = capitalize(singular);
  
  return `import { WebSocketGateway, WebSocketMessage, WebSocketEvent, type WebSocketContext } from '@kanjijs/platform-hono';
import { Contract } from '@kanjijs/contracts';
import { z } from 'zod';
// import { ${singularCapitalized}Service } from './${singular}.service.js';

@WebSocketGateway('/${name.toLowerCase()}')
export class ${singularCapitalized}Gateway {
  // constructor(private readonly ${singular}Service: ${singularCapitalized}Service) {}

  @WebSocketEvent('connect')
  onConnect(ctx: WebSocketContext): void {
    console.log(\`Client connected: \${ctx.id}\`);
    ctx.send('welcome', { message: 'Connected to ${singularCapitalized}Gateway!' });
  }

  @WebSocketMessage('message')
  @Contract({
    body: z.object({
      text: z.string(),
    }),
  })
  onMessage(ctx: WebSocketContext<{ text: string }>): void {
    const payload = ctx.validatedBody;
    console.log(\`Received message from \${ctx.id}: \${payload.text}\`);
    
    ctx.send('echo', { text: payload.text });
  }

  @WebSocketEvent('disconnect')
  onDisconnect(ctx: WebSocketContext): void {
    console.log(\`Client disconnected: \${ctx.id}\`);
  }
}
`;
}
