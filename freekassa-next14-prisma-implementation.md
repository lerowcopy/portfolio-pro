# FreeKassa вместо Stripe в Next.js 14 + Prisma

> **Важная техническая оговорка:** FreeKassa использует не Stripe-style signed JSON webhook, а два разных механизма. Для API-запросов применяется HMAC-SHA256 от отсортированных параметров с API key; для успешного Result URL — MD5 от `MERCHANT_ID:AMOUNT:SECRET_WORD_2:MERCHANT_ORDER_ID`. Поэтому нельзя буквально перенести Stripe signature verification. Надёжная реализация ниже одновременно проверяет подпись, merchant ID, IP allow-list (только за доверенным proxy), сумму, локальный order и идемпотентность. [1]

FreeKassa документирует рекуррентные платежи как первоначальный order с `recurrent: "Y"`, а каждый последующий charge создаётся позднее через `recurrent_order_id`; следовательно, подписка требует планировщика (например, Vercel Cron) и не является «вечным» разовым checkout. [1]

## Файлы и ключевые решения

| Файл | Назначение |
|---|---|
| `package.json` | Удаляет Stripe. Отдельный официальный Node SDK FreeKassa не требуется: используется строго типизированный REST client на native `fetch`. |
| `.env.local.example` | Секреты магазина, API key, цены планов, URL и cron secret. |
| `lib/freekassa.ts` | FreeKassa REST client, HMAC signing, callback signature, exact RUB/kopeck conversion и plan catalog. |
| `lib/auth.ts` | Минимальный Auth.js v5 adapter, который возвращает server-verified user или 401. |
| `prisma/schema.prisma` | Локальные order/subscription records, payment statuses и idempotency constraints. |
| `app/api/checkout/route.ts` | Создаёт локальный order, затем удалённый FreeKassa order и возвращает hosted payment URL. |
| `app/api/webhooks/freekassa/route.ts` | Принимает form-data callback, validates signature/amount/order/IP and grants entitlement atomically. |
| `app/api/cron/freekassa-renew/route.ts` | Создаёт следующий recurring order для due subscription. Это обязательное дополнение для подписок. |
| `app/pricing/page.tsx` | Client UI, который передаёт только plan code, ожидает URL от server и перенаправляет пользователя. |

---

## 1. `package.json` updates

По официальному списку SDK FreeKassa отсутствует verified first-party Node/TypeScript package. Добавление случайного npm SDK в платёжный контур хуже, чем небольшой typed REST adapter: FreeKassa публикует API через JSON HTTP и описывает HMAC подпись запросов. [1]

Удалите Stripe пакеты и оставьте встроенный `fetch` Next.js. Если `zod`, Prisma и React уже есть, новых зависимостей не требуется.

```jsonc
{
  "dependencies": {
    // УДАЛИТЬ: "stripe": "...",
    "@prisma/client": "^5.22.0",
    "zod": "^3.24.0",
    "next": "14.x",
    "react": "^18.x",
    "react-dom": "^18.x"
  },
  "devDependencies": {
    "prisma": "^5.22.0",
    "typescript": "^5.x"
  }
}
```

```bash
pnpm remove stripe @stripe/stripe-js
pnpm prisma generate
```

---

## 2. `.env.local.example`

```dotenv
# Публичный origin приложения. В production используйте https://portfolio.pro
NEXT_PUBLIC_APP_URL=http://localhost:3000

# FreeKassa: Merchant dashboard → Настройки магазина.
FREEKASSA_SHOP_ID=12345
FREEKASSA_API_KEY=replace_with_api_key
FREEKASSA_SECRET_WORD_1=replace_with_payment_form_secret
FREEKASSA_SECRET_WORD_2=replace_with_result_callback_secret

# Платёжная система, которую FreeKassa откроет по умолчанию. Проверяйте доступность
# конкретного метода в своём merchant account. 1 — пример, а не универсальная рекомендация.
FREEKASSA_PAYMENT_SYSTEM_ID=1

# Server-only цены в копейках. Клиент никогда не передаёт сумму.
FREEKASSA_STARTER_AMOUNT_KOPEKS=49000
FREEKASSA_PRO_AMOUNT_KOPEKS=99000
FREEKASSA_BUSINESS_AMOUNT_KOPEKS=199000

# Защита Vercel Cron endpoint для следующих recurring списаний.
CRON_SECRET=generate_a_random_32_plus_character_secret

# Включайте только когда хостинг гарантированно переписывает proxy headers.
# Список IP следует сверять с актуальной документацией FreeKassa до production запуска.
FREEKASSA_ENFORCE_IP_ALLOWLIST=false
```

