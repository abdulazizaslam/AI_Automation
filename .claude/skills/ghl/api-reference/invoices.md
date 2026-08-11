# GoHighLevel -- Invoices API

Covers invoices, invoice templates, recurring schedules, estimates, and text2pay.

**Base URL:** `https://services.leadconnectorhq.com`
**Auth:** `Authorization: Bearer <TOKEN>`, `Version: 2021-07-28`

---

## Invoices

### List Invoices

```
GET /invoices/
```

| Param | In | Type | Required | Description |
|---|---|---|---|---|
| altId | query | string | yes | Location ID |
| altType | query | string | yes | `"location"` |
| status | query | string | no | Filter by status |
| startAt | query | string | no | Start date `YYYY-MM-DD` |
| endAt | query | string | no | End date `YYYY-MM-DD` |
| search | query | string | no | Search by id/name/email/phone |
| paymentMode | query | string | no | Payment mode |
| contactId | query | string | no | Filter by contact |
| limit | query | string | yes | Max items |
| offset | query | string | yes | Items to skip |
| sortField | query | string | no | Field to sort by |
| sortOrder | query | string | no | Sort direction |

### Get Invoice by ID

```
GET /invoices/{invoiceId}
```

| Param | In | Type | Required | Description |
|---|---|---|---|---|
| invoiceId | path | string | yes | Invoice ID |
| altId | query | string | yes | Location ID |
| altType | query | string | yes | `"location"` |

### Create Invoice

```
POST /invoices/
```

**Body (application/json):**

| Field | Type | Required | Description |
|---|---|---|---|
| altId | string | yes | Location ID |
| altType | string | yes | `"location"` |
| name | string | yes | Invoice name |
| currency | string | yes | Currency code (e.g. `"USD"`) |
| items | array | yes | Line items (see below) |
| discount | object | yes | `{type: "percentage"\|"fixed", value, validOnProductIds[]}` |
| contactDetails | object | yes | Contact info |
| sentTo | object | yes | `{email[], emailCc[], emailBcc[], phoneNo[]}` |
| businessDetails | object | yes | `{logoUrl, name, phoneNo, address, website, customValues[]}` |
| issueDate | string | yes | `YYYY-MM-DD` |
| liveMode | boolean | yes | Live vs test mode |
| dueDate | string | no | Due date |
| termsNotes | string | no | Terms/notes text |
| title | string | no | Invoice title |
| invoiceNumber | string | no | Custom invoice number |
| invoiceNumberPrefix | string | no | Number prefix |
| automaticTaxesEnabled | boolean | no | Auto tax calculation |
| paymentSchedule | object | no | Payment schedule config |
| lateFeesConfiguration | object | no | Late fees config |
| tipsConfiguration | object | no | Tips config |
| paymentMethods | object | no | Accepted payment methods |
| attachments | array | no | File attachments |

**Line item format:** `{name, currency, amount, qty}` (required); optional: `description, productId, priceId, taxes[], type ("one_time"|"recurring"), taxInclusive`

### Update Invoice

```
PUT /invoices/{invoiceId}
```

Same body as Create but uses `invoiceItems` instead of `items`. `dueDate` is required on update.

### Delete Invoice

```
DELETE /invoices/{invoiceId}
```

| Param | In | Type | Required | Description |
|---|---|---|---|---|
| invoiceId | path | string | yes | Invoice ID |
| altId | query | string | yes | Location ID |
| altType | query | string | yes | `"location"` |

### Send Invoice

```
POST /invoices/{invoiceId}/send
```

| Param | In | Type | Required | Description |
|---|---|---|---|---|
| invoiceId | path | string | yes | Invoice ID |
| altId | body | string | yes | Location ID |
| altType | body | string | yes | `"location"` |
| userId | body | string | yes | Authorized user ID |
| action | body | string | yes | `"sms_and_email"`, `"send_manually"`, `"email"`, `"sms"` |
| liveMode | body | boolean | yes | Live vs test |
| sentFrom | body | object | no | Sender details |
| autoPayment | body | object | no | Auto-payment config |

### Void Invoice

```
POST /invoices/{invoiceId}/void
```

Body: `{altId, altType: "location"}`

### Record Invoice Payment

