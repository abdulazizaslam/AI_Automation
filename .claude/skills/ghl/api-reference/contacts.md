# GoHighLevel — Contacts API

Manage contacts (leads) in a GHL sub-account. Contacts are the people who book appointments, receive calls, and flow through pipelines.

**Base URL:** `https://services.leadconnectorhq.com`

**Required Headers:**
```
Authorization: Bearer <TOKEN>
Version: 2021-07-28
Content-Type: application/json
```

**Scopes:** `contacts.readonly` (read/search), `contacts.write` (create/update/delete)

---

## Create Contact

Create a new contact in a location.

**Endpoint:** `POST /contacts/`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `locationId` | string | **Yes** | Location/sub-account ID |
| `firstName` | string | No | First name |
| `lastName` | string | No | Last name |
| `name` | string | No | Full name (alternative to first/last) |
| `email` | string | No | Email address |
| `phone` | string | No | Phone with country code: `+1 888-888-8888` |
| `gender` | string | No | e.g., `male`, `female` |
| `address1` | string | No | Street address |
| `city` | string | No | City |
| `state` | string | No | State |
| `postalCode` | string | No | ZIP/postal code |
| `country` | string | No | 2-letter code (e.g., `US`) |
| `website` | string | No | Website URL |
| `timezone` | string | No | IANA timezone (e.g., `America/New_York`) |
| `companyName` | string | No | Company name |
| `source` | string | No | Lead source (e.g., `public api`, `voice agent`) |
| `assignedTo` | string | No | User ID to assign contact to |
| `dnd` | boolean | No | Do not disturb |
| `dndSettings` | object | No | Per-channel DND: `{ Call, Email, SMS, WhatsApp, GMB, FB }` |
| `tags` | string[] | No | Array of tag strings |
| `customFields` | array | No | Custom field values |

### Response (201)

```json
{
  "contact": {
    "id": "contact_abc123",
    "locationId": "loc_abc123",
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@example.com",
    "phone": "+18885551234",
    "name": "John Smith",
    "tags": ["voice-agent-lead"],
    "source": "voice agent",
    "dateAdded": "2026-03-12T14:00:00.000Z",
    "dateUpdated": "2026-03-12T14:00:00.000Z",
    "deleted": false
  }
}
```

### Example

```bash
curl -s -X POST "https://services.leadconnectorhq.com/contacts/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-07-28" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "'"$LOCATION_ID"'",
    "firstName": "John",
    "lastName": "Smith",
    "phone": "+18885551234",
    "email": "john@example.com",
    "source": "voice agent",
    "tags": ["voice-agent-lead"]
  }'
```

---

## Upsert Contact

Create a new contact or update an existing one based on email/phone matching. **Preferred over create when you're not sure if the contact already exists.**

**Endpoint:** `POST /contacts/upsert`

### Request Body

Same fields as Create Contact (`locationId` required).

### Matching Logic

Follows the location's "Allow Duplicate Contact" setting. If both email and phone match **different** existing contacts, updates the one matching the first field in the configured priority sequence.

### Response (200)

```json
{
  "new": true,
  "contact": { ... },
  "traceId": "trace_abc123"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `new` | boolean | `true` = new contact created, `false` = existing updated |
| `contact` | object | Full contact object |
| `traceId` | string | Trace ID for debugging |

### Example

```bash
# Will create if not found, update if email/phone matches existing
curl -s -X POST "https://services.leadconnectorhq.com/contacts/upsert" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-07-28" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "'"$LOCATION_ID"'",
    "firstName": "John",
    "lastName": "Smith",
    "phone": "+18885551234",
    "email": "john@example.com",
    "source": "voice agent"
  }'
```

---

## Search Contacts (GET — Simple)

Simple search by name, email, or phone.

**Endpoint:** `GET /contacts/`

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `locationId` | string | Yes | Location/sub-account ID |
| `query` | string | No | Search term (name, email, phone) |
| `limit` | integer | No | Max results (max 100) |
| `startAfter` | string | No | Pagination cursor |
| `startAfterId` | string | No | Pagination cursor ID |

### Response (200)

```json
{
  "contacts": [ ... ],
  "meta": {
    "startAfter": "...",
    "startAfterId": "...",
    "total": 42
  }
}
```

### Pagination

Cursor-based: pass `meta.startAfter` and `meta.startAfterId` as query params to get next page. Continue until no more cursor values returned.

### Example

```bash
curl -s -X GET "https://services.leadconnectorhq.com/contacts/?locationId=$LOCATION_ID&query=John+Smith&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-07-28" | jq '.contacts[] | {id, firstName, lastName, phone, email}'
```

---

## Search Contacts (POST — Advanced)

Advanced search with filter combinations.

**Endpoint:** `POST /contacts/search`

Advanced filter objects for complex queries. Use the simple GET endpoint for basic lookups.

---

## Get Contact

Get a single contact by ID.

**Endpoint:** `GET /contacts/{contactId}`

### Path Parameters

| Param | Type | Required |
|-------|------|----------|
| `contactId` | string | Yes |

### Response (200)

Full contact object with all fields.

---

## Update Contact

Update an existing contact.

**Endpoint:** `PUT /contacts/{contactId}`

### Path Parameters

| Param | Type | Required |
|-------|------|----------|
| `contactId` | string | Yes |

### Request Body

Same fields as Create Contact, all optional. No `locationId` needed.

**⚠️ Tags Warning:** The `tags` field **OVERWRITES** all existing tags. To add/remove tags incrementally, use the dedicated Add Tag / Remove Tag endpoints instead.

### Response (200)

```json
{
  "succeded": true,
  "contact": { ... }
}
```

Note: GHL misspells `succeded` (one 'e') in the response. This is not a typo in this doc.

---

## Delete Contact

Delete a contact permanently.

**Endpoint:** `DELETE /contacts/{contactId}`

### Path Parameters

| Param | Type | Required |
|-------|------|----------|
| `contactId` | string | Yes |

### Response (200)

```json
{ "succeded": true }
```

---

## Custom Fields Format

Custom fields are passed as an array of objects:

```json
{
  "customFields": [
    { "id": "field_id_or_key", "value": "field value" },
    { "id": "another_field", "value": "another value" }
  ]
}
```

Field IDs can be found in GHL Settings > Custom Fields, or via the Custom Fields API.

---

## Common Contact Fields (Response)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Contact ID |
| `locationId` | string | Location this contact belongs to |
| `firstName` | string | First name |
| `lastName` | string | Last name |
| `name` | string | Full name |
| `email` | string | Email |
| `phone` | string | Phone |
| `companyName` | string | Company |
| `address1` | string | Street address |
| `city` | string | City |
| `state` | string | State |
| `country` | string | Country code |
| `postalCode` | string | ZIP |
| `website` | string | Website |
| `timezone` | string | Timezone |
| `source` | string | Lead source |
| `assignedTo` | string | Assigned user ID |
| `tags` | string[] | Tags |
| `customFields` | array | Custom field values |
| `dnd` | boolean | Do not disturb |
| `dateAdded` | string | Created timestamp |
| `dateUpdated` | string | Last updated |
| `deleted` | boolean | Soft-deleted flag |