Не добавляйте этот файл в git. В Vercel задайте такие же значения в **Settings → Environment Variables**, но никогда не добавляйте префикс `NEXT_PUBLIC_` к API key или secret words.

---

## 3. `lib/freekassa.ts`

```ts
// lib/freekassa.ts
import "server-only";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const FREEKASSA_API_BASE = "https://api.fk.life/v1";

const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const freeKassaConfig = {
  shopId: Number(requiredEnv("FREEKASSA_SHOP_ID")),
  apiKey: requiredEnv("FREEKASSA_API_KEY"),
  secretWord1: requiredEnv("FREEKASSA_SECRET_WORD_1"),
  secretWord2: requiredEnv("FREEKASSA_SECRET_WORD_2"),
  paymentSystemId: Number(process.env.FREEKASSA_PAYMENT_SYSTEM_ID ?? "1"),
} as const;

if (!Number.isSafeInteger(freeKassaConfig.shopId) || freeKassaConfig.shopId <= 0) {
  throw new Error("FREEKASSA_SHOP_ID must be a positive integer");
}

export type PlanCode = "STARTER" | "PRO" | "BUSINESS";

export const PLANS: Record<PlanCode, { title: string; amountKopeks: number; periodDays: number }> = {
  STARTER: { title: "Portfolio Pro Starter", amountKopeks: Number(requiredEnv("FREEKASSA_STARTER_AMOUNT_KOPEKS")), periodDays: 30 },
  PRO: { title: "Portfolio Pro Pro", amountKopeks: Number(requiredEnv("FREEKASSA_PRO_AMOUNT_KOPEKS")), periodDays: 30 },
  BUSINESS: { title: "Portfolio Pro Business", amountKopeks: Number(requiredEnv("FREEKASSA_BUSINESS_AMOUNT_KOPEKS")), periodDays: 30 },
};

for (const [plan, value] of Object.entries(PLANS)) {
  if (!Number.isSafeInteger(value.amountKopeks) || value.amountKopeks < 100) {
    throw new Error(`${plan} price must be an integer of at least 100 kopeks`);
  }
}

export const checkoutRequestSchema = z.object({
  plan: z.enum(["STARTER", "PRO", "BUSINESS"]),
});

export type FreeKassaCreateOrderInput = {
  merchantOrderId: string;
  amountKopeks: number;
  email: string;
  clientIp: string;
  description: string;
  recurrent?: boolean;
  recurrentOrderId?: number;
};

export type FreeKassaCreateOrderResponse = {
  type: "success" | "error";
  orderId?: number;
  orderHash?: string;
  location?: string;
  recurrent_order?: { id: number; pay_date_at: string };
  message?: string;
};

/** Форматируем только из integer kopeks, чтобы не получить floating-point ошибку суммы. */
export function kopeksToRub(amountKopeks: number): string {
  if (!Number.isSafeInteger(amountKopeks) || amountKopeks < 0) throw new Error("Invalid kopeks amount");
  return `${Math.floor(amountKopeks / 100)}.${String(amountKopeks % 100).padStart(2, "0")}`;
}

/** Парсим callback amount точно до копеек. */
export function rubToKopeks(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [rub, fraction = ""] = value.split(".");
  const kopeks = `${fraction}00`.slice(0, 2);
  const result = Number(rub) * 100 + Number(kopeks);
  return Number.isSafeInteger(result) ? result : null;
}

/** FreeKassa API signing: sorted values joined by |, then HMAC-SHA256 with API key. */
export function createApiSignature(payload: Record<string, string | number | boolean>): string {
  const data = Object.entries(payload)
    .filter(([key]) => key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => String(value))
    .join("|");
  return createHmac("sha256", freeKassaConfig.apiKey).update(data, "utf8").digest("hex");
}

/** Signature for hosted SCI payment page (secret word 1). */
export function createCheckoutSignature(merchantOrderId: string, amountKopeks: number): string {
  const amount = kopeksToRub(amountKopeks);
  return createHash("md5")
    .update(`${freeKassaConfig.shopId}:${amount}:${freeKassaConfig.secretWord1}:RUB:${merchantOrderId}`, "utf8")
    .digest("hex");
}

/** Signature for Result URL callback (secret word 2). */
export function createCallbackSignature(merchantId: string, amount: string, merchantOrderId: string): string {
  return createHash("md5")
    .update(`${merchantId}:${amount}:${freeKassaConfig.secretWord2}:${merchantOrderId}`, "utf8")
    .digest("hex");
}

/** Constant-time hex comparison protects callback signature checks from trivial timing leakage. */
export function safeSignatureEquals(left: string, right: string): boolean {
  const a = Buffer.from(left.toLowerCase(), "hex");
  const b = Buffer.from(right.toLowerCase(), "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function createMerchantOrderId(userId: string): string {
  // Не включайте email или иные персональные данные в order ID, который увидит платёжный провайдер.
  return `pp_${userId.slice(0, 12)}_${randomUUID().replaceAll("-", "")}`.slice(0, 64);
}

export async function createFreeKassaOrder(input: FreeKassaCreateOrderInput): Promise<FreeKassaCreateOrderResponse> {
  const payload: Record<string, string | number | boolean> = {
    shopId: freeKassaConfig.shopId,
    nonce: Date.now(),
    paymentId: input.merchantOrderId,
    i: freeKassaConfig.paymentSystemId,
    email: input.email,
    ip: input.clientIp,
    amount: kopeksToRub(input.amountKopeks),
    currency: "RUB",
  };

  if (input.recurrentOrderId) {
    payload.recurrent_order_id = input.recurrentOrderId;
  } else if (input.recurrent) {
    payload.recurrent = "Y";
    payload.recurrent_period = "month";
    payload.recurrent_description = input.description.slice(0, 200);
  }

  payload.signature = createApiSignature(payload);

  const response = await fetch(`${FREEKASSA_API_BASE}/orders/create`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object") {
    throw new Error(`FreeKassa create order failed with HTTP ${response.status}`);
  }

  const parsed = body as FreeKassaCreateOrderResponse;
  if (parsed.type !== "success" || !parsed.orderId || !parsed.location) {
    throw new Error(parsed.message || "FreeKassa did not return a payment location");
  }
  return parsed;
}

export const freeKassaCallbackSchema = z.object({
  MERCHANT_ID: z.string().regex(/^\d+$/),
  AMOUNT: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  MERCHANT_ORDER_ID: z.string().min(1).max(128),
  intid: z.string().regex(/^\d+$/),
  SIGN: z.string().regex(/^[a-fA-F0-9]{32}$/),
  P_EMAIL: z.string().email().optional(),
  CUR_ID: z.string().optional(),
});

const freeKassaIps = new Set(["168.119.157.136", "168.119.60.227", "178.154.197.79", "51.250.54.238"]);

export function assertAllowedCallbackIp(request: Request): void {
  if (process.env.FREEKASSA_ENFORCE_IP_ALLOWLIST !== "true") return;
  // Включайте только если platform гарантированно переписывает заголовок trusted proxy.
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip || !freeKassaIps.has(ip)) throw new Error("FreeKassa callback IP is not allowed");
}
```

