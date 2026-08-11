const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required for seeding');
  const hash = await bcrypt.hash(password, 12);
  await prisma.admin.upsert({
    where: { email: email.toLowerCase().trim() },
    update: { password: hash },
    create: { email: email.toLowerCase().trim(), password: hash }
  });
  const existing = await prisma.product.count();
  if (existing === 0) {
    await prisma.product.create({
      data: {
        title: 'Happy Hair – Instant Seeds Powder Mix',
        description: 'Happy Hair nutrition product.',
        price: 699,
        image_url: '/images/w0ut7ai7_WhatsApp Image 2026-06-23 at 10.55.35 AM.jpeg',
        stock: 100
      }
    });
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => prisma.$disconnect());
