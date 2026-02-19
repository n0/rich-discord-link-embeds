# Rich Discord Link Embeds

How to get **markdown formatting** — bold, italic, links, blockquotes, code — in Discord link preview descriptions.

Standard OpenGraph embeds are plain text only. This documents the only known method to get rich formatted text in Discord link embeds: spoofing a Mastodon-compatible API endpoint.

---

## The Problem

When you paste a URL in Discord, it generates a link preview by reading OpenGraph meta tags. The `og:description` field is rendered as **plain text** — no bold, no links, no formatting of any kind.

```html
<meta property="og:description" content="This will always be plain text. No formatting."/>
```

There is no official Discord API or documented method to add formatting to link preview descriptions.

## The Solution

Discord has native embed support for Mastodon instances. When Discord detects a Mastodon-compatible server, it switches to a special embed renderer that parses **HTML content** and displays it with rich formatting.

**You don't need to run Mastodon.** You just need to return the right JSON from a few HTTP endpoints and include the right `<link>` tags in your HTML.

---

## How Discord Renders a Mastodon Embed (Visual Mapping)

Understanding what data maps to what visual element is critical. Here is exactly what Discord renders and where each field comes from:

```
┌─────────────────────────────────────────────┐
│ ■ [Left border color: <meta theme-color>]   │
│                                             │
│   [OEmbed author_name]        ← bold line   │
│                                             │
│   [avatar]  display_name                    │
│             @username                       │
│                                             │
│   [content field — rendered as HTML]        │
│   Bold, italic, links, blockquotes, code    │
│                                             │
│   ┌───────────────────────────────────┐     │
│   │ [media_attachments image/video]   │     │
│   └───────────────────────────────────┘     │
│                                             │
│   [OEmbed provider_name]   [created_at]     │
└─────────────────────────────────────────────┘
```

### Field → Visual Element Reference

| Visual element | Source | Notes |
|---|---|---|
| **Left border color** | `<meta property="theme-color" content="#1DA1F2"/>` in HTML `<head>` | Standard OpenGraph, not from Mastodon JSON |
| **Author line (top bold text)** | OEmbed `author_name` field | Overrides `account.display_name` when OEmbed link is present. Used for engagement stats like `💬 42  🔁 100  ❤️ 5.2K` |
| **Author line link** | OEmbed `author_url` field | Where clicking the author line navigates |
| **Avatar image** | `account.avatar` | Circular avatar to left of username |
| **Display name** | `account.display_name` | Shown next to avatar (when no OEmbed) or below author line (when OEmbed overrides it) |
| **Username** | `account.username` / `account.acct` | Shown as `@username` below display name |
| **Body text** | `content` field (HTML) | Rendered with full formatting support |
| **Media** | `media_attachments` array | Images, videos, GIFs below the text |
| **Footer text** | OEmbed `provider_name` | e.g., `"convert.cat"` or `"GIF · convert.cat"` |
| **Footer link** | OEmbed `provider_url` | Where clicking the footer navigates |
| **Timestamp** | `created_at` field | Shown in footer next to provider name |

### What Discord Ignores

These fields are required for valid JSON structure but Discord does not visibly render them:

- `account.followers_count`, `following_count`, `statuses_count`
- `account.header`, `header_static`
- `account.locked`, `bot`, `discoverable`, `indexable`, `group`
- `mentions`, `tags`, `emojis` arrays
- `card`, `poll` fields in the JSON (polls must be rendered in `content` HTML)
- `spoiler_text` (Discord does not honor content warnings)
- `application`
- `reblog`, `edited_at`

---

## How It Works

### The Full Flow

