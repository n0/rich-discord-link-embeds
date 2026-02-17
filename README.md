# rich-discord-link-embeds

**Markdown in Discord link embeds.** Bold, italic, links, blockquotes, code — in link preview descriptions. Something impossible with standard OpenGraph.

This library generates Mastodon API v1-compatible status JSON that Discord's embed renderer parses as rich HTML. It's the only known method to get formatted text in Discord link previews.

## The Problem

Discord renders `og:description` as plain text. No formatting. No bold. No links. No line breaks. Just a flat string.

```html
<!-- This is ALL you get with standard OpenGraph -->
<meta property="og:description" content="Plain text. No formatting possible."/>
```

## The Solution

Discord has built-in support for Mastodon embeds. When it detects a Mastodon-compatible server, it switches to a renderer that parses HTML content with full formatting support.

You don't need to run Mastodon. You just need to return the right JSON from two endpoints.

## How It Works

```
1. User pastes your URL in Discord

2. Discord's crawler fetches the page, sees:
   <link rel="alternate" type="application/activity+json"
         href="https://your-site.com/users/handle/statuses/123"/>

3. Discord thinks: "This is a Mastodon instance"

4. Discord calls: GET /api/v1/statuses/123

5. Your server returns Mastodon-format JSON:
   { "content": "<b>Bold!</b><br>New line<br><a href='...'>Link</a>", ... }

6. Discord renders it with full formatting
```

This library handles step 5 — generating the correctly-shaped Mastodon status JSON from a simple typed interface.

## Install

```bash
npm install rich-discord-link-embeds
```

## Quick Start

```typescript
import { createStatus, createActivityLink, isDiscordBot, textToHtml } from 'rich-discord-link-embeds'

const BASE_URL = 'https://your-site.com'

// 1. Add the <link> tag to your embed page (only for Discord)
app.get('/post/:id', async (req, res) => {
  const ua = req.headers['user-agent']
  const post = await getPost(req.params.id)

  let head = `<meta property="og:title" content="${post.title}"/>`

  if (isDiscordBot(ua)) {
    head += createActivityLink({
      baseUrl: BASE_URL,
      authorHandle: post.author.handle,
      statusId: post.id,
    })
  }

  res.send(`<!DOCTYPE html><html><head>${head}</head><body></body></html>`)
})

// 2. Serve the Mastodon API endpoint
app.get('/api/v1/statuses/:id', async (req, res) => {
  const post = await getPost(req.params.id)

  res.json(createStatus({
    id: post.id,
    url: post.url,
    content: `${textToHtml(post.text)}<br><br><b>❤️ ${post.likes}   🔁 ${post.reposts}</b>`,
    author: {
      id: post.author.id,
      displayName: post.author.name,
      username: post.author.handle,
      avatarUrl: post.author.avatar,
    },
    media: post.images.map(img => ({
      type: 'image' as const,
      url: img.url,
      width: img.width,
      height: img.height,
    })),
  }))
})

// 3. Serve the ActivityPub URL (the <link> tag points here)
app.get('/users/:handle/statuses/:id', async (req, res) => {
  const post = await getPost(req.params.id)

  res.json(createStatus({
    id: post.id,
    url: post.url,
    content: textToHtml(post.text),
    author: {
      id: post.author.id,
      displayName: post.author.name,
      username: post.author.handle,
    },
  }))
})
```

That's it. Discord will now render your link embeds with formatted text.

## API

### `createStatus(options: StatusOptions): MastodonStatus`

The core function. Takes your data, returns a Mastodon API v1 Status object. Serve this as JSON from your endpoints.

