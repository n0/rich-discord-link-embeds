import type {
  StatusOptions,
  MastodonStatus,
  MastodonAccount,
  MastodonMediaAttachment,
} from './types'

/**
 * Generate a Mastodon API v1-compatible Status JSON object.
 *
 * Serve this from `/api/v1/statuses/:id` and `/users/:handle/statuses/:id`.
 * Discord fetches these endpoints when it detects the `application/activity+json`
 * link tag, then renders the HTML `content` field with rich formatting.
 */
export const createStatus = (options: StatusOptions): MastodonStatus => {
  return {
    id: options.id,
    url: options.url,
    uri: options.url,
    created_at: options.createdAt || new Date().toISOString(),
    edited_at: null,
    reblog: null,
    in_reply_to_id: options.replyToId || null,
    in_reply_to_account_id: null,
    language: options.language || 'en',
    content: options.content,
    spoiler_text: options.spoilerText || '',
    visibility: options.visibility || 'public',
    application: { name: options.applicationName || 'Web', website: null },
    media_attachments: buildMediaAttachments(options.media || []),
    account: buildAccount(options.author),
    mentions: [],
    tags: [],
    emojis: [],
    card: null,
    poll: null,
  }
}

function buildAccount(author: StatusOptions['author']): MastodonAccount {
  return {
    id: author.id,
    display_name: author.displayName,
    username: author.username,
    acct: author.username,
    url: author.url || '',
    uri: author.url || '',
    created_at: author.joinedAt || new Date().toISOString(),
    locked: author.protected || false,
    bot: false,
    discoverable: true,
    indexable: false,
    group: false,
    avatar: author.avatarUrl || '',
    avatar_static: author.avatarUrl || '',
    header: author.bannerUrl || '',
    header_static: author.bannerUrl || '',
    followers_count: author.followersCount || 0,
    following_count: author.followingCount || 0,
    statuses_count: author.statusesCount || 0,
    hide_collections: false,
    noindex: false,
    emojis: [],
    roles: [],
    fields: [],
  }
}

function buildMediaAttachments(media: NonNullable<StatusOptions['media']>): MastodonMediaAttachment[] {
  return media.map((m, i) => ({
    id: m.id || `${m.type}_${i}`,
    type: m.type === 'gif' ? 'gifv' as const : m.type === 'video' ? 'video' as const : 'image' as const,
    url: m.url,
    preview_url: m.thumbnailUrl || (m.type === 'image' ? m.url : null),
    remote_url: null,
    preview_remote_url: null,
    text_url: null,
    description: m.altText || null,
    meta: {
      original: {
        width: m.width || 0,
        height: m.height || 0,
        size: `${m.width || 0}x${m.height || 0}`,
        aspect: m.width && m.height ? m.width / m.height : 1,
      },
    },
  }))
}
