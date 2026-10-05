# ADR 0001: Strict Consistency for Flash Sale Inventory

**Status:** Accepted
**Date:** 2026-10-05

## Context
In a flash sale, 10,000+ concurrent requests attempt to purchase 100 units of a product within seconds. Using standard check-then-update logic (e.g., read stock -> if stock > 0 -> decrement stock -> save) guarantees race conditions and catastrophic overselling.

Alternative options explored:
1. **Redis Counters**: Use `INCRBY` / `DECRBY`. Fast, but risks data loss on cluster failover. Complex to rollback if payment fails.
2. **PostgreSQL Row Locks**: `SELECT ... FOR UPDATE`. Heavy. Serializes all 10,000 requests, crushing database throughput.

## Decision
We chose **Optimistic Concurrency / Atomic Updates via PostgreSQL**. 
We execute: `UPDATE inventory SET available = available - 1 WHERE id = ? AND available >= 1;`
If `affected_rows == 0`, the item is out of stock.

## Consequences
- **Positive**: Absolutely zero overselling is mathematically guaranteed by the database engine. Throughput remains very high as failed requests are instantly rejected.
- **Negative**: The database takes the brunt of the load. To mitigate this, read-heavy metrics and catalogs must be heavily cached in Redis.
