# Calendar Events (Appointments) API

Manage appointments, events, and blocked slots on GHL calendars. This is where bookings are created and managed.

**Base URL:** `https://services.leadconnectorhq.com`

**Required Headers:**
```
Authorization: Bearer <TOKEN>
Version: 2021-04-15
Content-Type: application/json
```

**⚠️ Version Header:** Calendar event endpoints use `2021-04-15`, NOT `2021-07-28`.

**Scopes:** `calendars/events.readonly` (read), `calendars/events.write` (create/update/delete)

---

## List Events

List calendar events within a time range.

**Endpoint:** `GET /calendars/events`

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `locationId` | string | Yes | Location/sub-account ID |
| `startTime` | string | Yes | Unix milliseconds |
| `endTime` | string | Yes | Unix milliseconds |
| `calendarId` | string | Conditional | One of `calendarId`, `userId`, or `groupId` is required |
| `userId` | string | Conditional | One of `calendarId`, `userId`, or `groupId` is required |
| `groupId` | string | Conditional | One of `calendarId`, `userId`, or `groupId` is required |

### Response (200)

```json
{
  "events": [
    {
      "id": "evt_abc123",
      "title": "Discovery Call - John Smith",
      "calendarId": "cal_abc123",
      "locationId": "loc_abc123",
      "contactId": "contact_abc123",
      "appointmentStatus": "confirmed",
      "assignedUserId": "user_abc123",
      "startTime": "2026-03-15T09:00:00-04:00",
      "endTime": "2026-03-15T09:30:00-04:00",
      "dateAdded": "2026-03-12T14:00:00-04:00",
      "dateUpdated": "2026-03-12T14:00:00-04:00"
    }
  ]
}
```

### Example

```bash
START=$(date -d "+0 days" +%s)000
END=$(date -d "+7 days" +%s)000

curl -s -X GET "https://services.leadconnectorhq.com/calendars/events?locationId=$LOCATION_ID&calendarId=$CALENDAR_ID&startTime=$START&endTime=$END" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-04-15" | jq '.events[] | {id, title, appointmentStatus, startTime}'
```

---

## Get Appointment

Get a single appointment by ID.

**Endpoint:** `GET /calendars/events/appointments/{eventId}`

### Path Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `eventId` | string | Yes | Event ID or instance ID. For recurring events, use `masterEventId`. |

### Response (200)

```json
{
  "event": {
    "id": "evt_abc123",
    "title": "Discovery Call - John Smith",
    "calendarId": "cal_abc123",
    "locationId": "loc_abc123",
    "contactId": "contact_abc123",
    "groupId": "group_abc123",
    "appointmentStatus": "confirmed",
    "assignedUserId": "user_abc123",
    "users": [],
    "startTime": "2026-03-15T09:00:00-04:00",
    "endTime": "2026-03-15T09:30:00-04:00",
    "dateAdded": "2026-03-12T14:00:00-04:00",
    "dateUpdated": "2026-03-12T14:00:00-04:00",
    "address": "",
    "notes": "",
    "description": "",
    "isRecurring": false,
    "rrule": null,
    "masterEventId": null,
    "assignedResources": []
  }
}
```

### Appointment Status Values

| Status | Description |
|--------|-------------|
| `new` | Just created, unconfirmed |
| `confirmed` | Confirmed by contact or auto-confirmed |
| `cancelled` | Cancelled |
| `showed` | Contact showed up |
| `noshow` | Contact didn't show |
| `invalid` | Invalid/bad data |
| `active` | Currently in progress (response only) |
| `completed` | Completed (response only) |

---

## Create Appointment

**This is the key endpoint for booking.** Creates a new appointment on a calendar for a contact.

**Endpoint:** `POST /calendars/events/appointments`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `calendarId` | string | **Yes** | Calendar to book into |
| `locationId` | string | **Yes** | Location/sub-account ID |
| `contactId` | string | **Yes** | Contact being booked (must exist first) |
| `startTime` | string | **Yes** | ISO 8601 with timezone offset: `2026-03-15T09:00:00-04:00` |
| `endTime` | string | No | ISO 8601 with offset. Defaults to `startTime + slotDuration` |
| `title` | string | No | Event title |
| `appointmentStatus` | string | No | `new`, `confirmed`, `cancelled`, `showed`, `noshow`, `invalid` |
| `assignedUserId` | string | No | Team member to assign |
| `description` | string | No | Appointment notes/description |
| `address` | string | No | Meeting address or video link |
| `meetingLocationType` | string | No | `custom`, `zoom`, `gmeet`, `phone`, `address`, `ms_teams`, `google` |
| `meetingLocationId` | string | No | From `calendar.locationConfigurations` |
| `overrideLocationConfig` | boolean | No | `true` if using `meetingLocationType` directly |
| `toNotify` | boolean | No | `false` = skip automations/workflows |
| `ignoreDateRange` | boolean | No | Skip min scheduling notice + date range checks |
| `ignoreFreeSlotValidation` | boolean | No | Skip all slot availability validation |
| `rrule` | string | No | RFC 5545 recurrence rule (requires `ignoreFreeSlotValidation: true`) |

