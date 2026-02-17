const DISCORD_BOT_RE = /discordbot/i

/** Returns true if the User-Agent belongs to Discord's embed crawler. */
export const isDiscordBot = (userAgent: string | undefined | null): boolean => {
  return DISCORD_BOT_RE.test(userAgent || '')
}

/** Escape HTML entities to prevent injection in HTML content. */
export const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Convert plain text to HTML safe for the Mastodon `content` field.
 * Escapes `<`, `>`, `&` and converts newlines to `<br>`.
 */
export const textToHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}