---

## 4. `lib/auth.ts`

Если проект использует Auth.js v5, добавьте небольшой server-only adapter. Он не принимает user ID из request body и требует, чтобы Auth.js session уже была проверена на сервере.

```ts
// lib/auth.ts
import "server-only";

import { auth } from "@/auth";

export type AuthenticatedUser = {
  id: string;
  email: string;
};

export async function requireUser(): Promise<AuthenticatedUser> {
  const session = await auth();
  const id = session?.user?.id;
  const email = session?.user?.email;

  if (!id || !email) {
    throw new Error("UNAUTHORIZED");
  }

  return { id, email };
}
```

В `auth.ts` дополните тип `Session.user` полем `id` через module augmentation и заполняйте его в JWT/session callbacks. Если вместо Auth.js используется Supabase Auth, замените реализацию `requireUser()` на `supabase.auth.getUser()` server-side; контракт функции оставьте прежним.

---

## 5. `prisma/schema.prisma` updates

Добавьте эти enum/models и связи в существующую Prisma schema. Предполагается, что `User.id` — строковый unique identifier. Если у вас numeric ID, замените `String` на `Int` согласованно во всех моделях.

```prisma
enum SubscriptionPlan {
  STARTER
  PRO
  BUSINESS
}

enum SubscriptionStatus {
  PENDING
  ACTIVE
  PAST_DUE
  CANCELED
  EXPIRED
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
  CANCELED
}

enum PaymentKind {
  INITIAL
  RENEWAL
}

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  // ...существующие поля...
  subscriptions Subscription[]
  payments      Payment[]
}

model Subscription {
  id                    String             @id @default(cuid())
  userId                String             @unique
  user                  User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan                  SubscriptionPlan
  status                SubscriptionStatus @default(PENDING)
  freeKassaRecurringId  Int?               @unique
  // API FreeKassa требует IP плательщика при создании order. Храните только при
  // наличии законного основания и удаляйте по политике retention/privacy.
  payerIp               String?
  nextPaymentAt         DateTime?
  currentPeriodStart    DateTime?
  currentPeriodEnd      DateTime?
  cancelAtPeriodEnd     Boolean            @default(false)
  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt
  payments              Payment[]

  @@index([status, nextPaymentAt])
}

model Payment {
  id                    String        @id @default(cuid())
  userId                String
  user                  User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  subscriptionId        String?
  subscription          Subscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)
  merchantOrderId       String        @unique
  freeKassaOrderId      Int?          @unique
  freeKassaTransactionId String?      @unique
  amountKopeks          Int
  currency              String        @default("RUB")
  plan                  SubscriptionPlan
  kind                  PaymentKind
  status                PaymentStatus @default(PENDING)
  paidAt                DateTime?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  @@index([userId, createdAt])
  @@index([status, createdAt])
}
```

