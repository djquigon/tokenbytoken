// POST /api/chat. Thin: all logic lives in src/server/chat/. Listed in vercel.json with
// supportsCancellation, so a Stop in the browser aborts the OpenAI request (ADR 0002).

import { chatHandler } from '@/server/chat/runtime';

// Must match CHAT_CONFIG.maxDurationSec (route segment config has to be a literal).
export const maxDuration = 60;

export function POST(request: Request): Promise<Response> {
  return chatHandler()(request);
}
