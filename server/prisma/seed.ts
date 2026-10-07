 
import { PrismaClient, type Category, type ItemCondition, type RentalStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { calculateRentalPrice } from '../src/services/pricing.js';
import { resolvePeriod } from '../src/services/availability.js';
import { addDaysToDate, todayLocal } from '../src/lib/time.js';
import { DEFAULT_SETTINGS } from '../src/services/settings.js';

const prisma = new PrismaClient();

const DAY = 86400000;
const today = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};
const d = (offset: number) => new Date(today().getTime() + offset * DAY);

// DEVELOPMENT CREDENTIALS ONLY – change/remove before any production deployment.
export const ADMIN_EMAIL = 'admin@shareon.local';
// In production the admin password MUST come from SEED_ADMIN_PASSWORD (never the public default).
export const ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'AdminShareOn2024');
export const USER_PASSWORD = 'Heslo12345';

const users = [
  { name: 'Jana Kováčová', email: 'jana@example.sk', phone: '+421 905 111 222', bio: 'Záhradníčka z Terasy. Rada požičiam náradie susedom.' },
  { name: 'Martin Horváth', email: 'martin@example.sk', phone: '+421 907 222 333', bio: 'Kutil, mám dielňu plnú náradia.' },
  { name: 'Lucia Tóthová', email: 'lucia@example.sk', phone: '+421 908 333 444', bio: 'Športujem, cestujem, požičiavam.' },
  { name: 'Peter Varga', email: 'peter@example.sk', phone: '+421 910 444 555', bio: 'Víkendový cyklista a stanovač.' },
  { name: 'Zuzana Baláž', email: 'zuzana@example.sk', phone: '+421 911 555 666', bio: 'Mama dvoch detí, rada skúšam nové veci bez kupovania.' },
  { name: 'Tomáš Molnár', email: 'tomas@example.sk', phone: '+421 915 666 777', bio: 'Študent TUKE.' },
  { name: 'Eva Szabóová', email: 'eva@example.sk', phone: '+421 917 777 888', bio: 'Milujem prírodu a záhradu.' },
];

type SeedItem = {
  owner: number;
  title: string;
  category: Category;
  description: string;
  price: number | null;
  /** € per hour – enables hourly rental */
  hourly?: number;
  bufferHours?: number;
  value: number;
  condition: ItemCondition;
  image: string;
};