```
1. User pastes your URL in Discord

2. Discord's crawler (Discordbot) fetches the HTML page

3. Discord reads from the HTML <head>:
   a. <link rel="alternate" type="application/activity+json" .../>
   b. <link rel="alternate" type="application/json+oembed" .../>
   c. <meta property="theme-color" content="..."/>
   d. Standard OpenGraph tags (og:title, og:image, etc.) as fallback

4. Discord detects the activity+json link → treats this as a Mastodon instance

5. Discord makes TWO additional requests:
   a. GET /api/v1/statuses/:id → Mastodon Status JSON (content, account, media)
   b. GET /owoembed?... → OEmbed JSON (author_name, provider_name)

6. Discord combines:
   - theme-color → left border
   - OEmbed author_name → top bold line (overrides account.display_name)
   - OEmbed provider_name → footer text
   - Mastodon content → HTML-rendered body
   - Mastodon account.avatar → avatar image
   - Mastodon media_attachments → inline media
   - Mastodon created_at → timestamp

7. Discord renders the rich embed
```

### What You Need on Your Server

Four things:

1. **The `<link>` tags** in your HTML `<head>` (activity+json AND oembed)
2. **`GET /api/v1/statuses/:id`** — Mastodon Status JSON
3. **`GET /users/:handle/statuses/:id`** — ActivityPub URL (same JSON)
4. **`GET /owoembed`** — OEmbed JSON (controls author line and footer)

---

## Step 1: The HTML Head

Add these tags to the `<head>` of the HTML page Discord's crawler fetches. **Only serve the activity+json tag to Discord** — check for `Discordbot` in the User-Agent. The OEmbed tag is safe for all clients.

```html
<!-- Always serve: OEmbed link (controls author line + footer in Discord) -->
<link rel="alternate"
      href="https://your-site.com/owoembed?text=engagement+stats&author=handle&status=123"
      type="application/json+oembed"
      title="Author Name">

<!-- Discord only: triggers Mastodon embed renderer -->
<link href="https://your-site.com/users/handle/statuses/123"
      rel="alternate"
      type="application/activity+json"/>

<!-- Always serve: left border color -->
<meta property="theme-color" content="#1DA1F2"/>

<!-- Always serve: OpenGraph fallback for non-Discord clients -->
<meta property="og:title" content="Author Name (@handle)"/>
<meta property="og:description" content="Post text here"/>
<meta property="og:image" content="https://your-site.com/image.jpg"/>
```

```javascript
const isDiscord = /discordbot/i.test(userAgent)

const head = []

// Always include OEmbed + theme color + OpenGraph
head.push(`<link rel="alternate" href="${baseUrl}/owoembed?text=${encodeURIComponent(authorText)}&author=${handle}&status=${id}" type="application/json+oembed" title="${authorName}">`)
head.push(`<meta property="theme-color" content="${themeColor}"/>`)

// Discord only: activity+json link
if (isDiscord) {
  head.push(`<link href="${baseUrl}/users/${handle}/statuses/${id}" rel="alternate" type="application/activity+json"/>`)
}
```

---

## Step 2: The OEmbed Endpoint

Discord fetches the OEmbed URL from the `<link>` tag. This controls the **top bold line** (author_name) and **footer** (provider_name) of the embed.

### `GET /owoembed`

```json
{
  "type": "rich",
  "version": "1.0",
  "title": "Embed",
  "author_name": "💬 42   🔁 100   ❤️ 5.2K   👁️ 1.2M",
  "author_url": "https://x.com/user/status/123",
  "provider_name": "convert.cat",
  "provider_url": "https://convert.cat"
}
```

| Field | Renders as | Notes |
|---|---|---|
| `author_name` | **Bold text at top of embed** | Use for engagement stats, reply indicators, or any primary label. This OVERRIDES the Mastodon `account.display_name`. |
| `author_url` | Link target for the author line | Usually the original post URL |
| `provider_name` | Footer text | Your branding, e.g., `"convert.cat"`. Can include context: `"GIF · convert.cat"` |
| `provider_url` | Footer link target | Your site URL or the original post URL |
| `title` | Not visibly rendered | Required field, set to `"Embed"` |
| `type` | Required | Must be `"rich"` |
| `version` | Required | Must be `"1.0"` |

