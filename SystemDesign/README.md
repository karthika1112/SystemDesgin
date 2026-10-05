# ⚡ SALESTORM
**High-Concurrency Flash Sale E-Commerce Platform**

SALESTORM is a production-grade, strictly consistent, event-driven e-commerce architecture explicitly built to survive 10,000+ simultaneous checkout requests targeting 100 physical inventory units—with exactly zero overselling.

---

## 1. Prerequisites
- **Docker** and **Docker Compose** installed.
- **Node.js** (v20+) (If running native tests).
- **k6** (Optional, for running load tests natively).

## 2. Installation
Clone the repository:
```bash
git clone https://github.com/Dhevavarshana/One.git salestorm
cd salestorm
```

## 3. Environment Setup
Copy the `.env.example` to create your local variables (Docker uses these implicitly):
```bash
cp .env.example .env
```

## 4. Database Migration
To apply the strict PostgreSQL schema to your Docker database:
```bash
# 1. Start the dependencies
docker-compose up -d postgres redis rabbitmq

# 2. Wait 10 seconds for DB to initialize, then run migration
npx prisma db push
```

## 5. Seed
Seed the database with the Admin account, Demo Customer, and the Flash Sale product (100 units):
```bash
npm run seed -w packages/database
```
*(Note: If you run into Windows symlink workspace errors natively, you can run this command directly inside the API docker container via `docker exec -it <container_id> npx prisma db seed`)*

## 6. Start Application
Start the entire 5-container architecture (PostgreSQL, Redis, RabbitMQ, API, React Frontend) with automated health-check dependency handling:
```bash
# Standard mode
docker-compose up --build

# Development mode (Local Volume Hot-Reloading enabled)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```
- **Web UI**: `http://localhost:5173`
- **Backend API**: `http://localhost:3000`

## 7. Run Tests
The repository features strict domain integration and security testing.
```bash
npm run test -w apps/api
```

## 8. Run Load Test
Use our engineered k6 scripts to simulate a flash sale.
```bash
# Developer Laptop Profile (1000 users)
k6 run load-tests/flash-sale.js -e TOKEN="<your_jwt>" -e PRODUCT_ID="<product_id>"

# 10,000 User Production Simulation
k6 run load-tests/flash-sale.js -e TOKEN="<your_jwt>" -e PRODUCT_ID="<product_id>" -e VUS=10000

# Strict Verification (Ensures Overselling = 0)
npx tsx load-tests/verify-flash-sale.ts
```

## 9. Swagger URL
Detailed, automatically generated OpenAPI documentation is available via:
**http://localhost:3000/documentation**

## 10. Admin Login
Use the seeded credentials to access the metrics Command Center:
- **Email**: `admin@salestorm.com`
- **Password**: `admin123`
Navigate to **Admin** -> **Telemetry** in the top navigation bar to view real-time system throughput and inventory drain rates.

## 11. Demo Flash-Sale Flow
1. Open the UI (`http://localhost:5173`).
2. Log in as a customer (Register an account).
3. Click into the **Active Drop** (Flash Sale Product).
4. Note the `"⚡ Flash Sale - Only 100 available!"` tag.
5. Click **Buy Now**. Behind the scenes, the API maps an `Idempotency-Key` and secures an atomic lock against PostgreSQL.
6. Progress through **Checkout** -> **Pay Now**.
7. Navigate to your **Orders** tab to watch your order progress.
8. As the Admin, monitor the **Telemetry Dashboard** to watch the Outbox RabbitMQ queue process the transaction asynchronously!