### Response (200)

```json
{
  "id": "evt_new123",
  "calendarId": "cal_abc123",
  "locationId": "loc_abc123",
  "contactId": "contact_abc123",
  "startTime": "2026-03-15T09:00:00-04:00",
  "endTime": "2026-03-15T09:30:00-04:00",
  "title": "Discovery Call - John Smith",
  "appointmentStatus": "new",
  "assignedUserId": "user_abc123",
  "isRecurring": false
}
```

### Example

```bash
curl -s -X POST "https://services.leadconnectorhq.com/calendars/events/appointments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-04-15" \
  -H "Content-Type: application/json" \
  -d '{
    "calendarId": "'"$CALENDAR_ID"'",
    "locationId": "'"$LOCATION_ID"'",
    "contactId": "'"$CONTACT_ID"'",
    "startTime": "2026-03-15T09:00:00-04:00",
    "endTime": "2026-03-15T09:30:00-04:00",
    "title": "Discovery Call - John Smith",
    "appointmentStatus": "confirmed",
    "assignedUserId": "'"$USER_ID"'",
    "toNotify": true
  }'
```

### Important Notes

1. **Contact must exist first.** Create the contact via `POST /contacts/` before booking.
2. **Time format is ISO 8601 with offset**, NOT Unix timestamps. Example: `2026-03-15T09:00:00-04:00`
3. **Slot validation:** By default, the endpoint validates the slot is actually free. Set `ignoreFreeSlotValidation: true` to bypass.
4. **Automations:** Set `toNotify: true` to trigger GHL workflows/automations on the booking (confirmation emails, SMS, etc.).

---

## Update Appointment

Update an existing appointment.

**Endpoint:** `PUT /calendars/events/appointments/{eventId}`

### Path Parameters

| Param | Type | Required |
|-------|------|----------|
| `eventId` | string | Yes |

### Request Body

Same fields as Create Appointment, all optional. No `locationId` or `contactId` needed.

### Response (200)

Updated appointment object (same shape as create response).

### Example — Reschedule

```bash
curl -s -X PUT "https://services.leadconnectorhq.com/calendars/events/appointments/$EVENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-04-15" \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "2026-03-16T10:00:00-04:00",
    "endTime": "2026-03-16T10:30:00-04:00"
  }'
```

### Example — Mark as Showed

```bash
curl -s -X PUT "https://services.leadconnectorhq.com/calendars/events/appointments/$EVENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-04-15" \
  -H "Content-Type: application/json" \
  -d '{ "appointmentStatus": "showed" }'
```

---

## Delete Event

Delete a calendar event.

**Endpoint:** `DELETE /calendars/events/{eventId}`

### Path Parameters

| Param | Type | Required |
|-------|------|----------|
| `eventId` | string | Yes |

### Response (201)

```json
{ "succeeded": true }
```

---

## Create Block Slot

Block off time on a calendar (prevents bookings during that window).

**Endpoint:** `POST /calendars/events/block-slots`

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `locationId` | string | Yes | Location ID |
| `calendarId` | string | Conditional | Either `calendarId` OR `assignedUserId` (not both) |
| `assignedUserId` | string | Conditional | Either `calendarId` OR `assignedUserId` (not both) |
| `title` | string | No | Block slot label |
| `startTime` | string | No | ISO 8601 |
| `endTime` | string | No | ISO 8601 |

### Response (201)

```json
{
  "id": "evt_block123",
  "locationId": "loc_abc123",
  "title": "Lunch Break",
  "startTime": "2026-03-15T12:00:00-04:00",
  "endTime": "2026-03-15T13:00:00-04:00",
  "calendarId": "cal_abc123"
}
```

---

## Update Block Slot

**Endpoint:** `PUT /calendars/events/block-slots/{eventId}`

### Path Parameters

| Param | Type | Required |
|-------|------|----------|
| `eventId` | string | Yes |

### Request Body

Same fields as Create Block Slot, all optional.

### Response (201)

Updated block slot object.

---

## Common Booking Flow

The typical flow for a voice agent booking an appointment:

```
1. GET /calendars/?locationId=...                    → Find the right calendar
2. GET /calendars/{calendarId}/free-slots?...        → Check availability
3. POST /contacts/ (or /contacts/upsert)             → Create/find the contact
4. POST /calendars/events/appointments               → Book the slot
```

This maps to two Retell custom tools:
- **check_availability** → calls steps 1-2
- **book_appointment** → calls steps 3-4
