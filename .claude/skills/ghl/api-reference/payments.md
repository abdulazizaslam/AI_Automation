# GoHighLevel -- Payments API

Covers transactions, orders, subscriptions, and coupons.

**Base URL:** `https://services.leadconnectorhq.com`
**Auth:** `Authorization: Bearer <TOKEN>`, `Version: 2021-07-28`

**Common required params** (query or body depending on method):
- `altId` — Location ID (sub-account)
- `altType` — Always `"location"`

**Pagination:** `limit` (items per page) + `offset` (skip N items)

---

## Transactions

### List Transactions

```
GET /payments/transactions
```

| Param | In | Type | Required | Description |
|---|---|---|---|---|
| altId | query | string | yes | Location ID |
| altType | query | string | yes | `"location"` |
| startAt | query | string | no | Start date filter |
| endAt | query | string | no | End date filter |
| search | query | string | no | Search by name |
| contactId | query | string | no | Filter by contact |
| subscriptionId | query | string | no | Filter by subscription |
| entityId | query | string | no | Filter by entity |
| entitySourceType | query | string | no | Source of transactions |
| entitySourceSubType | query | string | no | Source sub-type |
| paymentMode | query | string | no | Mode of payment |
| locationId | query | string | no | Sub-account ID |
| limit | query | number | no | Max items per page |
| offset | query | number | no | Items to skip |

### Get Transaction by ID

```
GET /payments/transactions/{transactionId}
```

| Param | In | Type | Required | Description |
|---|---|---|---|---|
| transactionId | path | string | yes | Transaction ID |
| altId | query | string | yes | Location ID |
| altType | query | string | yes | `"location"` |

---

## Orders

### List Orders

```
GET /payments/orders
```

| Param | In | Type | Required | Description |
|---|---|---|---|---|
| altId | query | string | yes | Location ID |
| altType | query | string | yes | `"location"` |
| status | query | string | no | Order status |
| paymentMode | query | string | no | Mode of payment |
| startAt | query | string | no | Start date |
| endAt | query | string | no | End date |
| search | query | string | no | Search by order name |
| contactId | query | string | no | Filter by contact |
| funnelProductIds | query | string | no | Comma-separated product IDs |
| limit | query | number | no | Max items per page |
| offset | query | number | no | Items to skip |

### Get Order by ID

```
GET /payments/orders/{orderId}
```

| Param | In | Type | Required | Description |
|---|---|---|---|---|
| orderId | path | string | yes | Order ID |
| altId | query | string | yes | Location ID |

### Record Order Payment

```
POST /payments/orders/{orderId}/record-payment
```

Sets order status to "Paid".

| Param | In | Type | Required | Description |
|---|---|---|---|---|
| orderId | path | string | yes | Order ID |
| altId | body | string | yes | Location ID |
| altType | body | string | yes | `"location"` |
| mode | body | string | yes | `"cash"`, `"card"`, `"cheque"`, `"bank_transfer"`, `"other"` |
| card | body | object | no | `{brand, last4}` if card |
| cheque | body | object | no | `{number}` if cheque |
| notes | body | string | no | Transaction note |
| amount | body | number | no | Amount to pay |
| isPartialPayment | body | boolean | no | Partial payment flag |

### Create Order Fulfillment

```
POST /payments/orders/{orderId}/fulfillments
```

| Param | In | Type | Required | Description |
|---|---|---|---|---|
| orderId | path | string | yes | Order ID |
| altId | body | string | yes | Location ID |
| altType | body | string | yes | `"location"` |
| trackings | body | array | yes | `[{trackingNumber, shippingCarrier, trackingUrl}]` |
| items | body | array | yes | `[{priceId, qty}]` |
| notifyCustomer | body | boolean | yes | Send notification |

### List Order Fulfillments

```
GET /payments/orders/{orderId}/fulfillments
```

### List Order Notes

```
GET /payments/orders/{orderId}/notes
```

---

## Subscriptions

### List Subscriptions

```
GET /payments/subscriptions
```

| Param | In | Type | Required | Description |
|---|---|---|---|---|
| altId | query | string | yes | Location ID |
| altType | query | string | yes | `"location"` |
| entityId | query | string | no | Filter by entity |
| paymentMode | query | string | no | Mode of payment |
| startAt | query | string | no | Start date |
| endAt | query | string | no | End date |
| entitySourceType | query | string | no | Source type |
| search | query | string | no | Search by name |
| contactId | query | string | no | Filter by contact |
| id | query | string | no | Filter by subscription ID |
| limit | query | number | no | Max items per page |
| offset | query | number | no | Items to skip |

### Get Subscription by ID

```
GET /payments/subscriptions/{subscriptionId}
```

| Param | In | Type | Required | Description |
|---|---|---|---|---|
| subscriptionId | path | string | yes | Subscription ID |
| altId | query | string | yes | Location ID |
| altType | query | string | yes | `"location"` |

---

## Coupons

| Method | Path | Description |
|---|---|---|
| POST | `/payments/coupon` | Create coupon |
| PUT | `/payments/coupon` | Update coupon |
| DELETE | `/payments/coupon` | Delete coupon |
| GET | `/payments/coupon` | Get coupon by ID/code |
| GET | `/payments/coupon/list` | List coupons (paginated) |

---

## Custom Payment Providers

| Method | Path | Description |
|---|---|---|
| POST | `/payments/custom-provider/connect` | Connect custom provider |
| GET | `/payments/custom-provider/connect` | Get connection status |
| POST | `/payments/custom-provider/disconnect` | Disconnect provider |
| POST | `/payments/custom-provider/provider` | Create provider |
| DELETE | `/payments/custom-provider/provider` | Delete provider |
| PUT | `/payments/custom-provider/capabilities` | Update capabilities |

---

## SaaS Subscriptions (Agency-Level)

| Method | Path | Description |
|---|---|---|
| GET | `/saas-api/public-api/get-saas-subscription/{locationId}` | Get SaaS subscription |
| PUT | `/saas-api/public-api/update-saas-subscription/{locationId}` | Update SaaS subscription |
