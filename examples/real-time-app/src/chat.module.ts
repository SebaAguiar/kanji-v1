import { KanjijsModule } from '@kanjijs/core';
import { ChatGateway } from './chat.gateway.js';
import { ChatService } from './chat.service.js';

@KanjijsModule({
  gateways: [ChatGateway],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
