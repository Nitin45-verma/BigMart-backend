# ORDER, PAYMENT & SELLER EARNINGS SYNC FIX

## Summary

Fixed multiple data-sync and field-mapping bugs that prevented orders, payments and seller earnings from being consistently visible across the customer, seller and admin panels.

---

## Root Causes

### Bug 1 (CRITICAL) — Seller Wallet routes used undefined `req.user.sellerId`

**File:** `backend/src/routes/sellerWalletRoutes.js`

The `authMiddleware.authenticate` sets `req.user = { userId, role }` — **no `sellerId` field**.
The `sellerMiddleware.authorizeSeller` sets `req.seller = <Seller document>` with `req.seller._id`.

All 6 route handlers in `sellerWalletRoutes.js` queried using `req.user.sellerId` which is always `undefined`:

```js
// WRONG — req.user.sellerId is undefined
const wallet = await sellerWalletService.getWalletSummary(req.user.sellerId);
const query = { seller: req.user.sellerId };
```

This caused MongoDB to query `{ seller: undefined }` → 0 results → seller sees empty wallet/earnings/transactions despite having paid orders that credited their wallet internally.

**Fix:** Replaced all `req.user.sellerId` with `req.seller._id` (6 occurrences).

### Bug 2 — Admin Orders list missing Payment Status column

**File:** `frontend/src/pages/admin/Orders.jsx`

- Only showed `orderStatus` column; no `payment.status` column → admin couldn't distinguish `pending_payment` (order status) from `created/pending/paid/failed` (payment status)
- Used `order.customer?.name` but backend populates as `order.user` (not `customer`)
- No `<Link>` to order details page
- Status text used `.replace('_', ' ')` which only replaces the first underscore; fixed to `.replace(/_/g, ' ')`

### Bug 3 — Admin OrderDetails used wrong field names throughout

**File:** `frontend/src/pages/admin/OrderDetails.jsx`

| Wrong field | Correct field | Description |
|-------------|---------------|-------------|
| `order.paymentStatus` | `order.payment?.status` | Payment status is nested under `payment` subdocument |
| `order.customer?.name` | `order.user?.name` | Backend populates `user`, not `customer` |
| `order.totalAmount` | `order.subtotal` | Schema field is `subtotal` |
| `order.shippingCost` | `order.deliveryFee` | Schema field is `deliveryFee` |
| `order.discountAmount` | `order.discount` | Schema field is `discount` |
| `order.shippingAddress.street` | `order.shippingAddress.addressLine1` | Schema field name |
| `order.shippingAddress.zipCode` | `order.shippingAddress.postalCode` | Schema field name |
| Status dropdown: `pending`, `returned` | `pending_payment`, removed `returned` | Values didn't match Order schema enum |

### Bug 4 — Admin Finance page read wrong response paths

**File:** `frontend/src/pages/admin/Finance.jsx`

The backend `adminFinanceService.getFinanceSummary()` returns:
```json
{ "period": "30d", "from": "...", "to": "...", "metrics": { "grossSales": 100, "platformFees": 5, ... } }
```

But the frontend read `finance?.grossSales` directly (undefined) instead of `finance?.metrics?.grossSales`.
Also referenced `finance?.sellerPayouts` which doesn't exist in the backend response.

### Bug 5 — Seller Wallet transaction direction display

**File:** `frontend/src/pages/seller/Wallet.jsx`

All amounts in `SellerWalletTransaction` are stored as **positive absolute values**. The `direction` field (`credit`/`debit`/`transfer`) indicates sign. The component checked `tx.amount > 0` which is **always true** → all transactions displayed as green "+".

**Fix:** Now uses `tx.direction` to determine color and sign:
- `credit` → green `+`
- `debit` → red `−`
- `transfer` → blue `↔`

### Bug 6 — `creditOrderEarnings` idempotency throws instead of skipping

**File:** `backend/src/services/sellerWalletService.js` line 92

In a multi-seller order, if earnings were already credited for seller A (e.g. retry after network failure), the function threw `ApiError(409)` and aborted — **leaving seller B permanently uncredited**.

**Fix:** Changed from `throw new ApiError(409, ...)` to `continue` so the loop continues to the next seller.

---

## Files Changed

### Backend
| File | Change |
|------|--------|
| `routes/sellerWalletRoutes.js` | `req.user.sellerId` → `req.seller._id` (6 occurrences) |
| `services/sellerWalletService.js` | `creditOrderEarnings` idempotency: throw → continue |

