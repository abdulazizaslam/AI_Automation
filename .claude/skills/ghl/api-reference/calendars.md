# Calendars API

Manage calendars in a GHL sub-account. Calendars define availability, slot duration, team members, and booking rules.

**Base URL:** `https://services.leadconnectorhq.com`

**Required Headers:**
```
Authorization: Bearer <TOKEN>
Version: 2021-04-15
Content-Type: application/json
```

**⚠️ Version Header:** Calendar endpoints use `2021-04-15`, NOT `2021-07-28`.

**Scopes:** `calendars.readonly` (read), `calendars.write` (create/update/delete)

---

## List Calendars

List all calendars in a location.

**Endpoint:** `GET /calendars/`

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `locationId` | string | Yes | Sub-account/location ID |
| `groupId` | string | No | Filter by calendar group |
| `showDrafted` | boolean | No | Include draft calendars (default: true) |

### Response (200)

```json
{
  "calendars": [
    {
      "id": "cal_abc123",
      "name": "Discovery Call",
      "locationId": "loc_abc123",
      "calendarType": "round_robin",
      "isActive": true,
      "slotDuration": 30,
      "slotDurationUnit": "mins",
      "slotInterval": 30,
      "slotIntervalUnit": "mins",
      "teamMembers": [
        { "userId": "user_abc123", "priority": 1, "isPrimary": true }
      ],
      "openHours": [
        { "daysOfTheWeek": [1, 2, 3, 4, 5], "hours": [{ "openHour": 9, "openMinute": 0, "closeHour": 17, "closeMinute": 0 }] }
      ]
    }
  ]
}
```

### Example

```bash
curl -s -X GET "https://services.leadconnectorhq.com/calendars/?locationId=$LOCATION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-04-15" | jq '.calendars[] | {id, name, calendarType, isActive}'
```

---

## Get Calendar

Get a single calendar by ID.

**Endpoint:** `GET /calendars/{calendarId}`

### Path Parameters

| Param | Type | Required |
|-------|------|----------|
| `calendarId` | string | Yes |

### Response (200)

```json
{ "calendar": { ... } }
```

Full CalendarDTO fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Calendar ID |
| `name` | string | Calendar name |
| `locationId` | string | Location ID |
| `groupId` | string | Calendar group |
| `calendarType` | string | `round_robin`, `event`, `class_booking`, `collective`, `service_booking`, `personal` |
| `widgetType` | string | `default` (neo) or `classic` |
| `isActive` | boolean | Whether calendar is live |
| `slug` | string | URL slug |
| `eventTitle` | string | Default event title |
| `eventColor` | string | Display color |
| `description` | string | Calendar description |
| `teamMembers` | array | Team member assignments (see below) |
| `slotDuration` | number | Appointment length |
| `slotDurationUnit` | string | `mins` or `hours` |
| `slotInterval` | number | Time between slot starts |
| `slotIntervalUnit` | string | `mins` or `hours` |
| `slotBuffer` | number | Buffer after each appointment |
| `slotBufferUnit` | string | `mins` or `hours` |
| `preBuffer` | number | Buffer before each appointment |
| `preBufferUnit` | string | `mins` or `hours` |
| `appoinmentPerSlot` | number | Max bookings per slot per user |
| `appoinmentPerDay` | number | Max bookings per day |
| `allowBookingAfter` | number | Min scheduling notice |
| `allowBookingAfterUnit` | string | `hours`, `days`, `weeks`, `months` |
| `allowBookingFor` | number | How far ahead bookings allowed |
| `allowBookingForUnit` | string | `days`, `weeks`, `months` |
| `openHours` | array | Regular availability windows |
| `availabilities` | array | Custom date overrides |
| `autoConfirm` | boolean | Auto-confirm bookings |
| `allowReschedule` | boolean | Allow rescheduling |
| `allowCancellation` | boolean | Allow cancellation |
| `locationConfigurations` | array | Meeting location types |

### teamMembers Object

```json
{
  "userId": "user_abc123",
  "priority": 1,
  "isPrimary": true,
  "meetingLocationType": "zoom",
  "locationConfigurations": []
}
```

Priority: `0` (low), `0.5` (medium), `1` (high)

### locationConfigurations Object

```json
{ "kind": "zoom_conference", "location": "" }
```

