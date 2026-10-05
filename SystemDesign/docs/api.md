# SALESTORM OpenAPI Documentation

This document serves as the formal specification for the SALESTORM backend API. 

> **Swagger UI Interface**: An interactive, automatically generated OpenAPI 3.0 interface is natively served by the backend at `http://localhost:3000/documentation`. It binds directly to our Zod validation schemas.

---

## Table of Contents
1. [Authentication](#1-authentication)
2. [Products](#2-products)
3. [Cart](#3-cart)
4. [Reservations](#4-reservations)
5. [Checkout](#5-checkout)
6. [Payments](#6-payments)
7. [Orders](#7-orders)
8. [Shipments](#8-shipments)
9. [Notifications](#9-notifications)
10. [Admin & Metrics](#10-admin--metrics)

---

## 1. Authentication
Handles JWT issuance and user sessions.

### `POST /api/auth/register`
- **Authentication**: None
- **Request Body**: `{ "email": "user@test.com", "password": "pwd", "name": "User" }`
- **Response** (201): `{ "token": "jwt..." }`
- **Errors**: `400` (Validation), `409` (Email exists)

### `POST /api/auth/login`
- **Authentication**: None
- **Request Body**: `{ "email": "user@test.com", "password": "pwd" }`
- **Response** (200): `{ "token": "jwt..." }`
- **Errors**: `401` (Invalid credentials)

### `GET /api/auth/me`
- **Authentication**: Bearer JWT
- **Response** (200): `{ "id": "uuid", "email": "user@test.com", "role": "CUSTOMER" }`

---

## 2. Products
Catalog and Inventory viewing.

### `GET /api/products`
- **Authentication**: None
- **Response** (200): Array of Product objects including `availableQuantity`.

### `GET /api/products/:id`
- **Authentication**: None
- **Response** (200): Single Product object.
- **Errors**: `404` (Not Found).

### `POST /api/products` *(Admin Only)*
- **Authentication**: Bearer JWT (Role: ADMIN)
- **Request Body**: `{ "name": "...", "price": 100, "description": "...", "initialInventory": 100 }`
- **Response** (201): Created Product object.

---

## 3. Cart
Standard shopping cart capabilities.

### `GET /api/cart`
- **Authentication**: Bearer JWT
- **Response** (200): Cart object with nested `items`.

### `POST /api/cart/items`
- **Authentication**: Bearer JWT
- **Request Body**: `{ "productId": "uuid", "quantity": 1 }`
- **Response** (200): Updated Cart.

### `DELETE /api/cart/items/:productId`
- **Authentication**: Bearer JWT
- **Response** (200): Updated Cart.

---

## 4. Reservations
***CRITICAL HIGH-CONCURRENCY DOMAIN***

### `POST /api/reservations`
- **Authentication**: Bearer JWT
- **Headers**: 
  - `Idempotency-Key` (Required UUID)
- **Request Body**: `{ "productId": "uuid", "quantity": 1 }`
- **Response** (201): `{ "id": "reservation_id", "status": "PENDING", "expiresAt": "iso_date" }`
- **Errors**: 
  - `422 Unprocessable Entity`: Out of stock.
  - `409 Conflict`: Duplicate request in progress.
  - `400 Bad Request`: Invalid payload.
- **Idempotency Requirements**: Strictly required. Submitting the exact same `Idempotency-Key` prevents double-reserving inventory while returning the cached success response.

---

## 5. Checkout
Orchestrates Order creation from a locked reservation.

### `POST /api/checkout`
- **Authentication**: Bearer JWT
- **Request Body**: `{ "reservationId": "uuid" }`
- **Response** (201): `{ "id": "order_id", "status": "PAYMENT_PENDING", "totalAmount": 100 }`
- **Errors**:
  - `404`: Reservation not found or not owned by user.
  - `400`: Reservation has EXPIRED or is already converted.

---

## 6. Payments
Payment gateway integration.

### `POST /api/payments`
- **Authentication**: Bearer JWT
- **Headers**:
  - `Idempotency-Key` (Required UUID)
- **Request Body**: `{ "orderId": "uuid", "amount": 100.00 }`
- **Response** (201): `{ "status": "SUCCESS|TIMEOUT", "transactionId": "..." }`
- **Errors**:
  - `400 Bad Request`: Payment Gateway Failed (e.g., Card Declined).
  - `409 Conflict`: This `orderId` has already been paid successfully.
- **Idempotency Requirements**: Mandatory. Prevents double-charging the customer's credit card if the network drops the HTTP response.

---

## 7. Orders
Order lifecycle tracking.

### `GET /api/orders`
- **Authentication**: Bearer JWT
- **Response** (200): Array of user's Orders.

### `GET /api/orders/:id`
- **Authentication**: Bearer JWT
- **Response** (200): Order details.
- **Errors**: `403` (Not your order), `404` (Not Found).

### `POST /api/orders/:id/cancel`
- **Authentication**: Bearer JWT
- **Response** (200): `{ "status": "CANCELLED" }`
- **Errors**: `422` (Order is already shipped/delivered).

---

## 8. Shipments
Fulfillment tracking.

### `POST /api/shipments` *(Admin Only)*
- **Authentication**: Bearer JWT (Role: ADMIN)
- **Request Body**: `{ "orderId": "uuid", "address": "123 St" }`
- **Response** (201): Shipment object (`CREATED`).
- **Errors**: `422` (Order is not confirmed).

### `PATCH /api/shipments/:id/status` *(Admin Only)*
- **Authentication**: Bearer JWT (Role: ADMIN)
- **Request Body**: `{ "status": "SHIPPED|DELIVERED", "trackingNumber": "string" }`
- **Response** (200): Updated Shipment object. (Triggers side-effects on Order State).

---

## 9. Notifications
*(Background Worker Domain)*
Notifications do not expose REST endpoints. They are idempotent RabbitMQ consumers listening for:
- `ORDER_CONFIRMED`
- `PAYMENT_FAILED`
- `SHIPMENT_UPDATED`

---

## 10. Admin & Metrics
Observability endpoints.

### `GET /api/admin/flash-sale/metrics`
- **Authentication**: Bearer JWT (Role: ADMIN)
- **Response** (200): Heavily aggregated real-time counts of `availableQuantity`, `reservedQuantity`, `soldQuantity`, and queue depth. Masked by a 2-second Redis cache to prevent DB overload.

### `GET /api/admin/observability`
- **Authentication**: Bearer JWT (Role: ADMIN)
- **Response** (200): System telemetry including `reqPerSec`, `avgLatencyMs`, `errorRatePct`, and `databaseActiveConnections`.