```typescript
const status = createStatus({
  id: '123',
  url: 'https://example.com/post/123',
  content: '<b>Bold</b><br>Line break<br><blockquote>Quote</blockquote>',
  createdAt: '2024-01-15T12:00:00Z',  // optional, defaults to now
  language: 'en',                       // optional, defaults to "en"
  applicationName: 'My App',            // optional, defaults to "Web"

  author: {
    id: '456',
    displayName: 'John Doe',
    username: 'johndoe',
    url: 'https://example.com/@johndoe',       // optional
    avatarUrl: 'https://example.com/avatar.jpg', // optional
    bannerUrl: 'https://example.com/banner.jpg', // optional
    followersCount: 1000,                        // optional
    followingCount: 500,                         // optional
    statusesCount: 5000,                         // optional
  },

  media: [{                             // optional
    type: 'image',
    url: 'https://example.com/photo.jpg',
    width: 1200,
    height: 800,
    altText: 'A photo',
  }],

  replyToId: '122',                     // optional
  spoilerText: '',                      // optional
  visibility: 'public',                // optional
})
```

### `createActivityLink(options: ActivityLinkOptions): string`

Returns the `<link>` tag that triggers Discord's Mastodon detection. Add this to the `<head>` of your embed page.

Only include it for Discord requests — use `isDiscordBot()` to check.

```typescript
const link = createActivityLink({
  baseUrl: 'https://your-site.com',
  authorHandle: 'johndoe',
  statusId: '123',
})
// => '<link href="https://your-site.com/users/johndoe/statuses/123" rel="alternate" type="application/activity+json"/>'
```

### `isDiscordBot(userAgent: string | null | undefined): boolean`

Returns `true` if the User-Agent matches Discord's embed crawler (`Discordbot`).

```typescript
if (isDiscordBot(req.headers['user-agent'])) {
  // serve mastodon-compatible response
}
```

### `textToHtml(text: string): string`

Converts plain text to HTML safe for the `content` field. Escapes `<`, `>`, `&` and converts `\n` to `<br>`.

```typescript
textToHtml('Hello\nWorld & "friends"')
// => 'Hello<br>World &amp; &quot;friends&quot;'
```

### `escapeHtml(text: string): string`

Escapes `&`, `"`, `<`, `>` for safe inclusion in HTML attributes.

## Supported Formatting

| HTML | Discord renders as |
|------|-------------------|
| `<b>text</b>` | **bold** |
| `<strong>text</strong>` | **bold** |
| `<i>text</i>` | *italic* |
| `<em>text</em>` | *italic* |
| `<br>` | line break |
| `<blockquote>text</blockquote>` | quote block |
| `<a href="url">text</a>` | clickable link |
| `<code>text</code>` | `inline code` |
| `<pre>text</pre>` | code block |

## Required Server Endpoints

For Discord to render your embeds with formatting, you need three things:

### 1. The `<link>` tag in your embed page

Discord's crawler fetches your URL and looks for this in the HTML `<head>`:

```html
<link href="https://your-site.com/users/handle/statuses/123"
      rel="alternate" type="application/activity+json"/>
```

Use `createActivityLink()` to generate this. Gate it behind `isDiscordBot()` — other clients don't need it.

### 2. `GET /api/v1/statuses/:id`

Discord calls this endpoint after detecting the link tag. Return `createStatus()` as JSON.

### 3. `GET /users/:handle/statuses/:id`

The URL from the `<link>` tag. Discord may fetch this directly. Return the same `createStatus()` JSON.

## Framework Examples

### Hono

```typescript
import { Hono } from 'hono'
import { createStatus, createActivityLink, isDiscordBot, textToHtml } from 'rich-discord-link-embeds'

const app = new Hono()
const BASE_URL = 'https://your-site.com'

app.get('/api/v1/statuses/:id', async (c) => {
  const post = await fetchPost(c.req.param('id'))
  return c.json(createStatus({
    id: post.id,
    url: post.url,
    content: `${textToHtml(post.text)}<br><br><b>❤️ ${post.likes}</b>`,
    author: {
      id: post.authorId,
      displayName: post.authorName,
      username: post.authorHandle,
      avatarUrl: post.authorAvatar,
    },
  }))
})

app.get('/users/:handle/statuses/:id', async (c) => {
  const post = await fetchPost(c.req.param('id'))
  return c.json(createStatus({
    id: post.id,
    url: post.url,
    content: textToHtml(post.text),
    author: {
      id: post.authorId,
      displayName: post.authorName,
      username: post.authorHandle,
    },
  }))
})

app.get('/post/:id', async (c) => {
  const ua = c.req.header('User-Agent')
  const post = await fetchPost(c.req.param('id'))

  let head = `<meta property="og:title" content="${post.title}"/>`
  head += `<meta property="og:description" content="${post.text}"/>`

  if (isDiscordBot(ua)) {
    head += createActivityLink({
      baseUrl: BASE_URL,
      authorHandle: post.authorHandle,
      statusId: post.id,
    })
  }

  return c.html(`<!DOCTYPE html><html><head>${head}</head><body></body></html>`)
})
```