**Key insight:** The `author_name` field is the most powerful part of OEmbed. Because it overrides the Mastodon `display_name`, you can use it to show anything at the top of the embed — engagement stats, reply/thread indicators, or custom labels.

### Example OEmbed variations

**Engagement stats:**
```json
{ "author_name": "💬 42   🔁 100   ❤️ 5.2K   👁️ 1.2M" }
```

**Reply indicator:**
```json
{ "author_name": "↪ Replying to @otheruser" }
```

**Thread indicator:**
```json
{ "author_name": "↪ Thread by @user" }
```

**GIF with branding:**
```json
{ "provider_name": "GIF · convert.cat" }
```

---

## Step 3: The Mastodon Status Endpoint

Discord calls `GET /api/v1/statuses/:id` after detecting the activity+json link. Return JSON matching the Mastodon Status entity format. Both this endpoint and `/users/:handle/statuses/:id` must return `Content-Type: application/json`.

### Minimal Response

```json
{
  "id": "123",
  "url": "https://original-site.com/post/123",
  "uri": "https://original-site.com/post/123",
  "created_at": "2024-01-15T12:00:00.000Z",
  "content": "<b>This is bold</b><br>This is a new line",
  "visibility": "public",
  "account": {
    "id": "456",
    "display_name": "John Doe",
    "username": "johndoe",
    "acct": "johndoe",
    "url": "https://original-site.com/post/123",
    "avatar": "https://original-site.com/avatars/johndoe.jpg",
    "avatar_static": "https://original-site.com/avatars/johndoe.jpg"
  },
  "media_attachments": [],
  "mentions": [],
  "tags": [],
  "emojis": []
}
```

> **Note:** `account.url` should point to the **status URL**, not the profile URL. This is what FxEmbed does and Discord uses it as the clickable link for the account section.

### Full Response

```json
{
  "id": "123",
  "url": "https://original-site.com/post/123",
  "uri": "https://original-site.com/post/123",
  "created_at": "2024-01-15T12:00:00.000Z",
  "edited_at": null,
  "reblog": null,
  "in_reply_to_id": null,
  "in_reply_to_account_id": null,
  "language": "en",
  "content": "<b>Bold text</b><br><br>Regular text with <a href=\"https://example.com\">a link</a>",
  "spoiler_text": "",
  "visibility": "public",
  "application": {
    "name": "Your App Name",
    "website": null
  },
  "media_attachments": [],
  "account": {
    "id": "456",
    "display_name": "John Doe",
    "username": "johndoe",
    "acct": "johndoe",
    "url": "https://original-site.com/post/123",
    "uri": "https://original-site.com/post/123",
    "created_at": "2023-01-01T00:00:00.000Z",
    "locked": false,
    "bot": false,
    "discoverable": true,
    "indexable": false,
    "group": false,
    "avatar": "https://original-site.com/avatars/johndoe.jpg",
    "avatar_static": "https://original-site.com/avatars/johndoe.jpg",
    "header": "",
    "header_static": "",
    "followers_count": 1000,
    "following_count": 500,
    "statuses_count": 5000,
    "hide_collections": false,
    "noindex": false,
    "emojis": [],
    "roles": [],
    "fields": []
  },
  "mentions": [],
  "tags": [],
  "emojis": [],
  "card": null,
  "poll": null
}
```

---

## Supported HTML in `content`

Discord's Mastodon embed renderer parses the `content` field as HTML. These tags are rendered:

| HTML | Renders as | Example |
|---|---|---|
| `<b>text</b>` | **bold** | `<b>important</b>` |
| `<strong>text</strong>` | **bold** | `<strong>important</strong>` |
| `<i>text</i>` | *italic* | `<i>emphasis</i>` |
| `<em>text</em>` | *italic* | `<em>emphasis</em>` |
| `<br>` | line break | `line one<br>line two` |
| `<blockquote>text</blockquote>` | quote block (indented, grey bar) | `<blockquote>quoted text</blockquote>` |
| `<a href="url">text</a>` | clickable link | `<a href="https://example.com">click</a>` |
| `<code>text</code>` | `inline code` | `<code>variable</code>` |
| `<pre>text</pre>` | code block | `<pre>multi-line code</pre>` |

