---
name: ghl
description: GoHighLevel (GHL) API reference for managing contacts, sending documents/contracts, working with opportunities, and financial data (invoices, payments, subscriptions). Use when building GHL integrations, sending quotes, managing CRM data, or pulling financial reports.
user-invocable: true
---

# GoHighLevel API Skill

Manage GoHighLevel CRM and financial operations -- send quotes/contracts, search contacts, manage opportunities, list invoices/subscriptions/transactions -- via the GHL REST API v2.

## How to Use This Skill

**Invocation:** `/ghl <command>`

Examples:
```
/ghl list templates
/ghl search contacts "John Smith"
/ghl send quote
```

---

## Step 0: Authenticate (ALWAYS do this first)

GHL uses Private Integration Tokens (static Bearer tokens) for API access.

1. **Read the config file:**
   ```
   Read ~/.config/ghl/config.json
   ```

2. **Config format:**
   ```json
   {
     "token": "pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
     "locationId": "location_id_here",
     "userId": "user_id_here"
   }
   ```

3. **Use in every request:**
   ```bash
   TOKEN="pit-xxx..."
   ```

4. **If config missing**, tell the user:
   > "GHL config not found. Create `~/.config/ghl/config.json` with your Private Integration Token, locationId, and userId."

5. **To get a Private Integration Token:** Agency Settings > Private Integrations > Create > Add scopes > Save > Copy token.

---

## Quick Reference

- **Base URL:** `https://services.leadconnectorhq.com`
- **Auth header:** `Authorization: Bearer <TOKEN>`
- **Version header:** `Version: 2021-07-28` (REQUIRED on all requests)
- **Content-Type:** `application/json`
- **Accept:** `application/json`
- **Merge fields:** Templates use `{{contact.name}}`, `{{opportunity.custom_field}}` etc. -- auto-populated from linked records on send

---

## Common Operations

### List Document/Contract Templates

```bash
curl -s -X GET "https://services.leadconnectorhq.com/proposals/templates?locationId=$LOCATION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-07-28" \
  -H "Accept: application/json"
```

Returns array of templates with IDs and names. Use template IDs when sending.

---

### Send Template (Send a Quote/Contract)

```bash
curl -s -X POST "https://services.leadconnectorhq.com/proposals/templates/send" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-07-28" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "templateId": "template_id_here",
    "userId": "user_id_here",
    "sendDocument": true,
    "locationId": "location_id_here",
    "contactId": "contact_id_here",
    "opportunityId": "opportunity_id_here"
  }'
```

**Required fields:** `templateId`, `userId`, `locationId`, `contactId`
**Optional fields:** `sendDocument` (boolean), `opportunityId`

- `sendDocument: true` sends immediately; `false` (or omit) creates as draft
- `opportunityId` links the document to an opportunity -- merge fields from that opportunity will populate
- Merge fields like `{{contact.name}}` auto-populate from the contact/opportunity records

---

### Search Contacts

```bash
curl -s -X GET "https://services.leadconnectorhq.com/contacts/?locationId=$LOCATION_ID&query=John&limit=20" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-07-28" \
  -H "Accept: application/json"
```

**Query params:** `locationId` (required), `query` (search string), `limit` (max results)

---

### Get Single Contact

```bash
curl -s -X GET "https://services.leadconnectorhq.com/contacts/$CONTACT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-07-28" \
  -H "Accept: application/json"
```

---

### Search Opportunities

```bash
curl -s -X GET "https://services.leadconnectorhq.com/opportunities/search?location_id=$LOCATION_ID&q=CompanyName" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-07-28" \
  -H "Accept: application/json"
```

---

## Quote Sending Workflow (End-to-End)

1. **List templates** -- `GET /proposals/templates?locationId=X`
2. **Pick a template** by name/ID
3. **Search for contact** -- `GET /contacts/?locationId=X&query=name`
4. **Optionally find opportunity** -- `GET /opportunities/search?location_id=X&q=name`
5. **Send template** -- `POST /proposals/templates/send` with templateId, contactId, locationId, userId
6. Merge fields auto-populate from contact/opportunity data

**CLI tool:** `python scripts/ghl-send-quote.py` automates this entire flow interactively.

---

## Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| 401 | Invalid or expired token | Check token in ghl-config.json, regenerate in GHL dashboard |
| 400 | Bad request / validation | Check required fields, verify IDs exist |
| 422 | Unprocessable entity | Template or contact ID may be invalid |
| 429 | Rate limited | Wait and retry |

---

## Financial Operations

### List Invoices
```bash
curl -s -X GET "https://services.leadconnectorhq.com/invoices/?altId=$LOCATION_ID&altType=location&limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-07-28" \
  -H "Accept: application/json"
```

### List Subscriptions
```bash
curl -s -X GET "https://services.leadconnectorhq.com/payments/subscriptions?altId=$LOCATION_ID&altType=location&limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-07-28" \
  -H "Accept: application/json"
```

### List Transactions
```bash
curl -s -X GET "https://services.leadconnectorhq.com/payments/transactions?altId=$LOCATION_ID&altType=location&limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-07-28" \
  -H "Accept: application/json"
```

### List Orders
```bash
curl -s -X GET "https://services.leadconnectorhq.com/payments/orders?altId=$LOCATION_ID&altType=location&limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-07-28" \
  -H "Accept: application/json"
```

### List Recurring Invoice Schedules
```bash
curl -s -X GET "https://services.leadconnectorhq.com/invoices/schedule?altId=$LOCATION_ID&altType=location&limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-07-28" \
  -H "Accept: application/json"
```

---

## Detailed Documentation

- **Authentication:** See `api-reference/authentication.md`
- **OAuth 2.0:** See `api-reference/oauth.md` (full OAuth flow, token exchange, refresh, scopes, rate limits, gotchas)
- **Proposals/Templates:** See `api-reference/proposals.md`
- **Contacts:** See `api-reference/contacts.md`
- **Payments:** See `api-reference/payments.md` (transactions, orders, subscriptions, coupons)
- **Invoices:** See `api-reference/invoices.md` (invoices, templates, schedules, estimates, text2pay)

---

## Notes

- GHL docs are notoriously sparse. When hitting unknown endpoints, test with curl first and document the actual response schema.
- Private Integration Tokens don't expire but can be revoked. They're scoped to the agency/sub-account.
- The `Version: 2021-07-28` header is required on ALL v2 API calls. Without it, requests fail silently or return unexpected formats.
