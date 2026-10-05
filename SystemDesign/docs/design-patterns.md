# Design Patterns in SALESTORM

The SALESTORM backend applies canonical Gang of Four (GoF) and distributed systems design patterns to solve high-concurrency flash sale challenges elegantly.

## 1. Strategy Pattern
- **Where**: `payment.provider.ts` (`PaymentStrategy` interface, `StripeAdapter`, `MockAdapter`).
- **Why**: Payment gateways have entirely different SDKs and requirements. 
- **Benefit**: Easily swap gateways at runtime (e.g., A/B testing gateways or failing over).
- **Trade-off**: Requires building an internal standard data contract (`PaymentResult`) that fits all providers.

## 2. Factory Pattern
- **Where**: `PaymentFactory.getProvider()` inside `payment.provider.ts`.
- **Why**: To encapsulate the instantiation logic of the correct payment strategy based on environment variables or runtime configuration.
- **Benefit**: Keeps the controller clean. The controller just asks for "a provider" without knowing how to build it.
- **Trade-off**: Slightly more boilerplate for object creation.

## 3. Adapter Pattern
- **Where**: `StripeAdapter` and `MockAdapter`.
- **Why**: External APIs (like Stripe) do not match our internal `ChargeParams` interface natively.
- **Benefit**: Isolates external vendor breaking changes. If Stripe changes their API, we only update `StripeAdapter`, not our domain logic.
- **Trade-off**: Can create translation layers that mask advanced, vendor-specific features.

## 4. State Pattern
- **Where**: `OrderStateService` (`order.state.ts`).
- **Why**: An Order moves through strict lifecycles (`CREATED` -> `PAYMENT_PENDING` -> `CONFIRMED` -> `SHIPPED`).
- **Benefit**: Prevents illegal state transitions (e.g., you cannot transition a `CANCELLED` order to `SHIPPED`). It centralizes the massive side-effects (like releasing inventory on cancellation) directly into the transition logic.
- **Trade-off**: The State Machine file can become a complex bottleneck if it grows too large.

## 5. Observer Pattern (Distributed)
- **Where**: RabbitMQ Event Bus (`outbox.worker.ts` as Publisher, `notification.consumer.ts` as Subscriber).
- **Why**: Decoupling domain side-effects. When an Order is confirmed, the Notification service needs to know, but the Order service shouldn't be responsible for sending emails.
- **Benefit**: Massive scalability and fault isolation. If the Notification service goes down, the Order is still confirmed safely.
- **Trade-off**: Introduces Eventual Consistency. Developers must trace distributed logs to debug failures.

## 6. Repository Pattern
- **Where**: `OrderRepository` (`order.repository.ts`).
- **Why**: To abstract Prisma ORM calls away from business orchestration logic.
- **Benefit**: Simplifies unit testing (can mock the repo easily) and centralizes DB access patterns.
- **Trade-off**: Can sometimes feel like redundant wrapping over modern active-record ORMs like Prisma.

## 7. Facade Pattern
- **Where**: `CheckoutFacade` (`checkout.facade.ts`).
- **Why**: The checkout process touches multiple domains: checking duplicate orders, validating expiration timestamps, and creating the order items.
- **Benefit**: Exposes a beautifully simple `processCheckout(reservationId, userId)` method to the HTTP Controller, hiding the terrifying complexity of the underlying transactional orchestration.
- **Trade-off**: The Facade itself can turn into a "God Object" if not strictly monitored.

## 8. Circuit Breaker
- **Where**: `CircuitBreaker` (`circuit-breaker.ts`) applied in `payment.controller.ts`.
- **Why**: If our third-party payment gateway goes down and starts timing out (taking 30 seconds to fail), 10,000 flash sale users will instantly exhaust all our server's HTTP threads waiting for those timeouts.
- **Benefit**: After N consecutive failures, the breaker trips `OPEN` and immediately rejects subsequent requests locally (fail-fast), protecting our server resources until the upstream provider recovers.
- **Trade-off**: Tricky to configure thresholds correctly. A threshold too low causes false-positives; too high causes resource exhaustion.