### HTML Spacing Entities

These HTML entities are useful for formatting within `content`:

| Entity | Renders as | Use case |
|---|---|---|
| `&ensp;` | En-space (medium width) | Separating emoji stats: `❤️ 5K&ensp;🔁 100` |
| `&emsp;` | Em-space (wide) | Separating labels from values in polls |
| `&nbsp;` | Non-breaking space | Preventing line breaks |

### Unicode Characters for Formatting

| Character | Code | Use case |
|---|---|---|
| `\u200A` | Hair space (invisible) | Padding after `<br>` to prevent Discord from collapsing consecutive line breaks. Use as: `<br>\u200A\u200A` |
| `\u2588` | Full block `█` | Building percentage bars for polls |
| `\u00B7` | Middle dot `·` | Separating metadata: `5 votes · 2 hours left` |
| `\u2015` | Horizontal bar `―` | Separating sections like multi-image counters |
| `\u21AA` | Hooked arrow `↪` | Reply/thread indicators in OEmbed author_name |
| `\u2026` | Ellipsis `…` | Text truncation |

### The Line Break Trick

Discord collapses multiple consecutive `<br>` tags. To get reliable blank lines, insert invisible Unicode hair spaces after each break:

```
Wrong:  <br><br>     → Discord may collapse to single line break
Right:  <br>\u200A\u200A<br>  → Reliable double line break
```

This pattern — `<br>` followed by two `\u200A` characters — prevents collapsing and is visually invisible.

---

## Content Patterns

### Social Proof Stats (in content body)

Stats appended at the end of the content as bold HTML:

```html
Post text here<br><br><b>💬 42&ensp;🔁 100&ensp;❤️ 5.2K&ensp;👁️ 1.2M</b>
```

Emoji mapping:
| Emoji | Meaning |
|---|---|
| 💬 | Comments / Replies |
| 🔁 | Reposts / Retweets |
| ❤️ | Likes |
| 👁️ | Views |
| ↗️ | Shares |

Only include stats with values > 0. Use `&ensp;` between each stat for spacing.

### Quote Tweets / Quoted Posts

Rendered as a blockquote with the quoted author linked:

```html
Main post text<br>\u200A\u200A<br><br><blockquote><b>Quoting <a href="https://x.com/user/status/456">Author Name</a> (<a href="https://x.com/user">@username</a>)</b><br>\u200A<br>The quoted post text goes here</blockquote>
```

Discord renders this as an indented quote block with a grey left bar, containing the quoted author (bold, linked) and their post text.

### Polls

Rendered as a blockquote with Unicode block bars:

```html
<blockquote>████████████████<br><b>Option A</b>&emsp;50%<br>\u200A\u200A\u200A<br>\u200A████████<br><b>Option B</b>&emsp;25%<br>\u200A\u200A\u200A<br>\u200A████████<br><b>Option C</b>&emsp;25%<br>\u200A\u200A\u200A<br>\u200A200 votes · 2 hours left</blockquote>
```

- Bar length: 32 `\u2588` characters at 100%. Scale proportionally: `Math.round((percentage / 100) * 32)`
- Use `&emsp;` between the label and percentage
- Use `\u200A` (hair space) padding between choices to prevent collapse
- Footer: `{vote_count} votes · {time_remaining}`

### Linkified Content

Wrap @mentions, #hashtags, and bare URLs in `<a>` tags within the content:

```html
<a href="https://x.com/user">@user</a> just posted about <a href="https://x.com/hashtag/topic">#topic</a>
<br><br>
Read more: <a href="https://example.com">https://example.com</a>
```

When linkifying, apply in this order to avoid double-wrapping:
1. Bare URLs → `<a>` tags
2. @mentions → `<a>` tags (use negative lookbehind to skip URLs already in `href`)
3. #hashtags → `<a>` tags