Kind values: `custom`, `zoom_conference`, `google_conference`, `inbound_call`, `outbound_call`, `physical`, `booker`, `ms_teams_conference`

---

## Get Free Slots

Get available booking slots for a calendar within a date range. **This is the key endpoint for availability checking.**

**Endpoint:** `GET /calendars/{calendarId}/free-slots`

### Path Parameters

| Param | Type | Required |
|-------|------|----------|
| `calendarId` | string | Yes |

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `startDate` | number | Yes | Unix milliseconds |
| `endDate` | number | Yes | Unix milliseconds |
| `timezone` | string | No | IANA timezone (e.g., `America/New_York`) |
| `userId` | string | No | Filter to specific team member |
| `userIds` | string[] | No | Filter to multiple team members |

**⚠️ Max date range: 31 days.** Requests exceeding 31 days will fail.

### Response (200)

Availability map keyed by date (`YYYY-MM-DD`):

```json
{
  "2026-03-15": {
    "slots": [
      { "start": "2026-03-15T09:00:00-04:00", "end": "2026-03-15T09:30:00-04:00" },
      { "start": "2026-03-15T09:30:00-04:00", "end": "2026-03-15T10:00:00-04:00" },
      { "start": "2026-03-15T10:00:00-04:00", "end": "2026-03-15T10:30:00-04:00" }
    ]
  },
  "2026-03-16": {
    "slots": []
  }
}
```

### Example

```bash
# Get free slots for next 7 days
START=$(date -d "+0 days" +%s)000
END=$(date -d "+7 days" +%s)000

curl -s -X GET "https://services.leadconnectorhq.com/calendars/$CALENDAR_ID/free-slots?startDate=$START&endDate=$END&timezone=America/New_York" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-04-15" | jq 'to_entries[] | select(.value.slots | length > 0) | {date: .key, available_slots: (.value.slots | length)}'
```

---

## Create Calendar

Create a new calendar.

**Endpoint:** `POST /calendars/`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `locationId` | string | Yes | Location/sub-account ID |
| `name` | string | Yes | Calendar name |
| `calendarType` | string | No | `round_robin`, `event`, `class_booking`, `collective`, `service_booking`, `personal` |
| `teamMembers` | array | No | Array of `{ userId (required), priority, isPrimary, locationConfigurations[] }` |
| `openHours` | array | No | Array of `{ daysOfTheWeek: number[], hours: [] }` |
| `slotDuration` | number | No | Appointment length |
| `slotDurationUnit` | string | No | `mins` or `hours` |
| `slotInterval` | number | No | Time between slots |
| `autoConfirm` | boolean | No | Auto-confirm bookings |

All CalendarDTO fields from Get Calendar are accepted (except `id`).

### Response (200)

```json
{ "calendar": { "id": "cal_new123", "name": "...", ... } }
```

### Example

```bash
curl -s -X POST "https://services.leadconnectorhq.com/calendars/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-04-15" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "'"$LOCATION_ID"'",
    "name": "Discovery Call",
    "calendarType": "round_robin",
    "slotDuration": 30,
    "slotDurationUnit": "mins",
    "slotInterval": 30,
    "slotIntervalUnit": "mins",
    "autoConfirm": true,
    "teamMembers": [
      { "userId": "'"$USER_ID"'", "priority": 1, "isPrimary": true }
    ],
    "openHours": [
      {
        "daysOfTheWeek": [1, 2, 3, 4, 5],
        "hours": [{ "openHour": 9, "openMinute": 0, "closeHour": 17, "closeMinute": 0 }]
      }
    ]
  }'
```

---

## Update Calendar

Update an existing calendar's configuration.

**Endpoint:** `PUT /calendars/{calendarId}`

### Path Parameters

| Param | Type | Required |
|-------|------|----------|
| `calendarId` | string | Yes |

### Request Body

Same fields as Create Calendar, all optional. No `locationId` needed.

### Response (200)

```json
{ "calendar": { ... } }
```

---

## Delete Calendar

Delete a calendar.

**Endpoint:** `DELETE /calendars/{calendarId}`

### Path Parameters

| Param | Type | Required |
|-------|------|----------|
| `calendarId` | string | Yes |

### Response (200)

```json
{ "success": true }
```