### Express

```typescript
import express from 'express'
import { createStatus, createActivityLink, isDiscordBot, textToHtml } from 'rich-discord-link-embeds'

const app = express()
const BASE_URL = 'https://your-site.com'

app.get('/api/v1/statuses/:id', async (req, res) => {
  const post = await fetchPost(req.params.id)
  res.json(createStatus({
    id: post.id,
    url: post.url,
    content: textToHtml(post.text),
    author: {
      id: post.authorId,
      displayName: post.authorName,
      username: post.authorHandle,
    },
  }))
})

app.get('/users/:handle/statuses/:id', async (req, res) => {
  const post = await fetchPost(req.params.id)
  res.json(createStatus({
    id: post.id,
    url: post.url,
    content: textToHtml(post.text),
    author: {
      id: post.authorId,
      displayName: post.authorName,
      username: post.authorHandle,
    },
  }))
})

app.get('/post/:id', async (req, res) => {
  const post = await fetchPost(req.params.id)
  let head = `<meta property="og:title" content="${post.title}"/>`

  if (isDiscordBot(req.headers['user-agent'])) {
    head += createActivityLink({
      baseUrl: BASE_URL,
      authorHandle: post.authorHandle,
      statusId: post.id,
    })
  }

  res.send(`<!DOCTYPE html><html><head>${head}</head><body></body></html>`)
})
```

### Fastify

```typescript
import Fastify from 'fastify'
import { createStatus, createActivityLink, isDiscordBot, textToHtml } from 'rich-discord-link-embeds'

const app = Fastify()
const BASE_URL = 'https://your-site.com'

app.get('/api/v1/statuses/:id', async (req) => {
  const { id } = req.params as { id: string }
  const post = await fetchPost(id)
  return createStatus({
    id: post.id,
    url: post.url,
    content: textToHtml(post.text),
    author: {
      id: post.authorId,
      displayName: post.authorName,
      username: post.authorHandle,
    },
  })
})

app.get('/users/:handle/statuses/:id', async (req) => {
  const { id } = req.params as { id: string }
  const post = await fetchPost(id)
  return createStatus({
    id: post.id,
    url: post.url,
    content: textToHtml(post.text),
    author: {
      id: post.authorId,
      displayName: post.authorName,
      username: post.authorHandle,
    },
  })
})

app.get('/post/:id', async (req, reply) => {
  const { id } = req.params as { id: string }
  const post = await fetchPost(id)
  let head = `<meta property="og:title" content="${post.title}"/>`

  if (isDiscordBot(req.headers['user-agent'] as string)) {
    head += createActivityLink({
      baseUrl: BASE_URL,
      authorHandle: post.authorHandle,
      statusId: post.id,
    })
  }

  reply.type('text/html')
  return `<!DOCTYPE html><html><head>${head}</head><body></body></html>`
})
```

## Notes

- The `<link>` tag should only be served to Discord (`isDiscordBot()`). Other clients ignore it.
- This is an undocumented Discord behavior. It has been stable since its discovery but could change.
- The Mastodon status JSON must be well-formed. Discord validates the structure and falls back to plain OpenGraph if it's malformed.
- Both `/api/v1/statuses/:id` and `/users/:handle/statuses/:id` should return `Content-Type: application/json`.

## License

MIT