### Reply / Thread Indicators

These go in the OEmbed `author_name`, not in the `content` field:

```
Replying to someone:  "↪ Replying to @otheruser"
Self-reply thread:    "↪ Thread by @user"
```

The `\u21AA` character renders as a hooked arrow in Discord.

---

## Media Attachments

### Types

| Type | Use for | Discord behavior |
|---|---|---|
| `"image"` | Photos, static images | Rendered inline below content |
| `"video"` | Video files | Rendered as playable video |
| `"gifv"` | GIF animations | Auto-plays like a GIF |
| `"audio"` | Audio files | Audio player |

### Image Attachment

```json
{
  "id": "0",
  "type": "image",
  "url": "https://your-site.com/image.jpg",
  "preview_url": null,
  "remote_url": null,
  "preview_remote_url": null,
  "text_url": null,
  "description": "Alt text for accessibility",
  "meta": {
    "original": {
      "width": 1200,
      "height": 800,
      "size": "1200x800",
      "aspect": 1.5
    }
  }
}
```

### Video Attachment with Dimension Scaling

Discord refuses to render videos with dimensions >1920px and renders very small videos as tiny embeds. Apply this scaling:

```javascript
let sizeMultiplier = 1
if (width > 1920 || height > 1920) {
  sizeMultiplier = 0.5   // Scale down 50%
}
if (width < 400 && height < 400) {
  sizeMultiplier = 2     // Scale up 200%
}
```

> **Note:** The downscale check uses OR (either dimension >1920), but the upscale check uses AND (both dimensions <400).

Apply the same scaling to OpenGraph video meta tags in the HTML `<head>`:

```html
<meta property="og:video:width" content="960"/>   <!-- was 1920, scaled 50% -->
<meta property="og:video:height" content="540"/>   <!-- was 1080, scaled 50% -->
<meta property="twitter:player:width" content="960"/>
<meta property="twitter:player:height" content="540"/>
```

```json
{
  "id": "0",
  "type": "video",
  "url": "https://your-site.com/video.mp4",
  "preview_url": "https://your-site.com/thumbnail.jpg",
  "remote_url": null,
  "preview_remote_url": null,
  "text_url": null,
  "description": null,
  "meta": {
    "original": {
      "width": 960,
      "height": 540,
      "size": "960x540",
      "aspect": 1.778
    }
  }
}
```

### Multi-Image (Discord Only)

Discord supports rendering multiple images in a single embed by including multiple `twitter:image` / `og:image` meta tags in the HTML. This only works for Discord (check for `Discordbot` in User-Agent).

```html
<!-- Multiple image tags → Discord renders as a grid -->
<meta property="twitter:image" content="https://your-site.com/photo1.jpg"/>
<meta property="og:image" content="https://your-site.com/photo1.jpg"/>
<meta property="twitter:image" content="https://your-site.com/photo2.jpg"/>
<meta property="og:image" content="https://your-site.com/photo2.jpg"/>
```

For non-Discord clients or when multi-image isn't desired, include only the first image and add a counter to the OEmbed `author_name`:

```json
{ "author_name": "💬 42   🔁 100   ❤️ 5.2K   ―   Photo 1 / 3" }
```

### Text-Only Posts (No Media)

When there's no media, use the author's avatar as `og:image` and set `twitter:image` to `"0"`:

```html
<meta property="og:image" content="https://your-site.com/avatar.jpg"/>
<meta property="twitter:image" content="0"/>
```

The `twitter:image: "0"` is a known trick — Discord interprets this as "no image card" and renders the embed without an image preview, but still uses the Mastodon-style layout.

---

## Complete Implementation Example

### Route Setup (Express/Hono)

