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

**You don't need to run Mastodon.** You just need to return the right JSON from two HTTP endpoints.

---

## How It Works

### The Flow

```
1. User pastes your URL in Discord

2. Discord's crawler (Discordbot) fetches the page

3. In the HTML <head>, Discord sees:
   <link rel="alternate" type="application/activity+json"
         href="https://your-site.com/users/handle/statuses/123"/>

4. Discord recognizes this as a Mastodon/ActivityPub instance

5. Discord calls: GET https://your-site.com/api/v1/statuses/123

6. Your server returns Mastodon-shaped JSON with an HTML "content" field:
   {
     "content": "<b>Bold text!</b><br>Line break<br><blockquote>A quote</blockquote>",
     "account": { ... },
     "media_attachments": [ ... ]
   }

7. Discord renders the HTML content with full formatting
```

### What You Need

Three things on your server:

1. **The `<link>` tag** in your embed page's `<head>`
2. **`GET /api/v1/statuses/:id`** — returns Mastodon-format JSON
3. **`GET /users/:handle/statuses/:id`** — the URL in the `<link>` tag, also returns Mastodon-format JSON

---

## Step 1: The Link Tag

Add this to the `<head>` of the HTML page that Discord's crawler fetches:

```html
<link href="https://your-site.com/users/johndoe/statuses/123"
      rel="alternate"
      type="application/activity+json"/>
```

**Only serve this to Discord.** Check for `Discordbot` in the User-Agent header. Other clients (Telegram, Slack, etc.) don't understand this tag and don't need it.

```javascript
const isDiscord = /discordbot/i.test(userAgent)

if (isDiscord) {
  head += `<link href="${baseUrl}/users/${handle}/statuses/${id}" rel="alternate" type="application/activity+json"/>`
}
```

You should still include your standard OpenGraph tags (`og:title`, `og:description`, `og:image`, etc.) for non-Discord clients and as a fallback.

---

## Step 2: The Mastodon API Endpoint

Discord calls `GET /api/v1/statuses/:id` after detecting the link tag. Return a JSON object matching the Mastodon Status entity format.

### Minimal Response

The bare minimum Discord needs:

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
    "url": "https://original-site.com/@johndoe",
    "avatar": "https://original-site.com/avatars/johndoe.jpg",
    "avatar_static": "https://original-site.com/avatars/johndoe.jpg"
  },
  "media_attachments": [],
  "mentions": [],
  "tags": [],
  "emojis": []
}
```

### Full Response

The complete Mastodon Status entity with all fields Discord may read:

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
  "content": "<b>Bold text</b><br><br>Regular text<br><blockquote>A quote</blockquote><br><a href=\"https://example.com\">A link</a>",
  "spoiler_text": "",
  "visibility": "public",
  "application": {
    "name": "Your App Name",
    "website": null
  },
  "media_attachments": [
    {
      "id": "photo_0",
      "type": "image",
      "url": "https://original-site.com/images/photo.jpg",
      "preview_url": "https://original-site.com/images/photo.jpg",
      "remote_url": null,
      "preview_remote_url": null,
      "text_url": null,
      "description": "Alt text for the image",
      "meta": {
        "original": {
          "width": 1200,
          "height": 800,
          "size": "1200x800",
          "aspect": 1.5
        }
      }
    }
  ],
  "account": {
    "id": "456",
    "display_name": "John Doe",
    "username": "johndoe",
    "acct": "johndoe",
    "url": "https://original-site.com/@johndoe",
    "uri": "https://original-site.com/@johndoe",
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

### Media Attachment Types

The `type` field in `media_attachments` determines how Discord renders the media:

| Type | Use for |
|------|---------|
| `"image"` | Photos, static images |
| `"video"` | Video files |
| `"gifv"` | GIF animations |
| `"audio"` | Audio files |

---

## Step 3: The ActivityPub URL

The URL in the `<link>` tag (`/users/:handle/statuses/:id`) — Discord may fetch this directly. Return the same Mastodon Status JSON with `Content-Type: application/json`.

---

## Supported HTML in `content`

Discord's Mastodon embed renderer parses the `content` field as HTML. These tags are supported:

| HTML | Renders as | Example |
|------|------------|---------|
| `<b>text</b>` | **bold** | `<b>important</b>` |
| `<strong>text</strong>` | **bold** | `<strong>important</strong>` |
| `<i>text</i>` | *italic* | `<i>emphasis</i>` |
| `<em>text</em>` | *italic* | `<em>emphasis</em>` |
| `<br>` | line break | `line one<br>line two` |
| `<blockquote>text</blockquote>` | quote block | `<blockquote>quoted text</blockquote>` |
| `<a href="url">text</a>` | clickable link | `<a href="https://example.com">click here</a>` |
| `<code>text</code>` | `inline code` | `<code>variable</code>` |
| `<pre>text</pre>` | code block | `<pre>code block</pre>` |

### Content Examples

**Social proof stats with bold:**
```html
Post text goes here<br><br><b>💬 42&ensp;🔁 100&ensp;❤️ 5.2K&ensp;👁️ 1.2M</b>
```

**Quote block:**
```html
Original post text<br><br><blockquote><b>Quoted Author</b> (@handle)<br>The quoted text</blockquote>
```

**Mixed formatting:**
```html
<b>Breaking:</b> Something happened<br><br>Read more at <a href="https://example.com">example.com</a><br><br><i>Source: Reuters</i>
```

---

## Important Notes

- **Only serve the `<link>` tag to Discord.** Check for `Discordbot` in the User-Agent. Other clients ignore it.
- **This is undocumented Discord behavior.** It has been stable since its discovery but could change at any time. There is no official Discord documentation for this technique.
- **The JSON must be well-formed.** Discord validates the structure and silently falls back to plain OpenGraph embeds if the JSON is malformed or missing required fields.
- **Both endpoints must return `Content-Type: application/json`.** Discord expects JSON responses from both `/api/v1/statuses/:id` and `/users/:handle/statuses/:id`.
- **Keep your OpenGraph tags.** They serve as the fallback for non-Discord clients (Telegram, Slack, iMessage, etc.) and for Discord if the Mastodon detection fails.

## License

MIT