const items: SeedItem[] = [
  { owner: 0, title: 'Benzínová kosačka na trávu', category: 'GARDEN', description: 'Spoľahlivá benzínová kosačka so záberom 46 cm a košom na trávu. Vhodná pre záhradu do 800 m².', price: 12, value: 280, condition: 'VERY_GOOD', image: '/placeholders/garden.svg' },
  { owner: 0, title: 'Plotostrih aku 18V', category: 'GARDEN', description: 'Akumulátorový plotostrih s dĺžkou lišty 55 cm, batéria a nabíjačka v cene.', price: 7, hourly: 2, value: 120, condition: 'GOOD', image: '/placeholders/garden-2.svg' },
  { owner: 6, title: 'Vertikutátor elektrický', category: 'GARDEN', description: 'Elektrický vertikutátor na prevzdušnenie trávnika, záber 32 cm, kôš 30 l.', price: null, hourly: 3, value: 150, condition: 'GOOD', image: '/placeholders/garden.svg' },
  { owner: 6, title: 'Záhradný drvič konárov', category: 'GARDEN', description: 'Drvič konárov do priemeru 40 mm. Ideálny na jarné strihanie stromov.', price: 15, value: 350, condition: 'USED', image: '/placeholders/garden-2.svg' },
  { owner: 1, title: 'Príklepová vŕtačka Bosch-like 750W', category: 'WORKSHOP', description: 'Výkonná príklepová vŕtačka 750 W, sada vrtákov do betónu a dreva v kufri.', price: 8, hourly: 3, bufferHours: 1, value: 100, condition: 'VERY_GOOD', image: '/placeholders/workshop.svg' },
  { owner: 1, title: 'Kotúčová píla 1400W', category: 'WORKSHOP', description: 'Ručná kotúčová píla s vodiacou lištou, hĺbka rezu 65 mm. Kotúč na drevo vymenený.', price: 10, value: 190, condition: 'GOOD', image: '/placeholders/workshop-2.svg' },
  { owner: 1, title: 'Tlakový čistič 140 bar', category: 'WORKSHOP', description: 'Vysokotlakový čistič na terasy, autá a fasády. Hadica 8 m, rotačná tryska.', price: 11, hourly: 4, bufferHours: 1, value: 220, condition: 'VERY_GOOD', image: '/placeholders/workshop.svg' },
  { owner: 1, title: 'Hliníkový rebrík 3×9', category: 'WORKSHOP', description: 'Trojdielny kombinovaný rebrík, max. pracovná výška 6,5 m. Drobné škrabance.', price: 8, value: 160, condition: 'WORN', image: '/placeholders/workshop-2.svg' },
  { owner: 2, title: 'Paddleboard nafukovací 320 cm', category: 'SPORT', description: 'Nafukovací paddleboard s pádlom, pumpou a batohom. Nosnosť 120 kg.', price: 14, value: 400, condition: 'VERY_GOOD', image: '/placeholders/sport.svg' },
  { owner: 2, title: 'Horský bicykel 29" veľkosť L', category: 'SPORT', description: 'Hardtail MTB, hydraulické brzdy, 1×12 prevodovka. Prilba na požiadanie.', price: 16, value: 650, condition: 'GOOD', image: '/placeholders/sport-2.svg' },
  { owner: 3, title: 'Bežky s viazaním, veľ. 190 cm', category: 'SPORT', description: 'Klasické bežecké lyže s viazaním NNN, palice v cene. Topánky veľkosť 43.', price: 8, value: 180, condition: 'USED', image: '/placeholders/sport.svg' },
  { owner: 3, title: 'Stan pre 4 osoby', category: 'LEISURE', description: 'Rodinný stan s predsieňou, vodný stĺpec 3000 mm. Vhodný na kempovanie.', price: 9, value: 210, condition: 'VERY_GOOD', image: '/placeholders/leisure.svg' },
  { owner: 4, title: 'Prenosný projektor + plátno', category: 'LEISURE', description: 'Full HD projektor s plátnom 100", ideálny na letné kino na záhrade.', price: 13, hourly: 5, value: 300, condition: 'GOOD', image: '/placeholders/leisure-2.svg' },
  { owner: 4, title: 'Detský bicyklový vozík', category: 'LEISURE', description: 'Vozík za bicykel pre 2 deti, s pláštenkou a vlajočkou. Dá sa použiť aj ako kočík.', price: 10, value: 250, condition: 'GOOD', image: '/placeholders/leisure.svg' },
  { owner: 5, title: 'Plynový gril s 3 horákmi', category: 'OTHER', description: 'Plynový gril s tromi horákmi a bočnou platňou, bez plynovej fľaše.', price: 12, value: 330, condition: 'NEW', image: '/placeholders/other.svg' },
];

