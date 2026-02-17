import type http from 'http';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { messages, webhooks } from '../db/schema';
import { publishMessage } from '../db/publishers';
import { logger } from '../logger';

const webhookRouteHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  webhookId: number,
  token: string
) => {
  // Look up webhook by id + token
  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, webhookId), eq(webhooks.token, token)))
    .limit(1);

  if (!webhook) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Webhook not found' }));
    return;
  }

  // Parse body
  const body = await new Promise<string>((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
  });

  let parsed: {
    content?: string;
    username?: string;
    avatar_url?: string;
  };

  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  if (!parsed.content || typeof parsed.content !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Content is required' }));
    return;
  }

  if (parsed.content.length > 4000) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Content exceeds maximum length of 4000 characters' }));
    return;
  }

  // Use payload username override, or fall back to webhook name as alias
  const displayName = parsed.username || webhook.name;

  // Insert message with webhookId
  const [message] = await db
    .insert(messages)
    .values({
      content: parsed.content,
      userId: webhook.createdBy,
      channelId: webhook.channelId,
      webhookId: webhook.id,
      metadata: [
        {
          url: '',
          title: displayName,
          siteName: 'webhook',
          description: '',
          mediaType: 'webhook'
        }
      ],
      createdAt: Date.now()
    })
    .returning();

  if (!message) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to create message' }));
    return;
  }

  await publishMessage(message.id, webhook.channelId, 'create');

  logger.info(
    'Webhook %s (%d) sent message to channel %d',
    webhook.name,
    webhook.id,
    webhook.channelId
  );

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ id: message.id }));
};

export { webhookRouteHandler };
