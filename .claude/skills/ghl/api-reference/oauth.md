# GoHighLevel -- OAuth 2.0

## Overview

GHL supports OAuth 2.0 Authorization Code Grant for marketplace apps. This is used when building multi-tenant apps that need to access GHL resources on behalf of multiple locations/agencies (as opposed to Private Integration Tokens which are single-account).

Use OAuth when building multi-tenant marketplace apps that need to access multiple GHL sub-accounts.

---

## OAuth Flow (Step by Step)

1. **Register app** at [marketplace.gohighlevel.com](https://marketplace.gohighlevel.com)
   - Sign up for a developer account
   - Go to "My Apps" > "Create App"
   - Configure scopes, redirect URI, generate client_id and client_secret

2. **Generate authorization URL** and redirect the user to it

3. **User authorizes** -- selects a location/agency, grants access

4. **User redirected to your callback URL** with an authorization `code` query parameter

5. **Exchange code for tokens** via `POST /oauth/token`

6. **Use access token** for API calls (`Authorization: Bearer <access_token>`)

7. **Refresh token before expiry** -- access tokens valid 24 hours, refresh tokens valid 1 year (single-use)

---

## Authorization URL

Redirect users here to initiate the OAuth flow:

### Standard (GHL-branded)
```
https://marketplace.gohighlevel.com/oauth/chooselocation?
  response_type=code&
  redirect_uri=https://myapp.com/oauth/callback/gohighlevel&
  client_id=CLIENT_ID_WITH_SUFFIX&
  scope=contacts.readonly contacts.write opportunities.readonly
```

### White-label (LeadConnector-branded)
```
https://marketplace.leadconnectorhq.com/oauth/chooselocation?
  response_type=code&
  redirect_uri=https://myapp.com/oauth/callback/gohighlevel&
  client_id=CLIENT_ID_WITH_SUFFIX&
  scope=contacts.readonly contacts.write opportunities.readonly
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| response_type | Yes | Always `code` |
| redirect_uri | Yes | Your callback URL (must match app config) |
| client_id | Yes | Your app's client ID **with suffix** (see below) |
| scope | Yes | Space-separated list of scopes |

### Optional Parameters

- `&loginWindowOpenMode=self` -- Opens login in the same tab instead of a new tab (default is new tab)

### Callback

After authorization, user is redirected to:
```
https://myapp.com/oauth/callback/gohighlevel?code=7676cjcbdc6t76cdcbkjcd09821jknnkj
```

Extract the `code` parameter and exchange it for tokens.

---

## CRITICAL: client_id Format

The client_id from the GHL marketplace app settings includes a suffix:
```
696fcc63fb358f076dabbeb9-mkmyb9tr
^-- version_id / app ID --^ ^suffix^
```

- The **FULL client_id WITH suffix** must be used in both the authorization URL AND token exchange
- The part before the dash is the `version_id` (app ID)
- Install links from GHL marketplace include both `client_id` (with suffix) and `version_id` (without suffix) as separate parameters
- **Using only the version_id without the suffix will fail**

---

## Token Exchange -- POST /oauth/token

Exchange an authorization code for access and refresh tokens.

```
POST https://services.leadconnectorhq.com/oauth/token
Content-Type: application/x-www-form-urlencoded
```

### Request Body (form-urlencoded)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| client_id | string | Yes | Your app's client ID **with suffix** |
| client_secret | string | Yes | Your app's client secret |
| grant_type | string | Yes | `authorization_code` |
| code | string | Yes* | The authorization code from the callback |
| user_type | string | No | `Location` or `Company` (case-sensitive) |
| redirect_uri | string | No | Your callback URL (recommended) |

### Example (curl)

```bash
curl -s -X POST "https://services.leadconnectorhq.com/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=696fcc63fb358f076dabbeb9-mkmyb9tr" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "grant_type=authorization_code" \
  -d "code=7676cjcbdc6t76cdcbkjcd09821jknnkj" \
  -d "user_type=Location" \
  -d "redirect_uri=https://myapp.com/oauth/callback/gohighlevel"
```

### Response (200)

```json
{
  "access_token": "ab12dc0ae1234a7898f9ff06d4f69gh",
  "token_type": "Bearer",
  "expires_in": 86399,
  "refresh_token": "xy34dc0ae1234a4858f9ff06d4f66ba",
  "scope": "contacts.readonly contacts.write opportunities.readonly",
  "userType": "Location",
  "locationId": "l1C08ntBrFjLS0elLIYU",
  "companyId": "l1C08ntBrFjLS0elLIYU",
  "userId": "l1C08ntBrFjLS0elLIYU",
  "isBulkInstallation": false,
  "approvedLocations": ["l1C08ntBrFjLS0elLIYU"],
  "planId": "l1C08ntBrFjLS0elLIYU"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| access_token | string | Bearer token for API calls |
| token_type | string | Always `Bearer` |
| expires_in | number | Seconds until expiry (86399 = ~24 hours) |
| refresh_token | string | Single-use token for refreshing (valid 1 year) |
| scope | string | Space-separated scopes granted |
| userType | string | `Location` or `Company` |
| locationId | string | Location ID (present for Location tokens) |
| companyId | string | Company/Agency ID |
| userId | string | User ID of person who installed the app |
| isBulkInstallation | boolean | Whether installed on multiple locations at once |
| approvedLocations | string[] | Location IDs approved for token generation |
| planId | string | Plan ID (for paid marketplace apps) |

### Errors

| Status | Meaning |
|--------|---------|
| 400 | Bad request -- check client_id, client_secret, code |
| 401 | Unauthorized -- invalid credentials |
| 422 | Unprocessable -- code may be expired or already used |

---

## Token Refresh -- POST /oauth/token

Refresh an expired access token using the refresh token.

**CRITICAL: Refresh tokens are SINGLE-USE.** Each refresh returns a NEW refresh_token. You must store the new refresh_token immediately. Using an old refresh token will fail.

```
POST https://services.leadconnectorhq.com/oauth/token
Content-Type: application/x-www-form-urlencoded
```

### Request Body (form-urlencoded)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| client_id | string | Yes | Your app's client ID **with suffix** |
| client_secret | string | Yes | Your app's client secret |
| grant_type | string | Yes | `refresh_token` |
| refresh_token | string | Yes | The current refresh token |
| user_type | string | No | `Location` or `Company` (case-sensitive) |

### Example (curl)

```bash
curl -s -X POST "https://services.leadconnectorhq.com/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=696fcc63fb358f076dabbeb9-mkmyb9tr" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=xy34dc0ae1234a4858f9ff06d4f66ba" \
  -d "user_type=Location"
```

### Response

Same format as the token exchange response. **Save the new `refresh_token` immediately.**

### Recommended Refresh Strategy

1. Make an API request with the current access_token
2. If you get a 401 (expired), call the refresh endpoint
3. Save both the new access_token AND the new refresh_token
4. Retry the original API request with the new access_token
5. Implement this as a wrapper function around all API calls

---

## Location Token -- POST /oauth/locationToken

Generate a location-level access token from an agency-level access token. Used for agency/bulk installs where you have an agency token but need to make API calls for a specific location.

**Requires:** Agency access token with `oauth.write` scope.

```
POST https://services.leadconnectorhq.com/oauth/locationToken
Version: 2021-07-28
Content-Type: application/x-www-form-urlencoded
Authorization: Bearer AGENCY_ACCESS_TOKEN
```

### Request Body (form-urlencoded)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| companyId | string | Yes | The agency/company ID |
| locationId | string | Yes | The location ID to generate a token for |

### Example (curl)

```bash
curl -s -X POST "https://services.leadconnectorhq.com/oauth/locationToken" \
  -H "Authorization: Bearer $AGENCY_TOKEN" \
  -H "Version: 2021-07-28" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "companyId=COMPANY_ID" \
  -d "locationId=LOCATION_ID"
```

### Response (200)

```json
{
  "access_token": "ab12dc0ae1234a7898f9ff06d4f69gh",
  "token_type": "Bearer",
  "expires_in": 86399,
  "scope": "contacts.readonly contacts.write",
  "locationId": "l1C08ntBrFjLS0elLIYU",
  "userId": "l1C08ntBrFjLS0elLIYU",
  "planId": "l1C08ntBrFjLS0elLIYU"
}
```

---

## Get Installed Locations -- GET /oauth/installedLocations

Fetch the list of locations where your app is installed. Useful for agency-level apps that manage multiple locations.

**Requires:** Agency access token with `oauth.readonly` scope.

```
GET https://services.leadconnectorhq.com/oauth/installedLocations
Version: 2021-07-28
Authorization: Bearer AGENCY_ACCESS_TOKEN
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| companyId | string | Yes | Agency/company ID |
| appId | string | Yes | Your app ID |
| versionId | string | No | App version ID |
| isInstalled | boolean | No | Filter by installation status |
| onTrial | boolean | No | Filter by trial status |
| planId | string | No | Filter by plan ID |
| query | string | No | Search location by name |
| skip | string | No | Pagination offset (default: 0) |
| limit | string | No | Results per page (default: 20) |

### Example (curl)

```bash
curl -s -X GET "https://services.leadconnectorhq.com/oauth/installedLocations?companyId=COMPANY_ID&appId=APP_ID&isInstalled=true" \
  -H "Authorization: Bearer $AGENCY_TOKEN" \
  -H "Version: 2021-07-28" \
  -H "Accept: application/json"
```

### Response (200)

```json
{
  "locations": [
    {
      "_id": "0IHuJvc2ofPAAA8GzTRi",
      "name": "John Deo",
      "address": "47 W 13th St, New York, NY 10011, USA",
      "isInstalled": true
    }
  ],
  "count": 1231,
  "installToFutureLocations": true
}
```

---

## Rate Limits

OAuth API calls are rate-limited per marketplace app per location/company:

| Limit Type | Value |
|------------|-------|
| **Burst** | 100 requests per 10 seconds |
| **Daily** | 200,000 requests per day |

### Rate Limit Headers

| Header | Description |
|--------|-------------|
| X-RateLimit-Limit-Daily | Your daily limit |
| X-RateLimit-Daily-Remaining | Remaining requests for the day |
| X-RateLimit-Interval-Milliseconds | Time interval for burst requests |
| X-RateLimit-Max | Max requests in current interval |
| X-RateLimit-Remaining | Remaining requests in current interval |

Rate limits are per app per resource (location or company). If your app is installed on 2 locations, each location gets its own 200,000/day limit independently.

---

## Scopes Reference

Scopes are space-separated in the authorization URL. Common scopes for voice agent integrations:

| Scope | Access | Description |
|-------|--------|-------------|
| contacts.readonly | Sub-Account | Read contacts, tasks, notes, appointments |
| contacts.write | Sub-Account | Create/update/delete contacts, tasks, notes, tags |
| opportunities.readonly | Sub-Account | Search opportunities, get pipelines |
| opportunities.write | Sub-Account | Create/update/delete opportunities |
| locations.readonly | Sub-Account, Agency | Get location details |
| locations/customFields.readonly | Sub-Account | Read custom fields |
| locations/customFields.write | Sub-Account | Create/update custom fields |
| locations/customValues.readonly | Sub-Account | Read custom values |
| calendars.readonly | Sub-Account | Read calendars, free slots |
| calendars/events.readonly | Sub-Account | Read appointments |
| calendars/events.write | Sub-Account | Create/update appointments |
| conversations.readonly | Sub-Account | Read conversations |
| conversations/message.readonly | Sub-Account | Read messages (+ InboundMessage/OutboundMessage webhooks) |
| conversations/message.write | Sub-Account | Send messages |
| users.readonly | Sub-Account, Agency | List/get users |
| workflows.readonly | Sub-Account | List workflows |
| oauth.readonly | Agency | Get installed locations |
| oauth.write | Agency | Generate location tokens |

For the full scopes table (60+ scopes), see `Scopes.md` in the GHL API docs repo.

---

## Webhook Authentication

GHL signs webhook payloads with a digital signature for verification:

- Header: `x-wh-signature` contains the base64-encoded SHA256 signature
- Payload includes `timestamp` and `webhookId` fields
- Verify using GHL's public key (RSA 4096-bit, published in their docs)
- Protect against replay attacks by checking `timestamp` freshness (5-minute window) and rejecting duplicate `webhookId` values

### Verification (Node.js)

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, publicKey) {
  const verifier = crypto.createVerify('SHA256');
  verifier.update(payload);
  verifier.end();
  return verifier.verify(publicKey, signature, 'base64');
}
```

---

## External Billing (Paid Marketplace Apps)

For apps with external billing (not using GHL's internal billing):

1. User installs app and is redirected to your Billing URL with `clientId`, `installType`, `locationId`, `companyId`
2. Process payment on your end
3. Call `POST https://services.leadconnectorhq.com/oauth/billing/webhook` with payment confirmation
4. Headers: `x-ghl-client-key`, `x-ghl-client-secret`, `Content-Type: application/json`
5. Body: `clientId`, `authType` (company/location), `locationId`, `companyId`, `amount`, `status` (COMPLETED/FAILED), `paymentType` (one_time/recurring)

---

## Common Gotchas

1. **client_id MUST include the suffix** -- The part after the dash (e.g., `-mkmyb9tr`) is required. Using only the version_id will fail.

2. **Refresh tokens are single-use** -- Each refresh returns a NEW refresh_token. Always store the new one immediately. Using an old refresh token fails silently or returns an error.

3. **Access tokens expire in 24 hours** -- Plan for automatic refresh. Don't assume tokens last longer.

4. **Refresh tokens expire in 1 year** -- If unused for 1 year, the user must re-authorize.

5. **user_type is case-sensitive** -- Must be exactly `Location` or `Company`, not lowercase.

6. **White-label users must use leadconnectorhq.com** -- The `gohighlevel.com` domain won't work for white-label agency users. Use `marketplace.leadconnectorhq.com` for the auth URL.

7. **Token endpoint uses form-urlencoded** -- NOT JSON. The Content-Type must be `application/x-www-form-urlencoded`.

8. **Version header on locationToken and installedLocations** -- These endpoints require `Version: 2021-07-28` header. The base `/oauth/token` endpoint does not.

9. **Standard traceId in responses** -- Every GHL API response includes a `traceId` field useful for debugging with GHL support.

10. **Scopes must match exactly** -- The scopes in the authorization URL must match what's configured in your marketplace app settings. Extra or misspelled scopes will cause errors.

---

## Token Expiry Summary

| Token | Lifetime | Notes |
|-------|----------|-------|
| Access token | 24 hours (86,399 seconds) | Refresh before expiry |
| Refresh token | 1 year | Single-use; each refresh returns a new one |
| Authorization code | Short-lived (minutes) | Use immediately after receiving |

---

## OAuth vs Private Integration Token

| Feature | OAuth 2.0 | Private Integration Token |
|---------|-----------|--------------------------|
| Use case | Multi-tenant marketplace apps | Single-account internal tools |
| Setup | Register app, implement auth flow | Copy token from GHL dashboard |
| Token expiry | 24 hours (must refresh) | Never (until manually revoked) |
| Multi-location | Yes (via agency tokens) | No (scoped to one account) |
| Format | JWT-like string | `pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| Example usage | Multi-tenant SaaS app | Single-account internal tool |
