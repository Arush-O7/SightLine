// Vercel function. vercel.json rewrites /api/* to here with the original path in ?__path.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApi } from '../server/app.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let path = url.searchParams.get('__path');
  url.searchParams.delete('__path');
  // if the platform kept the original URL instead, take the path from it
  if (path === null) path = url.pathname.replace(/^\/api\/?/, '');
  const search = url.searchParams.toString();
  await handleApi(req, res, `/${path}${search ? `?${search}` : ''}`);
}
