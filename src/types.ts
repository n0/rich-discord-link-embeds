/* ------------------------------------------------------------------ */
/*  Input types                                                       */
/* ------------------------------------------------------------------ */

export interface StatusOptions {
  /** Unique status/post ID */
  id: string
  /** Canonical URL of the original post */
  url: string
  /**
   * HTML content for the embed description.
   *
   * Supported tags:
   * - `<b>` / `<strong>` → **bold**
   * - `<i>` / `<em>` → *italic*
   * - `<br>` → line break
   * - `<blockquote>` → quote block
   * - `<a href="...">` → clickable link
   * - `<code>` → inline code
   * - `<pre>` → code block
   *
   * Use `textToHtml()` to convert plain text safely.
   */
  content: string
  /** ISO 8601 timestamp */
  createdAt?: string
  /** ISO 639-1 language code (default: "en") */
  language?: string
  /** Author / account information */
  author: StatusAuthor
  /** Media attachments */
  media?: StatusMedia[]
  /** ID of the status this replies to */
  replyToId?: string
  /** Application name shown on the status (default: "Web") */
  applicationName?: string
  /** Content warning / spoiler text */
  spoilerText?: string
  /** Visibility level (default: "public") */
  visibility?: 'public' | 'unlisted' | 'private' | 'direct'
}

export interface StatusAuthor {
  id: string
  displayName: string
  username: string
  url?: string
  avatarUrl?: string
  bannerUrl?: string
  followersCount?: number
  followingCount?: number
  statusesCount?: number
  protected?: boolean
  joinedAt?: string
}

export interface StatusMedia {
  type: 'image' | 'video' | 'gif'
  url: string
  id?: string
  thumbnailUrl?: string
  width?: number
  height?: number
  altText?: string
}

/* ------------------------------------------------------------------ */
/*  Mastodon API v1 response types                                    */
/* ------------------------------------------------------------------ */

export interface MastodonAccount {
  id: string
  display_name: string
  username: string
  acct: string
  url: string
  uri: string
  created_at: string
  locked: boolean
  bot: boolean
  discoverable: boolean
  indexable: boolean
  group: boolean
  avatar: string
  avatar_static: string
  header: string
  header_static: string
  followers_count: number
  following_count: number
  statuses_count: number
  hide_collections: boolean
  noindex: boolean
  emojis: never[]
  roles: never[]
  fields: never[]
}

export interface MastodonMediaAttachment {
  id: string
  type: 'image' | 'video' | 'gifv' | 'audio'
  url: string
  preview_url: string | null
  remote_url: null
  preview_remote_url: null
  text_url: null
  description: string | null
  meta: {
    original: {
      width: number
      height: number
      size: string
      aspect: number
    }
  }
}

export interface MastodonStatus {
  id: string
  url: string
  uri: string
  created_at: string
  edited_at: null
  reblog: null
  in_reply_to_id: string | null
  in_reply_to_account_id: null
  language: string | null
  content: string
  spoiler_text: string
  visibility: string
  application: { name: string; website: null }
  media_attachments: MastodonMediaAttachment[]
  account: MastodonAccount
  mentions: never[]
  tags: never[]
  emojis: never[]
  card: null
  poll: null
}

export interface ActivityLinkOptions {
  /** Your server's base URL (e.g. "https://your-domain.com") */
  baseUrl: string
  /** The author's handle */
  authorHandle: string
  /** The status/post ID */
  statusId: string
}