После миграции:

```bash
pnpm prisma migrate dev --name replace_stripe_with_freekassa
pnpm prisma generate
```

> **Не удаляйте Stripe исторические записи до reconciliation.** Сначала отключите Stripe webhook, завершите тестовый FreeKassa checkout, затем отдельно подготовьте migration для legacy Stripe columns/tables.

---

## 6. `app/api/checkout/route.ts`

Этот handler не принимает цену, сумму или user ID от browser. Он получает только plan code, получает текущего пользователя из серверной auth abstraction и создаёт hosted payment ссылку на FreeKassa.

```ts
// app/api/checkout/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PLANS, checkoutRequestSchema, createFreeKassaOrder, createMerchantOrderId } from "@/lib/freekassa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(); // Должна бросать 401, если Supabase/Auth.js session отсутствует.
    const input = checkoutRequestSchema.parse(await request.json());
    const plan = PLANS[input.plan];
    const clientIp = getClientIp(request);

    if (!clientIp) {
      return NextResponse.json({ error: "Не удалось определить IP плательщика." }, { status: 400 });
    }

    const existing = await prisma.subscription.findUnique({ where: { userId: user.id } });
    if (existing?.status === "ACTIVE" && !existing.cancelAtPeriodEnd) {
      return NextResponse.json({ error: "У вас уже есть активная подписка. Измените план в кабинете." }, { status: 409 });
    }

    const merchantOrderId = createMerchantOrderId(user.id);
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        subscriptionId: existing?.id,
        merchantOrderId,
        amountKopeks: plan.amountKopeks,
        plan: input.plan,
        kind: "INITIAL",
        status: "PENDING",
      },
    });

    try {
      const order = await createFreeKassaOrder({
        merchantOrderId,
        amountKopeks: plan.amountKopeks,
        email: user.email,
        clientIp,
        recurrent: true,
        description: `Подписка ${plan.title}`,
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: { freeKassaOrderId: order.orderId },
      });

      // recurring_order появляется при создании initial recurring order.
      if (order.recurrent_order?.id) {
        await prisma.subscription.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            plan: input.plan,
            status: "PENDING",
            freeKassaRecurringId: order.recurrent_order.id,
            nextPaymentAt: new Date(order.recurrent_order.pay_date_at),
            payerIp: clientIp,
          },
          update: {
            plan: input.plan,
            status: "PENDING",
            freeKassaRecurringId: order.recurrent_order.id,
            nextPaymentAt: new Date(order.recurrent_order.pay_date_at),
            payerIp: clientIp,
            cancelAtPeriodEnd: false,
          },
        });
      }

      return NextResponse.json({ checkoutUrl: order.location }, { status: 201 });
    } catch (error) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Некорректный тариф." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Не удалось создать платёж.";
    console.error("[FreeKassa checkout]", { message });
    return NextResponse.json({ error: "Не удалось начать оплату. Попробуйте ещё раз." }, { status: 500 });
  }
}
```