```javascript
// 1. Main embed page (HTML with meta tags)
app.get('/post/:id', async (req, res) => {
  const isDiscord = /discordbot/i.test(req.headers['user-agent'] || '')
  const post = await getPost(req.params.id)
  const author = post.author

  const head = []

  // Theme color → left border
  head.push(`<meta property="theme-color" content="#1DA1F2"/>`)

  // OpenGraph fallback (all clients)
  head.push(`<meta property="og:title" content="${author.name} (@${author.username})"/>`)
  head.push(`<meta property="og:description" content="${post.text}"/>`)

  // OEmbed link (controls author line + footer)
  const statsText = formatStats(post.stats) || 'Embed'
  head.push(`<link rel="alternate" href="/owoembed?text=${encodeURIComponent(statsText)}&author=${author.username}&status=${post.id}" type="application/json+oembed" title="${author.name}">`)

  // Activity+json link (Discord only — triggers Mastodon renderer)
  if (isDiscord) {
    head.push(`<link href="/users/${author.username}/statuses/${post.id}" rel="alternate" type="application/activity+json"/>`)
  }

  // Media meta tags
  if (post.video) {
    let mult = 1
    if (post.video.width > 1920 || post.video.height > 1920) mult = 0.5
    if (post.video.width < 400 && post.video.height < 400) mult = 2
    head.push(`<meta property="og:video" content="${post.video.url}"/>`)
    head.push(`<meta property="og:video:width" content="${post.video.width * mult}"/>`)
    head.push(`<meta property="og:video:height" content="${post.video.height * mult}"/>`)
  } else if (post.image) {
    head.push(`<meta property="og:image" content="${post.image.url}"/>`)
  }

  res.send(`<!DOCTYPE html><html><head>${head.join('')}</head><body></body></html>`)
})

// 2. Mastodon Status API
app.get('/api/v1/statuses/:id', async (req, res) => {
  const post = await getPost(req.params.id)
  res.json(buildMastodonStatus(post))
})

// 3. ActivityPub URL (same response)
app.get('/users/:handle/statuses/:id', async (req, res) => {
  const post = await getPost(req.params.id)
  res.json(buildMastodonStatus(post))
})

// 4. OEmbed endpoint
app.get('/owoembed', (req, res) => {
  const { text, author, status, provider } = req.query
  const statusUrl = `https://x.com/${author}/status/${status}`
  res.json({
    type: 'rich',
    version: '1.0',
    title: 'Embed',
    author_name: text || 'Embed',
    author_url: statusUrl,
    provider_name: provider || 'Your Site',
    provider_url: provider ? statusUrl : 'https://your-site.com'
  })
})
```

### Building the Mastodon Status JSON

```javascript
function buildMastodonStatus(post) {
  // Build HTML content
  let content = post.text
    .replace(/\n/g, '<br>\u200A\u200A')  // Line breaks with invisible padding
  content = linkifyUrls(content)
  content = linkifyMentions(content)
  content = linkifyHashtags(content)
  content += '<br><br>'

  // Append quote if present
  if (post.quote) {
    const quoteText = post.quote.text.replace(/\n/g, '<br>\u200A\u200A')
    content += `<blockquote><b>Quoting <a href="${post.quote.url}">${post.quote.author.name}</a> (<a href="${post.quote.author.profileUrl}">@${post.quote.author.username}</a>)</b><br>\u200A<br>${quoteText}</blockquote>`
  }

  // Append poll if present
  if (post.poll) {
    content += '<blockquote>'
    for (const choice of post.poll.choices) {
      const barLen = Math.round((choice.percentage / 100) * 32)
      const bar = '\u2588'.repeat(barLen)
      content += `${bar}<br><b>${choice.label}</b>&emsp;${choice.percentage}%<br>\u200A\u200A\u200A<br>\u200A`
    }
    content += `${post.poll.totalVotes} votes \u00B7 ${post.poll.timeLeft}</blockquote>`
  }

  // Append social proof
  const stats = buildSocialProofHtml(post.stats)
  if (stats) content += stats

  // Build media attachments
  const media = []
  if (post.video) {
    let mult = 1
    if (post.video.width > 1920 || post.video.height > 1920) mult = 0.5
    if (post.video.width < 400 && post.video.height < 400) mult = 2
    media.push({
      id: '0', type: 'video',
      url: post.video.url,
      preview_url: post.video.thumbnail || null,
      remote_url: null, preview_remote_url: null, text_url: null,
      description: null,
      meta: { original: {
        width: post.video.width * mult,
        height: post.video.height * mult,
        size: `${post.video.width * mult}x${post.video.height * mult}`,
        aspect: post.video.width / post.video.height
      }}
    })
  }
  for (const photo of (post.photos || [])) {
    media.push({
      id: '0', type: 'image',
      url: photo.url,
      preview_url: null,
      remote_url: null, preview_remote_url: null, text_url: null,
      description: photo.altText || null,
      meta: { original: {
        width: photo.width, height: photo.height,
        size: `${photo.width}x${photo.height}`,
        aspect: photo.width / photo.height
      }}
    })
  }

  return {
    id: post.id,
    url: post.url,
    uri: post.url,
    created_at: new Date(post.createdAt).toISOString(),
    edited_at: null,
    reblog: null,
    in_reply_to_id: post.replyToId || null,
    in_reply_to_account_id: null,
    language: post.language || 'en',
    content,
    spoiler_text: '',
    visibility: 'public',
    application: { name: post.source || 'Web', website: null },
    media_attachments: media,
    account: {
      id: post.author.id,
      display_name: post.author.name,
      username: post.author.username,
      acct: post.author.username,
      url: post.url,           // Status URL, not profile URL
      uri: post.url,           // Status URL, not profile URL
      created_at: new Date(post.author.joinedAt || Date.now()).toISOString(),
      locked: false, bot: false, discoverable: true,
      indexable: false, group: false,
      avatar: post.author.avatarUrl,
      avatar_static: post.author.avatarUrl,
      header: '', header_static: '',
      followers_count: post.author.followers || 0,
      following_count: post.author.following || 0,
      statuses_count: post.author.statuses || 0,
      hide_collections: false, noindex: false,
      emojis: [], roles: [], fields: []
    },
    mentions: [],
    tags: [],
    emojis: [],
    card: null,
    poll: null
  }
}

