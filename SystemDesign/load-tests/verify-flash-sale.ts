import { PrismaClient } from '../packages/database/node_modules/@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('\n=========================================');
  console.log('   FLASH SALE ACCEPTANCE VERIFICATION    ');
  console.log('=========================================\n');

  const productId = process.env.PRODUCT_ID;
  if (!productId) {
    console.error('❌ Please provide PRODUCT_ID environment variable.');
    process.exit(1);
  }

  // 1. Fetch physical database state
  const inventory = await prisma.inventory.findUnique({
    where: { productId }
  });

  const successfulReservationsCount = await prisma.reservation.count({
    where: { productId, status: 'PENDING' }
  });

  const duplicateReservationsCount = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM (
      SELECT "idempotencyKey" FROM "Reservation" 
      WHERE "productId" = ${productId} 
      GROUP BY "idempotencyKey" 
      HAVING COUNT(*) > 1
    ) as duplicates
  `;

  if (!inventory) {
    console.error('❌ Inventory not found for this product.');
    process.exit(1);
  }

  console.log('--- METRICS ---');
  console.log(`Starting Inventory:  100`);
  console.log(`Available Quantity:  ${inventory.availableQuantity}`);
  console.log(`Reserved Quantity:   ${inventory.reservedQuantity}`);
  console.log(`Sold Quantity:       ${inventory.soldQuantity}`);
  console.log(`Total Reservations:  ${successfulReservationsCount}`);
  console.log(`Duplicate Resvs:     ${(duplicateReservationsCount as any)[0].count}\n`);

  // 2. Validate Constraints
  let passed = true;
  const errors = [];

  if (successfulReservationsCount > 100) {
    passed = false;
    errors.push(`Oversold! Reservations (${successfulReservationsCount}) exceeded max stock (100).`);
  }
  
  if (inventory.availableQuantity < 0) {
    passed = false;
    errors.push(`Negative inventory anomaly! Available = ${inventory.availableQuantity}`);
  }

  if (inventory.reservedQuantity !== successfulReservationsCount) {
    passed = false;
    errors.push(`Mismatch! Reserved quantity (${inventory.reservedQuantity}) does not match active reservations (${successfulReservationsCount}).`);
  }

  if (Number((duplicateReservationsCount as any)[0].count) > 0) {
    passed = false;
    errors.push('Idempotency failure! Duplicate reservations found.');
  }

  if (passed) {
    console.log('✅ ALL ACCEPTANCE CRITERIA PASSED.');
    console.log('   Zero overselling achieved. System is strictly consistent.');
  } else {
    console.log('❌ ACCEPTANCE CRITERIA FAILED:');
    errors.forEach(e => console.log(`   - ${e}`));
  }
  
  console.log('\n=========================================');
  process.exit(passed ? 0 : 1);
}

verify().catch(console.error);