---

## 7. `app/api/webhooks/freekassa/route.ts`

В настройках FreeKassa укажите Result/notification URL:

```text
https://your-domain.com/api/webhooks/freekassa
```

Выберите **POST** и включите ожидаемый ответ `YES`, если эта функция активирована в merchant account. Callback отправляется как `form-data`, а не JSON. [1]

```ts
// app/api/webhooks/freekassa/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  PLANS,
  assertAllowedCallbackIp,
  createCallbackSignature,
  freeKassaCallbackSchema,
  freeKassaConfig,
  rubToKopeks,
  safeSignatureEquals,
} from "@/lib/freekassa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const yes = () => new NextResponse("YES", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });

/** Локальная helper-функция исключает лишнюю production dependency. */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export async function POST(request: Request) {
  try {
    assertAllowedCallbackIp(request);

    const formData = await request.formData();
    const raw = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)]));
    const callback = freeKassaCallbackSchema.parse(raw);

    if (callback.MERCHANT_ID !== String(freeKassaConfig.shopId)) {
      return new NextResponse("Invalid merchant", { status: 400 });
    }

    const expectedSign = createCallbackSignature(callback.MERCHANT_ID, callback.AMOUNT, callback.MERCHANT_ORDER_ID);
    if (!safeSignatureEquals(expectedSign, callback.SIGN)) {
      return new NextResponse("Invalid signature", { status: 400 });
    }

    const amountKopeks = rubToKopeks(callback.AMOUNT);
    if (amountKopeks === null) return new NextResponse("Invalid amount", { status: 400 });

    const payment = await prisma.payment.findUnique({
      where: { merchantOrderId: callback.MERCHANT_ORDER_ID },
      include: { subscription: true },
    });
    if (!payment || payment.currency !== "RUB" || payment.amountKopeks !== amountKopeks) {
      return new NextResponse("Unknown order", { status: 400 });
    }

    // Успешный повторный callback должен быть acknowledged, но не должен второй раз выдавать доступ.
    if (payment.status === "SUCCEEDED") return yes();

    const duplicateProviderTransaction = await prisma.payment.findUnique({
      where: { freeKassaTransactionId: callback.intid },
      select: { id: true },
    });
    if (duplicateProviderTransaction && duplicateProviderTransaction.id !== payment.id) {
      return new NextResponse("Duplicate transaction", { status: 409 });
    }

    const plan = PLANS[payment.plan];
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // Повторная проверка в transaction защищает от параллельной доставки callback.
      const lockedPayment = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
      if (lockedPayment.status === "SUCCEEDED") return;

      const existingSubscription = await tx.subscription.findUnique({ where: { userId: payment.userId } });
      const startsAt = existingSubscription?.currentPeriodEnd && existingSubscription.currentPeriodEnd > now
        ? existingSubscription.currentPeriodEnd
        : now;
      const endsAt = addDays(startsAt, plan.periodDays);

      const subscription = await tx.subscription.upsert({
        where: { userId: payment.userId },
        create: {
          userId: payment.userId,
          plan: payment.plan,
          status: "ACTIVE",
          currentPeriodStart: startsAt,
          currentPeriodEnd: endsAt,
          nextPaymentAt: endsAt,
        },
        update: {
          plan: payment.plan,
          status: "ACTIVE",
          currentPeriodStart: startsAt,
          currentPeriodEnd: endsAt,
          nextPaymentAt: endsAt,
          cancelAtPeriodEnd: false,
        },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          subscriptionId: subscription.id,
          freeKassaTransactionId: callback.intid,
          status: "SUCCEEDED",
          paidAt: now,
        },
      });
    }, { isolationLevel: "Serializable" });

    return yes();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown callback error";
    console.error("[FreeKassa callback]", { message });
    // 5xx просит FreeKassa повторить callback вместо молчаливой потери entitlement.
    return new NextResponse("Temporary processing error", { status: 500 });
  }
}
```

