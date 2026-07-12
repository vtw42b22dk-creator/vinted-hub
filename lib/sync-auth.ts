export function verifySyncSecret(request: Request): boolean {
  const secret = process.env.SYNC_SECRET
  if (!secret) return true

  const header = request.headers.get('x-sync-secret')
  return header === secret
}
