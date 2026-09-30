// Runs in the browser before the app starts. BotID attaches its proof-of-browser headers to same-origin
// fetches of the protected route. It can only verify on Vercel, so local runs skip it (the server side
// treats local requests as human; see src/server/chat/runtime.ts).

import { initBotId } from 'botid/client/core';

const env = process.env.NEXT_PUBLIC_VERCEL_ENV;
if (env === 'production' || env === 'preview') {
  initBotId({ protect: [{ path: '/api/chat', method: 'POST' }] });
}
