# GoHighLevel -- Authentication

## API v2 Authentication

**Method:** Bearer Token via HTTP Authorization header

All GHL API v2 requests require three headers:

```http
GET /contacts/ HTTP/1.1
Host: services.leadconnectorhq.com
Authorization: Bearer YOUR_TOKEN
Version: 2021-07-28
Accept: application/json
```

For POST/PATCH/PUT, also include:
```http
Content-Type: application/json
```

## Auth Methods

### 1. Private Integration Token

Static token created in GHL dashboard. Best for internal tools and single-account use.

- **Create:** Agency Settings > Private Integrations > Create Integration > Add scopes > Save
- **Format:** `pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **No expiry** -- valid until manually revoked
- **Scoped** to the agency or sub-account where created

### 2. OAuth 2.0 (Marketplace apps)

For multi-tenant marketplace apps.

- Auth URL: `https://marketplace.gohighlevel.com/oauth/chooselocation`
- Token URL: `https://services.leadconnectorhq.com/oauth/token`
- Refresh tokens are **single-use** -- each refresh returns a new refresh token
- See `voice-analytics-project/src/lib/ghl.ts` for the full OAuth implementation

## Config File

Location: `~/.config/ghl/config.json`

```json
{
  "token": "pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "locationId": "your_location_id",
  "userId": "your_user_id"
}
```

- `token` -- Private Integration Token
- `locationId` -- GHL sub-account/location ID (required for most API calls)
- `userId` -- Your user ID within the location (required for sending documents)

### Finding Your IDs

- **locationId:** Settings > Business Info > look at the URL, or Agency > Sub-Accounts
- **userId:** Settings > My Staff > click your name > look at URL

## Security

- Config file lives outside any git repo (`~/.config/`)
- Never log or display tokens in output
- Never commit tokens to version control

## Required Scopes for Quote Sending

When creating a Private Integration Token, enable these scopes:
- `contacts.readonly` -- search and view contacts
- `opportunities.readonly` -- link documents to opportunities
- `documents` (or equivalent proposals scope) -- list and send templates

## Version Header

**CRITICAL:** The `Version: 2021-07-28` header is required on ALL v2 API calls. Omitting it causes silent failures or unexpected response formats.