const main = async () => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
    throw new Error('Refusing to seed in production. The seed DELETES all data. Set ALLOW_SEED=true only for a disposable demo database.');
  }
  if (ADMIN_PASSWORD.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be set (min. 12 characters) when seeding in production.');
  }
  console.info('Seeding ShareOn…');
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.adminDecision.deleteMany(),
    prisma.reportEvidence.deleteMany(),
    prisma.damageReport.deleteMany(),
    prisma.handoverPhoto.deleteMany(),
    prisma.handoverRecord.deleteMany(),
    prisma.review.deleteMany(),
    prisma.itemReview.deleteMany(),
    prisma.protectionRecord.deleteMany(),
    prisma.protectionQuote.deleteMany(),
    prisma.deposit.deleteMany(),
    prisma.rentalRequest.deleteMany(),
    prisma.favorite.deleteMany(),
    prisma.itemImage.deleteMany(),
    prisma.item.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.appSetting.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const [adminHash, userHash] = await Promise.all([bcrypt.hash(ADMIN_PASSWORD, 12), bcrypt.hash(USER_PASSWORD, 12)]);
  const admin = await prisma.user.create({
    data: { name: 'ShareOn Admin', email: ADMIN_EMAIL, phone: '+421 900 000 000', city: 'Košice', role: 'ADMIN', passwordHash: adminHash },
  });
  const u = [] as { id: string }[];
  for (const x of users) u.push(await prisma.user.create({ data: { ...x, city: 'Košice', passwordHash: userHash } }));

  const it = [] as Awaited<ReturnType<typeof prisma.item.create>>[];
  for (const [idx, x] of items.entries()) {
    const created = await prisma.item.create({
      data: {
        ownerId: u[x.owner].id,
        title: x.title,
        category: x.category,
        description: x.description,
        dailyRentalEnabled: x.price != null,
        dailyPriceCents: x.price != null ? x.price * 100 : null,
        hourlyRentalEnabled: x.hourly != null,
        hourlyPriceCents: x.hourly != null ? x.hourly * 100 : null,
        minRentalHours: 1,
        maxRentalHours: 10,
        availableFromTime: '08:00',
        availableToTime: '20:00',
        bufferHours: x.bufferHours ?? 0,
        replacementValueCents: x.value * 100,
        city: 'Košice',
        condition: x.condition,
        availableFrom: d(-120),
        availableTo: d(240),
        protectionEligible: idx !== 7, // the worn ladder is not eligible for protection
        declarationsAcceptedAt: new Date(),
        createdAt: new Date(Date.now() - (items.length - idx) * 36e5 * 20),
        images: { create: [{ url: x.image, position: 0 }] },
      },
    });
    it.push(created);
  }

  // Days are inclusive (start and end date both count). Hourly specs use a single day + times.
  const rentalSpecs: { item: number; renter: number; start: number; end: number; status: RentalStatus; msg: string; times?: [string, string] }[] = [
    { item: 0, renter: 1, start: -40, end: -37, status: 'COMPLETED', msg: 'Dobrý deň, potreboval by som pokosiť záhradu na chate.' },
    { item: 4, renter: 0, start: -30, end: -28, status: 'COMPLETED', msg: 'Ahoj, potrebujem zavesiť poličky.' },
    { item: 8, renter: 3, start: -20, end: -17, status: 'COMPLETED', msg: 'Chceli by sme ísť na Ružín.' },
    { item: 11, renter: 4, start: -15, end: -12, status: 'COMPLETED', msg: 'Ideme na víkend kempovať do Slovenského raja.' },
    { item: 5, renter: 6, start: -10, end: -8, status: 'DISPUTED', msg: 'Potrebujem narezať dosky na vyvýšené záhony.' },
    { item: 9, renter: 5, start: -2, end: 2, status: 'ACTIVE', msg: 'Chcem si vyskúšať MTB pred kúpou.' },
    { item: 12, renter: 2, start: 3, end: 5, status: 'ACCEPTED', msg: 'Letné kino pre susedov :)' },
    { item: 1, renter: 4, start: 6, end: 8, status: 'PENDING', msg: 'Dobrý deň, mohla by som si požičať plotostrih?' },
    { item: 6, renter: 3, start: 10, end: 11, status: 'PENDING', msg: 'Potrebujem umyť terasu pred grilovačkou.' },
    { item: 14, renter: 0, start: 12, end: 13, status: 'REJECTED', msg: 'Oslava narodenín v sobotu.' },
    { item: 4, renter: 5, start: 4, end: 4, times: ['14:00', '18:00'], status: 'ACCEPTED', msg: 'Potrebujem na pár hodín vŕtačku – montáž kuchynky.' },
  ];
  const local = (offset: number) => addDaysToDate(todayLocal(), offset);

  const rentals = [] as { id: string; ownerId: string; renterId: string; itemId: string; status: RentalStatus }[];
  for (const spec of rentalSpecs) {
    const item = it[spec.item];
    const period = resolvePeriod(
      spec.times
        ? { rentalMode: 'HOURLY', startDate: local(spec.start), startTime: spec.times[0], endTime: spec.times[1] }
        : { rentalMode: 'DAILY', startDate: local(spec.start), endDate: local(spec.end) },
    );
    const price = await calculateRentalPrice(item, period.duration, DEFAULT_SETTINGS);
    const accepted = !['PENDING', 'REJECTED'].includes(spec.status);
    const done = spec.status === 'COMPLETED';
    const rental = await prisma.rentalRequest.create({
      data: {
        itemId: item.id,
        renterId: u[spec.renter].id,
        ownerId: item.ownerId,
        rentalMode: period.mode,
        startDate: new Date(`${period.startDate}T00:00:00Z`),
        endDate: new Date(`${period.endDate}T00:00:00Z`),
        startTime: period.startTime,
        endTime: period.endTime,
        startAt: period.startAt,
        endAt: period.endAt,
        durationMinutes: price.durationMinutes,
        durationDays: price.durationDays,
        message: spec.msg,
        handoverMethod: 'PERSONAL_PICKUP',
        status: spec.status,
        pricePerUnitCents: price.pricePerUnitCents,
        refundableCents: price.refundableCents,
        rentalPriceCents: price.rentalPriceCents,
        protectionFeeCents: price.protectionFeeCents,
        depositCents: price.depositCents,
        platformFeeCents: price.platformFeeCents,
        totalCents: price.totalCents,
        protectionMode: price.protectionMode,
        rulesAcceptedAt: d(spec.start - 3),
        protectionDisclaimerAcceptedAt: price.protectionFeeCents > 0 ? d(spec.start - 3) : null,
        acceptedAt: accepted ? d(spec.start - 2) : null,
        rejectedAt: spec.status === 'REJECTED' ? new Date() : null,
        ownerNote: spec.status === 'REJECTED' ? 'Prepáčte, gril bude v tom termíne u mňa.' : null,
        activeAt: ['ACTIVE', 'COMPLETED', 'DISPUTED'].includes(spec.status) ? d(spec.start) : null,
        returnedAt: done || spec.status === 'DISPUTED' ? d(spec.end) : null,
        completedAt: done ? d(spec.end) : null,
        createdAt: d(spec.start - 3),
      },
    });
    rentals.push(rental);

    if (price.protection?.available) {
      await prisma.protectionQuote.create({
        data: {
          itemId: item.id,
          rentalRequestId: rental.id,
          userId: u[spec.renter].id,
          provider: price.protection.provider,
          mode: price.protection.mode,
          isDemo: true,
          replacementValueCents: item.replacementValueCents,
          protectedValueCents: price.protection.protectedValueCents,
          rentalMode: price.rentalMode,
          rentalDays: price.durationDays,
          durationMinutes: price.durationMinutes,
          feeCents: price.protection.feeCents,
          inputs: price.protection.breakdown,
          expiresAt: d(spec.start + 4),
        },
      });
    }
    if (accepted) {
      if (price.protectionFeeCents > 0) {
        await prisma.protectionRecord.create({
          data: {
            rentalRequestId: rental.id,
            provider: 'mock',
            mode: 'PROTECTION_FEE',
            status: done ? 'EXPIRED' : spec.status === 'DISPUTED' ? 'CLAIM_UNDER_REVIEW' : 'ACTIVE',
            isDemo: true,
            feeCents: price.protectionFeeCents,
            protectedValueCents: price.protection!.protectedValueCents,
            idempotencyKey: `rental:${rental.id}:protection`,
          },
        });
      }
      await prisma.deposit.create({
        data: {
          rentalRequestId: rental.id,
          amountCents: price.depositCents,
          status: done ? 'RELEASED' : spec.status === 'DISPUTED' ? 'DISPUTED' : 'HELD',
          provider: 'mock',
          isSimulated: true,
          idempotencyKey: `rental:${rental.id}:deposit`,
          heldAt: d(spec.start - 2),
          releasedAt: done ? d(spec.end) : null,
        },
      });
    }
    if (['ACTIVE', 'COMPLETED', 'DISPUTED'].includes(spec.status)) {
      for (const role of ['OWNER', 'RENTER'] as const) {
        await prisma.handoverRecord.create({
          data: {
            rentalRequestId: rental.id,
            type: 'HANDOVER',
            partyRole: role,
            userId: role === 'OWNER' ? item.ownerId : u[spec.renter].id,
            note: role === 'OWNER' ? 'Odovzdané v poriadku, bez poškodení.' : 'Prevzaté, všetko sedí s popisom.',
            confirmedAt: d(spec.start),
          },
        });
      }
    }
    if (done || spec.status === 'DISPUTED') {
      for (const role of ['OWNER', 'RENTER'] as const) {
        await prisma.handoverRecord.create({
          data: {
            rentalRequestId: rental.id,
            type: 'RETURN',
            partyRole: role,
            userId: role === 'OWNER' ? item.ownerId : u[spec.renter].id,
            itemOk: role === 'OWNER' ? done : null,
            note: role === 'OWNER' ? (done ? 'Vrátené čisté a funkčné.' : 'Na kryte píly je prasklina.') : 'Vrátené v dohodnutom čase.',
            confirmedAt: d(spec.end),
          },
        });
      }
    }
  }

  // Reviews for completed rentals
  const completed = rentals.filter((r) => r.status === 'COMPLETED');
  const comments = [
    ['Super komunikácia, kosačka fungovala perfektne.', 'Martin vrátil kosačku čistú a načas. Odporúčam!'],
    ['Vŕtačka ako nová, odovzdanie bez problémov.', 'Jana je spoľahlivá, kedykoľvek znova.'],
    ['Paddleboard bol skvelý, všetko podľa popisu.', 'Peter sa o paddleboard staral výborne.'],
    ['Stan bol kompletný a čistý.', 'Zuzana vrátila stan suchý a zbalený. Ďakujem!'],
  ];
  for (const [i, r] of completed.entries()) {
    await prisma.review.create({
      data: { rentalRequestId: r.id, authorId: r.renterId, targetId: r.ownerId, type: 'RENTER_TO_OWNER', overall: i === 3 ? 4 : 5, comment: comments[i][0], punctuality: 5, communication: 5, reliability: i === 3 ? 4 : 5 },
    });
    await prisma.review.create({
      data: { rentalRequestId: r.id, authorId: r.ownerId, targetId: r.renterId, type: 'OWNER_TO_RENTER', overall: 5, comment: comments[i][1], communication: 5, respectfulUse: 5, onTimeReturn: i === 2 ? 4 : 5 },
    });
    await prisma.itemReview.create({
      data: { rentalRequestId: r.id, itemId: r.itemId, authorId: r.renterId, descriptionAccuracy: 5, itemCondition: i === 3 ? 4 : 5, valueForMoney: 4, handoverExperience: 5, overall: i === 3 ? 4 : 5, comment: comments[i][0] },
    });
  }

  // Reports: one open dispute (damaged saw) and one listing report
  const disputed = rentals.find((r) => r.status === 'DISPUTED')!;
  const dispute = await prisma.damageReport.create({
    data: {
      rentalRequestId: disputed.id,
      itemId: disputed.itemId,
      reporterId: disputed.ownerId,
      reportedUserId: disputed.renterId,
      type: 'ITEM_DAMAGED',
      description: 'Po vrátení som zistil prasklinu na ochrannom kryte kotúča. Pred požičaním bol kryt v poriadku (viď fotky pri odovzdaní).',
      requestedAmountCents: 4500,
      status: 'UNDER_REVIEW',
      evidence: {
        create: [
          { authorId: disputed.ownerId, kind: 'EVIDENCE', text: 'Kryt bol pri odovzdaní celý, prasklina je nová.' },
          { authorId: disputed.renterId, kind: 'RESPONSE', text: 'Pílu som používala opatrne, prasklinu som si pri vrátení nevšimla. Môže ísť o staršie poškodenie.' },
        ],
      },
    },
  });
  await prisma.damageReport.create({
    data: {
      itemId: it[7].id,
      reporterId: u[5].id,
      reportedUserId: it[7].ownerId,
      type: 'ITEM_DIFFERENT_THAN_DESCRIPTION',
      description: 'Na fotke rebrík vyzerá v lepšom stave, ako je uvedené v popise.',
      status: 'OPEN',
    },
  });
  await prisma.auditLog.create({
    data: { adminId: admin.id, action: 'REPORT_STATUS_CHANGED', entityType: 'DamageReport', entityId: dispute.id, oldValue: { status: 'OPEN' }, newValue: { status: 'UNDER_REVIEW' } },
  });

  await prisma.favorite.createMany({
    data: [
      { userId: u[0].id, itemId: it[8].id },
      { userId: u[0].id, itemId: it[11].id },
      { userId: u[3].id, itemId: it[0].id },
    ],
  });
  await prisma.notification.createMany({
    data: [
      { userId: u[0].id, type: 'RENTAL_REQUESTED', title: 'Nová žiadosť o požičanie: Plotostrih aku 18V', link: `/requests/${rentals[7].id}` },
      { userId: u[1].id, type: 'REPORT_UPDATED', title: 'Druhá strana odpovedala na hlásenie', link: `/reports/${dispute.id}` },
    ],
  });

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.appSetting.create({ data: { key, value } });
  }
  // A fresh seed already contains the current demo data (see upgrades in seed-if-empty.ts).
  await prisma.appSetting.create({ data: { key: 'demoDataVersion', value: 2 } });

  console.info(`Done: ${u.length + 1} users, ${it.length} items, ${rentals.length} rental requests.`);
  console.info(
    process.env.NODE_ENV === 'production'
      ? `Admin: ${ADMIN_EMAIL} (password from SEED_ADMIN_PASSWORD)`
      : `Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} (development only!)`,
  );
  console.info(`Users: e.g. jana@example.sk / ${USER_PASSWORD}`);
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