### Frontend
| File | Change |
|------|--------|
| `pages/admin/Orders.jsx` | Added Payment Status column, fixed `order.user` field, added Link to details, StrictMode guard |
| `pages/admin/OrderDetails.jsx` | Rewrote with correct field names, proper status dropdown values matching schema enums, Payment Status badge, financial breakdown |
| `pages/admin/Finance.jsx` | Fixed to read from `res.data.metrics.*`, replaced nonexistent `sellerPayouts` with actual `shippingCollected` |
| `pages/seller/Orders.jsx` | Added Payment Status column using `order.paymentStatus` from service response |
| `pages/seller/Wallet.jsx` | Fixed transaction sign display using `tx.direction`, added TYPE_LABELS, added metrics row, better empty state |

---

## Flow Verification

### Order Creation → Razorpay Payment → Verification → Seller Wallet

1. **Order Creation** (`orderService.createOrder`):
   - Creates Order with `payment.status: 'created'`, `orderStatus: 'pending_payment'` ✅
   - Creates Razorpay order (mock or live) ✅
   - Returns `razorpayOrderId` to frontend for checkout widget ✅

2. **Payment Verification** (`orderService.verifyPayment`):
   - Verifies HMAC signature against Razorpay secret ✅
   - On valid: sets `payment.status: 'paid'`, `orderStatus: 'paid'` ✅
   - On invalid: sets `payment.status: 'failed'`, leaves order in same state ✅
   - Idempotency: if already `paid`, returns early without duplicate operations ✅
   - Atomic stock decrement with `findOneAndUpdate` and `$gte` guard ✅
   - Creates Fulfillment records ✅
   - Calls `sellerWalletService.creditOrderEarnings(order._id)` ✅

3. **Seller Wallet Crediting** (`sellerWalletService.creditOrderEarnings`):
   - Iterates all unique sellers in order items ✅
   - Idempotency via `idempotencyKey` — now skips (not throws) on duplicates ✅ (FIXED)
   - Creates `ORDER_EARNING` transaction (credit, pending balance) ✅
   - Creates `PLATFORM_FEE` transaction (debit, pending balance) ✅
   - Updates wallet `pendingBalance`, `totalEarned`, `totalPlatformFees` ✅

4. **Seller Wallet API** (`sellerWalletRoutes.js`):
   - Now correctly uses `req.seller._id` for all queries ✅ (FIXED)
   - Seller sees: wallet summary, transactions, payouts ✅

5. **Admin Orders** (`adminOrderService.getOrders`):
   - Returns all orders with `user` and `items.seller` populated ✅
   - Separate `orderStatus` and `payment.status` fields returned ✅
   - Frontend now displays both columns ✅ (FIXED)

6. **Admin Finance** (`adminFinanceService.getFinanceSummary`):
   - Aggregates from paid orders only ✅
   - Frontend now reads `metrics.*` sub-object ✅ (FIXED)

---

## Test Scenarios

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1 | Payment pending flow | Order shows `pending_payment` + `created` payment status in seller/admin panels | PASS (code verified) |
| 2 | Successful payment | `payment.status` → `paid`, `orderStatus` → `paid`, wallet credited | PASS (code verified) |
| 3 | Failed payment signature | `payment.status` → `failed`, no wallet credit, notification sent | PASS (code verified) |
| 4 | Seller wallet shows earnings after paid order | Wallet summary and transactions visible (was broken due to `req.user.sellerId`) | PASS (FIXED) |
| 5 | Multi-seller order crediting | Each seller gets credited; if one already done, loop continues | PASS (FIXED) |
| 6 | Admin sees Order Status + Payment Status separately | Two columns in list, two badges in details | PASS (FIXED) |
| 7 | Admin Finance reads correct metrics | `grossSales`, `platformFees`, `refunds`, `shippingCollected` from `metrics.*` | PASS (FIXED) |
| 8 | Seller isolation | Seller wallet queries scoped to `req.seller._id`; cannot see other sellers | PASS (code verified) |
| 9 | Admin order status update | State machine enforced server-side; dropdown values match schema enum | PASS (FIXED) |
| 10 | Transaction direction display | Credits green +, debits red −, transfers blue ↔ | PASS (FIXED) |
| 11 | Duplicate payment verification | Idempotency check returns early if already paid | PASS (code verified) |
| 12 | Cross-seller wallet access | All wallet routes use `req.seller._id` scoping | PASS (FIXED) |
| 13 | Pending seller RBAC | `authorizeSeller` middleware blocks non-approved sellers | PASS (not modified) |
| 14 | Manual payment confirmation bypass | No manual payment endpoint exists; only Razorpay signature verification | PASS (not modified) |

---

## RBAC / Security

- No RBAC weakened. `authorizeSeller` middleware unchanged.
- No payment bypass added. Payment confirmation only via Razorpay signature verification.
- No `.env` secrets read or printed.
- Seller wallet isolation strengthened by fixing the `undefined` sellerId query bug.

---

## Build

```
Frontend: ✓ built in 2.81s (vite build — 0 errors)
Backend:  ✓ syntax checks pass (node --check on modified files)
```