---

## 8. Обязательное дополнение: `app/api/cron/freekassa-renew/route.ts`

FreeKassa сообщает дату следующего recurring charge, но application должна создать order с `recurrent_order_id` в эту дату. Этот endpoint запускается один раз в день через Vercel Cron или любой trusted scheduler.

```ts
// app/api/cron/freekassa-renew/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PLANS, createFreeKassaOrder, createMerchantOrderId } from "@/lib/freekassa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      freeKassaRecurringId: { not: null },
      nextPaymentAt: { lte: now },
    },
    include: { user: { select: { id: true, email: true } } },
    take: 100,
  });

  const results = await Promise.allSettled(dueSubscriptions.map(async (subscription) => {
    if (!subscription.payerIp) {
      // Не подставляйте фиктивный IP: это может скрыть проблему и нарушить правила провайдера.
      await prisma.subscription.update({ where: { id: subscription.id }, data: { status: "PAST_DUE" } });
      return { skippedMissingPayerIp: subscription.id };
    }
    const recentPending = await prisma.payment.findFirst({
      where: { subscriptionId: subscription.id, status: "PENDING", kind: "RENEWAL" },
      select: { id: true },
    });
    if (recentPending) return { skipped: subscription.id };

    const plan = PLANS[subscription.plan];
    const merchantOrderId = createMerchantOrderId(subscription.userId);
    const payment = await prisma.payment.create({
      data: {
        userId: subscription.userId,
        subscriptionId: subscription.id,
        merchantOrderId,
        amountKopeks: plan.amountKopeks,
        plan: subscription.plan,
        kind: "RENEWAL",
        status: "PENDING",
      },
    });

    try {
      const created = await createFreeKassaOrder({
        merchantOrderId,
        amountKopeks: plan.amountKopeks,
        email: subscription.user.email,
        clientIp: subscription.payerIp,
        recurrentOrderId: subscription.freeKassaRecurringId!,
        description: `Продление ${plan.title}`,
      });
      await prisma.payment.update({ where: { id: payment.id }, data: { freeKassaOrderId: created.orderId } });
      return { created: payment.id };
    } catch (error) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      throw error;
    }
  }));

  const failed = results.filter((item) => item.status === "rejected").length;
  return NextResponse.json({ processed: results.length, failed }, { status: failed ? 207 : 200 });
}
```

Добавьте `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/freekassa-renew", "schedule": "15 3 * * *" }]
}
```

> Для production дополнительно добавьте reconciliation job: он запрашивает FreeKassa API для `PENDING` payment старше разумного порога и переводит их в `FAILED`/`CANCELED` только после authoritative provider check. Не выдавайте доступ на success redirect: единственный источник entitlement — validated Result URL callback.

---

## 9. `app/pricing/page.tsx`