```
POST /invoices/{invoiceId}/record-payment
```

| Param | In | Type | Required | Description |
|---|---|---|---|---|
| invoiceId | path | string | yes | Invoice ID |
| altId | body | string | yes | Location ID |
| altType | body | string | yes | `"location"` |
| mode | body | string | yes | `"cash"`, `"card"`, `"cheque"`, `"bank_transfer"`, `"other"` |
| notes | body | string | yes | Transaction note |
| card | body | object | no | `{brand, last4}` |
| cheque | body | object | no | `{number}` |
| amount | body | number | no | Payment amount |
| paymentScheduleIds | body | array | no | Schedule IDs |
| fulfilledAt | body | string | no | Fulfillment timestamp |

### Generate Next Invoice Number

```
GET /invoices/generate-invoice-number
```

| Param | In | Type | Required | Description |
|---|---|---|---|---|
| altId | query | string | yes | Location ID |
| altType | query | string | yes | `"location"` |

### Get Invoice Settings

```
GET /invoices/settings
```

### Update Late Fees Config

```
PATCH /invoices/{invoiceId}/late-fees-configuration
```

---

## Invoice Templates

| Method | Path | Description |
|---|---|---|
| POST | `/invoices/template` | Create template |
| GET | `/invoices/template` | List templates (paginated) |
| GET | `/invoices/template/{templateId}` | Get template by ID |
| PUT | `/invoices/template/{templateId}` | Update template |
| DELETE | `/invoices/template/{templateId}` | Delete template |
| PATCH | `/invoices/template/{templateId}/late-fees-configuration` | Update late fees |
| PATCH | `/invoices/template/{templateId}/payment-methods-configuration` | Update payment methods |

---

## Invoice Schedules (Recurring Invoices)

| Method | Path | Description |
|---|---|---|
| POST | `/invoices/schedule` | Create recurring schedule |
| GET | `/invoices/schedule` | List schedules (paginated) |
| GET | `/invoices/schedule/{scheduleId}` | Get schedule by ID |
| PUT | `/invoices/schedule/{scheduleId}` | Update schedule |
| DELETE | `/invoices/schedule/{scheduleId}` | Delete schedule |
| POST | `/invoices/schedule/{scheduleId}/schedule` | Start sending scheduled invoices |
| POST | `/invoices/schedule/{scheduleId}/updateAndSchedule` | Update and activate |
| POST | `/invoices/schedule/{scheduleId}/auto-payment` | Manage auto-payment |
| POST | `/invoices/schedule/{scheduleId}/cancel` | Cancel scheduled invoice |

**Schedule creation** body includes `schedule.rrule` supporting: `intervalType` (yearly/monthly/weekly/daily), `interval`, `startDate`, `endDate`, `dayOfMonth`, `dayOfWeek`, `count`.

---

## Estimates

| Method | Path | Description |
|---|---|---|
| POST | `/invoices/estimate` | Create estimate |
| GET | `/invoices/estimate/list` | List estimates |
| GET | `/invoices/estimate/number/generate` | Generate next estimate number |
| PUT | `/invoices/estimate/{estimateId}` | Update estimate |
| DELETE | `/invoices/estimate/{estimateId}` | Delete estimate |
| POST | `/invoices/estimate/{estimateId}/send` | Send estimate |
| POST | `/invoices/estimate/{estimateId}/invoice` | Convert estimate to invoice |

**Estimate Templates:**

| Method | Path | Description |
|---|---|---|
| POST | `/invoices/estimate/template` | Create template |
| GET | `/invoices/estimate/template` | List templates |
| GET | `/invoices/estimate/template/preview` | Preview template |
| PUT | `/invoices/estimate/template/{templateId}` | Update template |
| DELETE | `/invoices/estimate/template/{templateId}` | Delete template |

---

## Text2Pay

```
POST /invoices/text2pay
```

Creates and sends an invoice via SMS. Same body as Create Invoice plus:

| Field | Type | Required | Description |
|---|---|---|---|
| action | string | yes | `"draft"` or `"send"` |
| userId | string | yes | Authorized user ID |
| id | string | no | Update existing text2pay |
| includeTermsNote | boolean | no | Include terms |
