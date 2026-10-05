# SOLID Principles in SALESTORM

SALESTORM is designed explicitly avoiding the "Big Ball of Mud" anti-pattern. We leverage the 5 SOLID principles to ensure the codebase remains maintainable, decoupled, and scalable under extreme flash-sale loads.

## 1. Single Responsibility Principle (SRP)
**Definition**: A class or module should have one, and only one, reason to change.
**Implementation**: 
- **`outbox.worker.ts`**: Dedicated strictly to sweeping the database and publishing to RabbitMQ. It knows nothing about domain logic.
- **`ConsumerBase` (`consumer.base.ts`)**: Dedicated to RabbitMQ acknowledgment patterns and idempotency checking. It delegates actual business domain execution to its derived classes (like `NotificationConsumer`).
- **`CheckoutFacade`**: Handles exclusively the orchestration of converting a reservation into an order, pushing database interactions down to the `OrderRepository`.

## 2. Open/Closed Principle (OCP)
**Definition**: Software entities should be open for extension, but closed for modification.
**Implementation**: 
- **Payment Providers (`payment.provider.ts`)**: We implemented the **Strategy Pattern**. If the business wants to add PayPal or Braintree tomorrow, we simply create a new `PayPalAdapter implements PaymentStrategy`. We do not need to modify `payment.controller.ts` or `PaymentFactory` heavily, leaving existing code completely untouched and bug-free.

## 3. Liskov Substitution Principle (LSP)
**Definition**: Derived classes must be substitutable for their base classes.
**Implementation**:
- Both `StripeAdapter` and `MockAdapter` rigorously adhere to the `PaymentStrategy` interface. The `payment.controller.ts` uses them interchangeably via the Factory without ever needing to write `if (provider instanceof StripeAdapter)` type-checking hacks. They both guarantee a returning `PaymentResult`.

## 4. Interface Segregation Principle (ISP)
**Definition**: Clients should not be forced to depend upon interfaces that they do not use.
**Implementation**:
- We segregate our Fastify Route Schemas (e.g., `CheckoutRequestSchema`) using Zod.
- Our Repositories (like `OrderRepository`) only expose minimal methods (`findByReservation`, `createOrder`). They don't force a monolithic `IRepository` CRUD contract where `update()` or `delete()` methods throw `NotImplementedException` simply because we don't allow Orders to be deleted.

## 5. Dependency Inversion Principle (DIP)
**Definition**: Depend upon abstractions, not concretions.
**Implementation**:
- The HTTP controllers do not depend on direct database ORM instantiations for complex logic. `CheckoutFacade` relies on the `OrderRepository` abstraction.
- `payment.controller.ts` depends purely on the `PaymentStrategy` interface rather than directly instantiating the Mock or Stripe classes, resolving the concrete instance at runtime via the `PaymentFactory`. 
