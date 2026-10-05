# Architecture Overview

## High-Level Design
SALESTORM is a modular monolith (designed for easy microservice extraction) utilizing a strict Event-Driven Architecture (EDA) to handle intense flash-sale concurrency.

### Components
1. **API Gateway & Controllers**: Fastify-based, providing strictly validated (Zod) endpoints.
2. **Domain Modules**: Isolated domains (`Product`, `Inventory`, `Reservation`, `Order`, `Payment`, `Shipment`).
3. **Database**: PostgreSQL acts as the definitive Source of Truth (SoT). All concurrency locks (e.g., Inventory) are resolved at the ACID transaction layer using targeted `UPDATE ... WHERE available >= quantity` statements.
4. **Cache**: Redis offloads read-heavy operations (e.g., catalog browsing and metrics).
5. **Message Broker**: RabbitMQ decouples slow or external processes (Payments, Notifications, Fulfillment) from the fast-path checkout flow.
6. **Outbox Pattern**: Prevents Dual-Write bugs. State changes (like `OrderConfirmed`) are written to an `OutboxEvent` table in the exact same Postgres transaction. A background worker sweeps these and guarantees at-least-once delivery to RabbitMQ.

## Infrastructure
Deployed natively via Docker Compose.