function buildSocialProofHtml(stats) {
  const parts = []
  if (stats.replies > 0)  parts.push(`💬 ${formatNumber(stats.replies)}`)
  if (stats.reposts > 0)  parts.push(`🔁 ${formatNumber(stats.reposts)}`)
  if (stats.likes > 0)    parts.push(`❤️ ${formatNumber(stats.likes)}`)
  if (stats.views > 0)    parts.push(`👁️ ${formatNumber(stats.views)}`)
  if (parts.length === 0) return null
  return `<b>${parts.join('&ensp;')}</b>`
}
```

---

## Important Notes

- **Only serve the activity+json `<link>` tag to Discord.** Check for `Discordbot` in the User-Agent. Other clients ignore it and don't need it.
- **The OEmbed `<link>` tag is safe for all clients.** Non-Discord clients will either use it for their own OEmbed rendering or ignore it.
- **`account.url` and `account.uri` should point to the status URL**, not the user's profile URL. This matches FxEmbed's behavior and controls where clicking the account section navigates in Discord.
- **This is undocumented Discord behavior.** It has been stable since its discovery but could change at any time.
- **The JSON must be well-formed.** Discord validates the structure and silently falls back to plain OpenGraph embeds if the JSON is malformed or missing required fields.
- **Both endpoints must return `Content-Type: application/json`.** Discord expects JSON from `/api/v1/statuses/:id`, `/users/:handle/statuses/:id`, and the OEmbed endpoint.
- **Keep your OpenGraph tags.** They serve as the fallback for non-Discord clients (Telegram, Slack, iMessage, etc.) and for Discord if the Mastodon detection fails.
- **OpenGraph video meta tags need the same dimension scaling** as the Mastodon JSON `media_attachments`. Discord reads both, and mismatched dimensions can cause rendering issues.

## License

MIT
