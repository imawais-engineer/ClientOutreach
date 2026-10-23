import { cookies } from 'next/headers';

export function isAuthed(): boolean {
  return cookies().get('auth')?.value === '1';
}

export function checkApiSecret(req: Request): boolean {
  const secret = process.env.API_SECRET;
  if (!secret) return false;
  return req.headers.get('x-api-secret') === secret;
}

export function requireAuthOrSecret(req: Request): boolean {
  return isAuthed() || checkApiSecret(req);
}
