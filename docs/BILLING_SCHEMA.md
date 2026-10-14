# Billing schema (public.prisma): apply and migrate BEFORE the code

```prisma
// ===== BILLING ENGINE =====

enum BillingInvoiceStatus  { open paid void uncollectible }
enum BillingInvoiceReason  { upgrade renewal adjustment }
enum BillingItemKind       { plan setup_fee proration_credit discount adjustment }
enum PaymentAttemptStatus  { pending success failed abandoned }
enum PaymentAttemptMethod  { checkout saved_card manual }
enum WebhookEventStatus    { received processed ignored failed }

// One invoice per charge. Subscription state follows invoice state, never the other way round.
model SubscriptionInvoice {
  id                String               @id @default(uuid())
  number            String               @unique              // SINV-2026-000123
  idempotencyKey    String?              @unique              // renewals: renew:<subscriptionId>:<periodStart ms>
  subscriptionId    String
  schoolId          String
  planId            String
  billingCycle      BillingCycle
  reason            BillingInvoiceReason
  status            BillingInvoiceStatus @default(open)
  periodStart       DateTime             // the subscription period this invoice buys (applied when paid)
  periodEnd         DateTime
  subtotalKobo      Int
  discountKobo      Int                  @default(0)
  totalKobo         Int
  amountPaidKobo    Int                  @default(0)
  couponId          String?
  dueDate           DateTime
  issuedAt          DateTime             @default(now())
  paidAt            DateTime?
  voidedAt          DateTime?
  attemptCount      Int                  @default(0)           // automatic charge attempts made
  nextAttemptAt     DateTime?                                  // when the saved card is charged next (null = not automatic)
  lastFailureReason String?
  note              String?
  createdById       String?                                    // set for platform-made invoices
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt

  subscription Subscription            @relation(fields: [subscriptionId], references: [id])
  school       School                  @relation(fields: [schoolId], references: [id])
  plan         Plan                    @relation(fields: [planId], references: [id])
  items        SubscriptionInvoiceItem[]
  attempts     PaymentAttempt[]

  @@index([schoolId, createdAt])
  @@index([subscriptionId, status])
  @@index([status, dueDate])
  @@index([status, nextAttemptAt])
}

model SubscriptionInvoiceItem {
  id          String           @id @default(uuid())
  invoiceId   String
  kind        BillingItemKind
  description String
  amountKobo  Int                                              // negative for credits and discounts
  createdAt   DateTime         @default(now())

  invoice SubscriptionInvoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  @@index([invoiceId])
}

model PaymentAttempt {
  id             String               @id @default(uuid())
  invoiceId      String
  reference      String               @unique                 // also the provider reference: lets any retry find the same payment
  amountKobo     Int
  status         PaymentAttemptStatus @default(pending)
  method         PaymentAttemptMethod
  paymentMethodId String?
  providerStatus String?
  failureReason  String?
  createdAt      DateTime             @default(now())
  completedAt    DateTime?

  invoice SubscriptionInvoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  @@index([invoiceId])
  @@index([status, createdAt])
}

// A saved card. The authorization code is stored ENCRYPTED. checkoutEmail must be the email used when charging.
model PaymentMethod {
  id                String    @id @default(uuid())
  schoolId          String
  provider          String    @default("paystack")
  authorizationCode String                                     // encrypted
  signature         String?                                    // provider's card fingerprint: the same card is never saved twice
  brand             String?
  last4             String?
  expMonth          Int?
  expYear           Int?
  bank              String?
  checkoutEmail     String
  isDefault         Boolean   @default(true)
  createdAt         DateTime  @default(now())
  removedAt         DateTime?

  school School @relation(fields: [schoolId], references: [id])
  @@unique([schoolId, signature])
  @@index([schoolId, removedAt])
}

// Every provider event is logged once; a repeated event is recognised and ignored.
model WebhookEvent {
  id          String             @id @default(uuid())
  provider    String
  eventKey    String                                          // event type + provider transaction id
  eventType   String
  reference   String?
  status      WebhookEventStatus @default(received)
  error       String?
  receivedAt  DateTime           @default(now())
  processedAt DateTime?

  @@unique([provider, eventKey])
  @@index([status, receivedAt])
}

// "This reminder was already sent": makes reminders safe to run every hour.
model BillingNotice {
  subscriptionId String
  periodEnd      DateTime
  key            String
  sentAt         DateTime @default(now())

  @@id([subscriptionId, periodEnd, key])
}

// Gapless-enough counters for platform documents (invoice numbers)
model PlatformSequence {
  key       String
  period    String   @default("")
  nextValue Int      @default(1)
  updatedAt DateTime @updatedAt

  @@id([key, period])
}
```

## Changes to existing models
`Subscription`: add
```prisma
  paymentMethodId  String?                    // the saved card used for automatic renewal (replaces paystackAuthorizationCode)
  billingAnchorDay Int       @default(1)      // day of month a paid period renews on (Jan 31 -> Feb 28 -> Mar 31)
  lapsedPlanId     String?                    // the paid plan lost to non-payment, so "restore" can be offered
  invoices         SubscriptionInvoice[]
```
`School`: add `subscriptionInvoices SubscriptionInvoice[]` and `paymentMethods PaymentMethod[]`.
`Plan`: add `invoices SubscriptionInvoice[]`.
Left in place until the final cleanup (nothing reads or writes them any more): `Subscription.paystackAuthorizationCode`, `paystackCustomerCode`, `paystackSubscriptionCode`, `discountedPriceKobo`, `setupFeePaid`, `setupFeePaidAt`, `lastBillingAttemptAt`, `failedBillingCount` (still used), and the whole `BillingHistory` table.
Dev data: delete rows in `BillingHistory` and clear `Subscription.paystackAuthorizationCode`; they are replaced by invoices.