```tsx
// app/pricing/page.tsx
"use client";

import { useState } from "react";

type PlanCode = "STARTER" | "PRO" | "BUSINESS";

const plans: Array<{ code: PlanCode; title: string; price: string; description: string; highlight?: boolean }> = [
  { code: "STARTER", title: "Starter", price: "490 ₽", description: "Для первого публичного портфолио." },
  { code: "PRO", title: "Pro", price: "990 ₽", description: "Для активного независимого специалиста.", highlight: true },
  { code: "BUSINESS", title: "Business", price: "1 990 ₽", description: "Для студий и расширенной команды." },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<PlanCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan: PlanCode) {
    setLoadingPlan(plan);
    setError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ plan }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isCheckoutPayload(payload)) {
        throw new Error(isErrorPayload(payload) ? payload.error : "Не удалось создать платёж.");
      }
      window.location.assign(payload.checkoutUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось начать оплату.");
      setLoadingPlan(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold text-violet-700">Portfolio.pro</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">Выберите подходящий план</h1>
        <p className="mt-4 text-slate-600">Оплата проходит на защищённой странице FreeKassa. Доступ активируется после подтверждённого платежа.</p>
      </header>

      {error ? <p role="alert" className="mx-auto mt-6 max-w-2xl rounded-xl bg-red-50 p-4 text-center text-sm font-medium text-red-700">{error}</p> : null}

      <section className="mt-12 grid gap-6 md:grid-cols-3" aria-label="Тарифные планы">
        {plans.map((plan) => (
          <article key={plan.code} className={`rounded-2xl border p-6 ${plan.highlight ? "border-violet-500 bg-violet-50 shadow-lg" : "border-slate-200 bg-white"}`}>
            <h2 className="text-xl font-bold text-slate-950">{plan.title}</h2>
            <p className="mt-3 text-3xl font-bold text-slate-950">{plan.price}<span className="text-base font-medium text-slate-500"> / месяц</span></p>
            <p className="mt-4 min-h-12 text-sm leading-6 text-slate-600">{plan.description}</p>
            <button type="button" onClick={() => void startCheckout(plan.code)} disabled={loadingPlan !== null} className="mt-7 w-full rounded-xl bg-violet-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60">
              {loadingPlan === plan.code ? "Переход к оплате…" : `Выбрать ${plan.title}`}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}

function isCheckoutPayload(value: unknown): value is { checkoutUrl: string } {
  return typeof value === "object" && value !== null && "checkoutUrl" in value && typeof (value as { checkoutUrl?: unknown }).checkoutUrl === "string";
}

function isErrorPayload(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value && typeof (value as { error?: unknown }).error === "string";
}
```

---

## 10. Что нужно удалить из Stripe integration

| Удалить/заменить | Новая реализация |
|---|---|
| `stripe` / `@stripe/stripe-js` dependencies | `lib/freekassa.ts` на native `fetch`. |
| `STRIPE_*` secrets | `FREEKASSA_*` secrets. |
| `/api/stripe/webhook` | `/api/webhooks/freekassa`, принимающий `form-data` и отвечающий `YES`. |
| Stripe Checkout Session | FreeKassa `/orders/create` hosted URL. |
| Stripe Customer Portal | Собственная billing page: cancel-at-period-end, history и ручная смена plan согласно вашему бизнес-flow. |
| Stripe subscription events | Validated FreeKassa Result URL + daily recurring scheduler. |

## 11. Production checklist

- [ ] В merchant dashboard задан Result URL `https://<domain>/api/webhooks/freekassa`, метод **POST**, Success/Failure URLs и secret words.
- [ ] Callback обязательно проверяет `MERCHANT_ID`, constant-time `SIGN`, точную сумму в копейках и существующий pending order.
- [ ] `MERCHANT_ORDER_ID`, provider order ID и `intid` имеют unique constraints в Prisma/БД.
- [ ] Callback идемпотентно отвечает `YES` на ранее успешно обработанный `intid`.
- [ ] Browser не передаёт `amount`, `currency`, arbitrary user ID или FreeKassa secret.
- [ ] Recurring endpoint защищён `CRON_SECRET`; его нельзя вызвать из public browser.
- [ ] Сначала выполнен test-mode checkout, затем проверены callback delivery и повторный callback.
- [ ] Для перехода с Stripe сохранён reconciliation plan и legacy billing history до удаления Stripe data.

## References

[1]: https://docs.freekassa.net/ "FreeKassa API: SCI, API orders, callbacks and recurring payments"
[2]: https://docs.freekassa.net/#tag/Orders/operation/createOrder "FreeKassa: Create order API"
[3]: https://docs.freekassa.net/#tag/Recurring-payments "FreeKassa: Recurring payments"
