import type { ActivityLinkOptions } from './types'

/**
 * Generate the `<link>` tag that triggers Discord's Mastodon embed renderer.
 *
 * Add this to the `<head>` of the HTML page Discord's crawler fetches.
 * Only include it when the request comes from Discord (`isDiscordBot()`).
 *
 * @returns An HTML `<link>` tag string.
 */
export const createActivityLink = (options: ActivityLinkOptions): string => {
  const { baseUrl, authorHandle, statusId } = options
  const href = `${baseUrl}/users/${encodeURIComponent(authorHandle)}/statuses/${encodeURIComponent(statusId)}`
  return `<link href="${href}" rel="alternate" type="application/activity+json"/>`
}
