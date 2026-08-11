# GoHighLevel -- Proposals (Documents & Contracts)

## Overview

The Proposals API handles document/contract templates and sending. "Proposals" is GHL's internal name for the Documents & Contracts feature.

## Endpoints

### List Templates

```
GET /proposals/templates?locationId={locationId}
```

**Headers:**
- `Authorization: Bearer {token}`
- `Version: 2021-07-28`
- `Accept: application/json`

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| locationId | string | Yes | GHL location/sub-account ID |

**Response (200):** Array of template objects. Schema TBD -- test with live API and document fields.

**Errors:**
- 400: Unprocessable Entity
- 401: Unauthorized

---

### Send Template

```
POST /proposals/templates/send
```

Send a document/contract template to a contact. Merge fields in the template auto-populate from the contact and opportunity records.

**Headers:**
- `Authorization: Bearer {token}`
- `Version: 2021-07-28`
- `Content-Type: application/json`
- `Accept: application/json`

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| templateId | string | Yes | Template ID from list templates |
| userId | string | Yes | GHL user ID (who is sending) |
| sendDocument | boolean | No | `true` to send immediately, `false`/omit for draft |
| locationId | string | Yes | GHL location/sub-account ID |
| contactId | string | Yes | Contact to send the document to |
| opportunityId | string | No | Link to an opportunity (populates opp merge fields) |

**Example Request:**
```bash
curl -s -X POST "https://services.leadconnectorhq.com/proposals/templates/send" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-07-28" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "templateId": "abc123",
    "userId": "user456",
    "sendDocument": true,
    "locationId": "loc789",
    "contactId": "contact012",
    "opportunityId": "opp345"
  }'
```

**Response (200):** Document sent successfully. Schema TBD.

**Errors:**
- 400: Unprocessable Entity (bad IDs, missing required fields)
- 401: Unauthorized

---

### List Documents

```
GET /proposals/document?locationId={locationId}
```

List existing documents (already created/sent).

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| locationId | string | Yes | GHL location/sub-account ID |
| status | string | No | Filter by status |

---

### Send Document

```
POST /proposals/document/send
```

Send an existing document (already created from a template) to contacts.

---

## Merge Fields

Templates support merge fields that auto-populate when sent:

- `{{contact.name}}` -- Contact's full name
- `{{contact.first_name}}` -- Contact's first name
- `{{contact.last_name}}` -- Contact's last name
- `{{contact.email}}` -- Contact's email
- `{{contact.phone}}` -- Contact's phone
- `{{opportunity.name}}` -- Opportunity name
- `{{opportunity.custom_field}}` -- Custom field from opportunity
- Custom values defined in Settings > Custom Values

**No manual override needed** for basic sends -- values pull from the contact/opportunity records automatically. For advanced overrides, update the contact or opportunity via API before sending.
