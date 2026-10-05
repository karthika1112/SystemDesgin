# HACKATHON_DEMO.md
# SALESTORM AI COMMAND CENTER DEMO SCRIPT

## 0:00 - Introduction & Problem Statement
"Hello everyone, we are presenting SALESTORM, an AI-Powered Flash Sale Command Center.
The hardest problem in modern e-commerce is the Flash Sale concurrency problem: What happens when 10,000 bots and human customers compete for exactly 100 units of a highly-hyped product within the exact same second?
Standard systems crumble, oversell by thousands of units, or lock up the database. SALESTORM solves this while giving administrators an intelligent Operations Copilot."

## 0:30 - Architecture Overview
"Our architecture is built on a high-throughput Fastify API routing to a strict PostgreSQL ACID transactional core. We utilize Redis for lock-free idempotent caching and RabbitMQ for asynchronous event-driven Outbox processing (ensuring no critical business event is ever lost).
On top of this sits our AI Intelligence Layer—a deterministic, read-only decision support engine that monitors real-time telemetry."

## 1:15 - Concurrency & Load Test Simulation
"Let's start the Flash Sale.
*(Execute `npm run load-test` in the terminal to spawn 10,000 concurrent k6 Virtual Users hitting the reservations endpoint)*
You can see 10,000 concurrent users immediately hammer the system. The reservation engine strictly enforces database row-level locking mapped to Idempotency Keys. 
As you can see on the AI Dashboard, we have exactly 100 successful reservations and 9,900 rejections. **OVERSOLD = 0.**"

## 2:00 - Failure Injection & Chaos Testing
"Now, let's look at our AI Anomaly Detector. We are going to trigger a Chaos Event: `PAYMENT_GATEWAY_SLOW`.
*(Click 'Trigger Payment Chaos' on the UI or hit `POST /api/admin/chaos/scenario`)*
Instantly, our SSE Event Stream lights up. The AI Anomaly engine detects an `UNUSUAL_LATENCY` and `PAYMENT_SPIKE` anomaly. It mathematically isolates the payment baseline degradation and alerts the admin to check the Circuit Breaker."

## 2:30 - Order Failure & Recovery Mechanism
"But what if the Order Service completely crashes during peak checkout?
We'll shut down the Order worker. 
A customer completes their payment successfully. The payment is committed. However, the order cannot be created. 
Because we use the Transactional Outbox Pattern, the `PaymentSucceeded` event is safely parked in RabbitMQ.
Now we restore the Order worker. Watch the event stream: the DLQ retries the event, the Order is instantly confirmed, and database consistency is perfectly maintained without losing the customer's purchase."

## 3:30 - AI Natural Language Copilot
"During all this chaos, the administrator can consult the AI Copilot. 
*(Type in the Copilot Chat: "Why did checkout latency increase?")*
The AI maps this intent safely to our latency telemetry aggregates, completely bypassing arbitrary SQL risks. It evaluates the metric and outputs: *'Checkout is slow. Average latency is 850ms. Confidence: 92%.'* along with actionable mitigation strategies."

## 4:00 - AI What-If Simulator
"Before our next sale, we want to know what happens if we secure 500 units instead of 100.
We input the parameters into the AI Simulator. It deterministically computes the expected reservation load against our current hardware baseline, warning us if RabbitMQ queue pressure will exceed acceptable thresholds."

## 4:30 - The War Room
"All of this culminates in the Flash Sale War Room—a real-time glowing command center aggregating Inventory Pressure, Live Traffic, Payment Conversion, Queue Backlog, and active AI Anomalies into one cohesive pane of glass."

## 5:00 - Final Verification
"To conclude, our automated verification script ran after the load test. 
- Inventory consistency: **PASS**
- Duplicate transactions: **0**
- Oversold: **0**

Thank you."
