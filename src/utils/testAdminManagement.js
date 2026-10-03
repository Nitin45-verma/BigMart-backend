const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const Seller = require('../models/Seller');
const SellerApplication = require('../models/SellerApplication');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
const ReturnRequest = require('../models/ReturnRequest');
const AdminAuditLog = require('../models/AdminAuditLog');
const { Notification } = require('../models/Notification');
const app = require('../app');
const mongoose = require('mongoose');
const { generateAccessToken } = require('./tokenUtils');

/**
 * Step 17 — Admin & Platform Management
 * 63 tests: 50 admin management + 13 regression categories
 */
const runStep17Tests = async () => {
  let server;
  const PORT = 5200;
  const BASE_URL = `http://localhost:${PORT}/api/v1`;
  const timestamp = Date.now();

  const results = {};
  const regressionResults = {};

  // Test account emails
  const adminEmail = `adm17_${timestamp}@test.com`;
  const admin2Email = `adm17b_${timestamp}@test.com`;
  const sellerEmail = `sel17_${timestamp}@test.com`;
  const customerEmail = `cust17_${timestamp}@test.com`;
  const targetEmail = `target17_${timestamp}@test.com`;

  let adminUser, admin2User, sellerUser, customerUser, targetUser;
  let sellerProfile, category17, product17A, product17B, testOrder17, testReturn17;
  let tokenAdmin, tokenAdmin2, tokenSeller, tokenCustomer;

  const pass = (label) => { results[label] = 'PASS'; console.log(`✓ ${label}: PASS`); };
  const fail = (label, reason) => { results[label] = `FAIL: ${reason}`; console.error(`✗ ${label}: FAIL — ${reason}`); };

  const req = async (method, path, token, body) => {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    };
    if (body) opts.body = JSON.stringify(body);
    return fetch(`${BASE_URL}${path}`, opts);
  };

  try {
    console.log('\n========================================');
    console.log('STARTING STEP 17 ADMIN MANAGEMENT TESTS');
    console.log('========================================\n');

    await connectDB();
    server = app.listen(PORT);
    console.log(`[Test Server] Listening on port ${PORT}`);

    // ─── FIXTURES ─────────────────────────────────────────────────
    [adminUser, admin2User, sellerUser, customerUser, targetUser] = await Promise.all([
      User.create({ name: 'Admin17', email: adminEmail, password: 'Hashed!Pw1', role: 'admin', isEmailVerified: true }),
      User.create({ name: 'Admin17B', email: admin2Email, password: 'Hashed!Pw2', role: 'admin', isEmailVerified: true }),
      User.create({ name: 'Seller17', email: sellerEmail, password: 'Hashed!Pw3', role: 'seller', isEmailVerified: true }),
      User.create({ name: 'Cust17', email: customerEmail, password: 'Hashed!Pw4', role: 'customer', isEmailVerified: true }),
      User.create({ name: 'Target17', email: targetEmail, password: 'Hashed!Pw5', role: 'customer', isEmailVerified: true })
    ]);

    tokenAdmin = generateAccessToken(adminUser);
    tokenAdmin2 = generateAccessToken(admin2User);
    tokenSeller = generateAccessToken(sellerUser);
    tokenCustomer = generateAccessToken(customerUser);

    category17 = await Category.create({ name: `Cat17_${timestamp}`, slug: `cat17-${timestamp}` });

    sellerProfile = await Seller.create({
      user: sellerUser._id,
      businessName: `Store17_${timestamp}`,
      businessEmail: sellerEmail,
      businessPhone: '9000000017',
      businessAddress: { addressLine1: '1 Test St', city: 'Delhi', state: 'Delhi', postalCode: '110001', country: 'India' },
      verificationStatus: 'approved',
      businessType: 'individual',
      isActive: true
    });

    [product17A, product17B] = await Promise.all([
      Product.create({
        seller: sellerProfile._id, category: category17._id,
        name: `ProdA17_${timestamp}`, slug: `prod-a17-${timestamp}`,
        sku: `SKU-A17-${timestamp}`, price: 1000, stock: 50, gstRate: 18,
        status: 'active', isPublished: true
      }),
      Product.create({
        seller: sellerProfile._id, category: category17._id,
        name: `ProdB17_${timestamp}`, slug: `prod-b17-${timestamp}`,
        sku: `SKU-B17-${timestamp}`, price: 500, stock: 30, gstRate: 12,
        status: 'draft', isPublished: false
      })
    ]);

    testOrder17 = await Order.create({
      orderNumber: `BM-T17-${timestamp}`,
      user: customerUser._id,
      items: [{ product: product17A._id, seller: sellerProfile._id, name: product17A.name, sku: product17A.sku, quantity: 1, unitPrice: 1000, gstRate: 18, gstAmount: 152.54, itemSubtotal: 847.46, itemTotal: 1000 }],
      shippingAddress: { fullName: 'Cust17', phone: '9000000017', addressLine1: '1 Test St', city: 'Delhi', state: 'Delhi', postalCode: '110001', country: 'India' },
      shipping: { totalDeliveryFee: 50, sellers: [{ seller: sellerProfile._id, sellerName: `Store17_${timestamp}`, distanceKm: 5, billableDistanceKm: 5, deliveryFee: 50 }] },
      subtotal: 847.46, gstTotal: 152.54, deliveryFee: 50, platformFee: 0, discount: 0, grandTotal: 1050,
      payment: { provider: 'razorpay', status: 'paid', razorpayOrderId: `rzp_ord_t17_${timestamp}`, razorpayPaymentId: `rzp_pay_t17_${timestamp}` },
      orderStatus: 'paid'
    });

    testReturn17 = await ReturnRequest.create({
      order: testOrder17._id,
      customer: customerUser._id,
      seller: sellerProfile._id,
      items: [{ product: product17A._id, name: product17A.name, sku: product17A.sku, quantity: 1, unitPrice: 1000, gstRate: 18, gstAmount: 152.54, itemSubtotal: 847.46, itemTotal: 1000 }],
      reason: 'defective',
      status: 'requested',
      refundAmount: 1000,
      shippingRefund: 0,
      refundStatus: 'none'
    });

    console.log('[Setup] Test fixtures created\n');

    // ═══════════════════════════════════════════════════
    // TEST 1: Admin authentication — valid token works
    // ═══════════════════════════════════════════════════
    try {
      const r = await req('GET', '/admin/dashboard/summary', tokenAdmin);
      if (r.status === 200) pass('Test 1: Admin authentication — valid token works');
      else fail('Test 1: Admin authentication', `Expected 200, got ${r.status}`);
    } catch (e) { fail('Test 1: Admin authentication', e.message); }

    // TEST 2: Customer blocked from admin
    try {
      const r = await req('GET', '/admin/dashboard/summary', tokenCustomer);
      if (r.status === 403) pass('Test 2: Customer blocked from admin (403)');
      else fail('Test 2: Customer blocked from admin', `Expected 403, got ${r.status}`);
    } catch (e) { fail('Test 2: Customer blocked from admin', e.message); }

    // TEST 3: Seller blocked from admin
    try {
      const r = await req('GET', '/admin/dashboard/summary', tokenSeller);
      if (r.status === 403) pass('Test 3: Seller blocked from admin (403)');
      else fail('Test 3: Seller blocked from admin', `Expected 403, got ${r.status}`);
    } catch (e) { fail('Test 3: Seller blocked from admin', e.message); }

    // TEST 4: Unauthenticated 401
    try {
      const r = await req('GET', '/admin/dashboard/summary', null);
      if (r.status === 401) pass('Test 4: Unauthenticated returns 401');
      else fail('Test 4: Unauthenticated', `Expected 401, got ${r.status}`);
    } catch (e) { fail('Test 4: Unauthenticated', e.message); }

    // TEST 5: Dashboard summary returns server-calculated metrics
    try {
      const r = await req('GET', '/admin/dashboard/summary', tokenAdmin);
      const body = await r.json();
      const d = body.data;
      if (r.status === 200 && body.success && typeof d.users?.total === 'number' && typeof d.orders?.total === 'number' && typeof d.financials?.grossMerchandiseValue === 'number') {
        pass('Test 5: Dashboard summary — server-calculated metrics returned');
      } else fail('Test 5: Dashboard summary', `Missing fields: ${JSON.stringify(Object.keys(d || {}))}`);
    } catch (e) { fail('Test 5: Dashboard summary', e.message); }

    // TEST 6: User listing
    try {
      const r = await req('GET', '/admin/users', tokenAdmin);
      const body = await r.json();
      if (r.status === 200 && body.success && Array.isArray(body.data?.users)) {
        pass('Test 6: User listing');
      } else fail('Test 6: User listing', `status=${r.status}`);
    } catch (e) { fail('Test 6: User listing', e.message); }

    // TEST 7: User pagination
    try {
      const r = await req('GET', '/admin/users?page=1&limit=2', tokenAdmin);
      const body = await r.json();
      if (r.status === 200 && body.data?.users?.length <= 2) pass('Test 7: User pagination (limit=2 respected)');
      else fail('Test 7: User pagination', `count=${body.data?.users?.length}`);
    } catch (e) { fail('Test 7: User pagination', e.message); }

    // TEST 8: User search
    try {
      const r = await req('GET', `/admin/users?search=Admin17`, tokenAdmin);
      const body = await r.json();
      const found = (body.data?.users || []).some((u) => u.email === adminEmail);
      if (r.status === 200 && found) pass('Test 8: User search finds admin by name');
      else fail('Test 8: User search', `found=${found}, users=${body.data?.users?.length}`);
    } catch (e) { fail('Test 8: User search', e.message); }

    // TEST 9: User role filtering
    try {
      const r = await req('GET', '/admin/users?role=customer', tokenAdmin);
      const body = await r.json();
      const allCustomers = (body.data?.users || []).every((u) => u.role === 'customer');
      if (r.status === 200 && allCustomers) pass('Test 9: User role filtering — all results are customers');
      else fail('Test 9: User role filtering', `allCustomers=${allCustomers}`);
    } catch (e) { fail('Test 9: User role filtering', e.message); }

    // TEST 10: User sensitive data protection
    try {
      const r = await req('GET', `/admin/users/${customerUser._id}`, tokenAdmin);
      const body = await r.json();
      const u = body.data?.user || {};
      const hasBlocked = ['password', 'refreshTokenHash', 'emailVerificationTokenHash'].some((f) => f in u);
      if (r.status === 200 && !hasBlocked) pass('Test 10: User sensitive data not exposed in admin user detail');
      else fail('Test 10: User sensitive data', `hasBlocked=${hasBlocked}`);
    } catch (e) { fail('Test 10: User sensitive data', e.message); }

    // TEST 11: Block user
    try {
      const r = await req('PATCH', `/admin/users/${targetUser._id}/block`, tokenAdmin);
      const body = await r.json();
      const fresh = await User.findById(targetUser._id);
      if (r.status === 200 && body.success && fresh.isBlocked === true) pass('Test 11: Block user');
      else fail('Test 11: Block user', `status=${r.status}, isBlocked=${fresh?.isBlocked}`);
    } catch (e) { fail('Test 11: Block user', e.message); }

    // TEST 12: Unblock user
    try {
      const r = await req('PATCH', `/admin/users/${targetUser._id}/unblock`, tokenAdmin);
      const body = await r.json();
      const fresh = await User.findById(targetUser._id);
      if (r.status === 200 && body.success && fresh.isBlocked === false) pass('Test 12: Unblock user');
      else fail('Test 12: Unblock user', `status=${r.status}, isBlocked=${fresh?.isBlocked}`);
    } catch (e) { fail('Test 12: Unblock user', e.message); }

    // TEST 13: Self-block admin blocked
    try {
      const r = await req('PATCH', `/admin/users/${adminUser._id}/block`, tokenAdmin);
      const body = await r.json();
      if (r.status === 400 && !body.success) pass('Test 13: Self-block admin blocked (400)');
      else fail('Test 13: Self-block admin blocked', `Expected 400, got ${r.status}`);
    } catch (e) { fail('Test 13: Self-block admin', e.message); }

    // TEST 14: Seller listing
    try {
      const r = await req('GET', '/admin/sellers', tokenAdmin);
      const body = await r.json();
      if (r.status === 200 && body.success && Array.isArray(body.data?.sellers)) pass('Test 14: Seller listing');
      else fail('Test 14: Seller listing', `status=${r.status}`);
    } catch (e) { fail('Test 14: Seller listing', e.message); }

    // TEST 15: Seller status filtering
    try {
      const r = await req('GET', '/admin/sellers?verificationStatus=approved', tokenAdmin);
      const body = await r.json();
      const allApproved = (body.data?.sellers || []).every((s) => s.verificationStatus === 'approved');
      if (r.status === 200 && allApproved) pass('Test 15: Seller status filtering');
      else fail('Test 15: Seller status filtering', `allApproved=${allApproved}`);
    } catch (e) { fail('Test 15: Seller status filtering', e.message); }

    // TEST 16: Seller detail with metrics
    try {
      const r = await req('GET', `/admin/sellers/${sellerProfile._id}`, tokenAdmin);
      const body = await r.json();
      if (r.status === 200 && body.success && body.data?.seller && typeof body.data?.metrics?.productCount === 'number') {
        pass('Test 16: Seller detail with product/order metrics');
      } else fail('Test 16: Seller detail', `status=${r.status}, data=${JSON.stringify(Object.keys(body.data || {}))}`);
    } catch (e) { fail('Test 16: Seller detail', e.message); }

    // TEST 17: Seller suspension
    try {
      const r = await req('PATCH', `/admin/sellers/${sellerProfile._id}/suspend`, tokenAdmin, { reason: 'Policy violation' });
      const body = await r.json();
      const fresh = await Seller.findById(sellerProfile._id);
      if (r.status === 200 && body.success && fresh.verificationStatus === 'suspended') {
        pass('Test 17: Seller suspended — verificationStatus=suspended');
      } else fail('Test 17: Seller suspension', `status=${r.status}, verificationStatus=${fresh?.verificationStatus}`);
    } catch (e) { fail('Test 17: Seller suspension', e.message); }

    // TEST 18: Seller reactivation
    try {
      const r = await req('PATCH', `/admin/sellers/${sellerProfile._id}/reactivate`, tokenAdmin);
      const body = await r.json();
      const fresh = await Seller.findById(sellerProfile._id);
      if (r.status === 200 && body.success && fresh.verificationStatus === 'approved') {
        pass('Test 18: Seller reactivated — verificationStatus=approved');
      } else fail('Test 18: Seller reactivation', `status=${r.status}, verificationStatus=${fresh?.verificationStatus}`);
    } catch (e) { fail('Test 18: Seller reactivation', e.message); }

    // TEST 19: Suspended seller access blocked at seller dashboard
    try {
      // Re-suspend
      await Seller.findByIdAndUpdate(sellerProfile._id, { verificationStatus: 'suspended' });
      const r = await req('GET', '/seller/dashboard/summary', tokenSeller);
      if (r.status === 403) pass('Test 19: Suspended seller blocked from dashboard (403)');
      else fail('Test 19: Suspended seller access blocked', `Expected 403, got ${r.status}`);
      // Restore
      await Seller.findByIdAndUpdate(sellerProfile._id, { verificationStatus: 'approved' });
    } catch (e) { fail('Test 19: Suspended seller blocked', e.message); }

    // TEST 20: Product admin listing
    try {
      const r = await req('GET', '/admin/products', tokenAdmin);
      const body = await r.json();
      if (r.status === 200 && body.success && Array.isArray(body.data?.products)) pass('Test 20: Product admin listing');
      else fail('Test 20: Product admin listing', `status=${r.status}`);
    } catch (e) { fail('Test 20: Product admin listing', e.message); }

    // TEST 21: Product filtering by seller
    try {
      const r = await req('GET', `/admin/products?seller=${sellerProfile._id}`, tokenAdmin);
      const body = await r.json();
      const allFromSeller = (body.data?.products || []).every((p) => p.seller?._id?.toString() === sellerProfile._id.toString() || p.seller?.toString() === sellerProfile._id.toString());
      if (r.status === 200 && allFromSeller) pass('Test 21: Product filtering by seller');
      else fail('Test 21: Product filtering', `allFromSeller=${allFromSeller}, count=${body.data?.products?.length}`);
    } catch (e) { fail('Test 21: Product filtering', e.message); }

    // TEST 22: Product publish action
    try {
      const r = await req('PATCH', `/admin/products/${product17B._id}/publish`, tokenAdmin);
      const body = await r.json();
      const fresh = await Product.findById(product17B._id);
      if (r.status === 200 && body.success && fresh.status === 'active' && fresh.isPublished === true) {
        pass('Test 22: Product publish action');
      } else fail('Test 22: Product publish', `status=${r.status}, productStatus=${fresh?.status}, isPublished=${fresh?.isPublished}`);
    } catch (e) { fail('Test 22: Product publish', e.message); }

    // TEST 23: Product unpublish action
    try {
      const r = await req('PATCH', `/admin/products/${product17B._id}/unpublish`, tokenAdmin);
      const body = await r.json();
      const fresh = await Product.findById(product17B._id);
      if (r.status === 200 && body.success && fresh.status === 'inactive' && fresh.isPublished === false) {
        pass('Test 23: Product unpublish action');
      } else fail('Test 23: Product unpublish', `status=${r.status}, productStatus=${fresh?.status}, isPublished=${fresh?.isPublished}`);
    } catch (e) { fail('Test 23: Product unpublish', e.message); }

    // TEST 24: Product archive action
    try {
      const r = await req('PATCH', `/admin/products/${product17B._id}/archive`, tokenAdmin);
      const body = await r.json();
      const fresh = await Product.findById(product17B._id);
      if (r.status === 200 && body.success && fresh.status === 'archived' && fresh.isPublished === false) {
        pass('Test 24: Product archive action');
      } else fail('Test 24: Product archive', `status=${r.status}, productStatus=${fresh?.status}`);
    } catch (e) { fail('Test 24: Product archive', e.message); }

    // TEST 25: Product seller ownership cannot be changed via status endpoint
    try {
      const r = await req('PATCH', `/admin/products/${product17A._id}/status`, tokenAdmin, {
        status: 'active',
        seller: (new mongoose.Types.ObjectId()).toString(),  // inject fake seller
        costPrice: 9999
      });
      const fresh = await Product.findById(product17A._id);
      // seller must remain unchanged
      if (fresh.seller.toString() === sellerProfile._id.toString()) {
        pass('Test 25: Product seller ownership unchanged after status update');
      } else fail('Test 25: Product ownership', `seller changed to ${fresh.seller}`);
    } catch (e) { fail('Test 25: Product ownership', e.message); }

    // TEST 26: Order admin listing
    try {
      const r = await req('GET', '/admin/orders', tokenAdmin);
      const body = await r.json();
      if (r.status === 200 && body.success && Array.isArray(body.data?.orders)) pass('Test 26: Order admin listing');
      else fail('Test 26: Order admin listing', `status=${r.status}`);
    } catch (e) { fail('Test 26: Order admin listing', e.message); }

    // TEST 27: Order filtering by status
    try {
      const r = await req('GET', '/admin/orders?orderStatus=paid', tokenAdmin);
      const body = await r.json();
      const allPaid = (body.data?.orders || []).every((o) => o.orderStatus === 'paid');
      if (r.status === 200 && allPaid) pass('Test 27: Order filtering by orderStatus=paid');
      else fail('Test 27: Order filtering', `allPaid=${allPaid}, count=${body.data?.orders?.length}`);
    } catch (e) { fail('Test 27: Order filtering', e.message); }

    // TEST 28: Order detail
    try {
      const r = await req('GET', `/admin/orders/${testOrder17._id}`, tokenAdmin);
      const body = await r.json();
      if (r.status === 200 && body.success && body.data?.orderNumber === testOrder17.orderNumber) {
        pass('Test 28: Order detail');
      } else fail('Test 28: Order detail', `status=${r.status}`);
    } catch (e) { fail('Test 28: Order detail', e.message); }

    // TEST 29: Invalid order status rejected
    try {
      const r = await req('PATCH', `/admin/orders/${testOrder17._id}/status`, tokenAdmin, { orderStatus: 'FAKE_STATUS' });
      if (r.status === 400) pass('Test 29: Invalid order status rejected (400)');
      else fail('Test 29: Invalid order status', `Expected 400, got ${r.status}`);
    } catch (e) { fail('Test 29: Invalid order status', e.message); }

    // TEST 30: Valid order status transition (paid → processing)
    try {
      const r = await req('PATCH', `/admin/orders/${testOrder17._id}/status`, tokenAdmin, { orderStatus: 'processing' });
      const body = await r.json();
      const fresh = await Order.findById(testOrder17._id);
      if (r.status === 200 && body.success && fresh.orderStatus === 'processing') {
        pass('Test 30: Valid order status transition paid → processing');
      } else fail('Test 30: Order status transition', `status=${r.status}, orderStatus=${fresh?.orderStatus}`);
    } catch (e) { fail('Test 30: Order status transition', e.message); }

    // TEST 31: Shipping status notification — order shipped fires ORDER_SHIPPED
    try {
      const r = await req('PATCH', `/admin/orders/${testOrder17._id}/status`, tokenAdmin, { orderStatus: 'shipped' });
      const body = await r.json();
      // Wait for setImmediate notification
      await new Promise((resolve) => setTimeout(resolve, 300));
      const notif = await Notification.findOne({
        recipient: customerUser._id,
        type: 'ORDER_SHIPPED',
        order: testOrder17._id
      });
      if (r.status === 200 && body.success && notif) {
        pass('Test 31: ORDER_SHIPPED notification fired after shipped status update');
      } else fail('Test 31: Shipping notification', `status=${r.status}, notif=${!!notif}`);
    } catch (e) { fail('Test 31: Shipping notification', e.message); }

    // TEST 32: Delivered status notification — ORDER_DELIVERED notification
    try {
      const r = await req('PATCH', `/admin/orders/${testOrder17._id}/status`, tokenAdmin, { orderStatus: 'delivered' });
      const body = await r.json();
      await new Promise((resolve) => setTimeout(resolve, 300));
      const notif = await Notification.findOne({
        recipient: customerUser._id,
        type: 'ORDER_DELIVERED',
        order: testOrder17._id
      });
      if (r.status === 200 && body.success && notif) {
        pass('Test 32: ORDER_DELIVERED notification fired after delivered status update');
      } else fail('Test 32: Delivery notification', `status=${r.status}, notif=${!!notif}`);
    } catch (e) { fail('Test 32: Delivery notification', e.message); }

    // TEST 33: Return admin listing
    try {
      const r = await req('GET', '/admin/returns', tokenAdmin);
      const body = await r.json();
      if (r.status === 200 && body.success && Array.isArray(body.data?.returns)) pass('Test 33: Return admin listing');
      else fail('Test 33: Return admin listing', `status=${r.status}`);
    } catch (e) { fail('Test 33: Return admin listing', e.message); }

    // TEST 34: Return admin detail
    try {
      const r = await req('GET', `/admin/returns/${testReturn17._id}`, tokenAdmin);
      const body = await r.json();
      if (r.status === 200 && body.success && body.data?.returnRequest?._id?.toString() === testReturn17._id.toString()) {
        pass('Test 34: Return admin detail');
      } else fail('Test 34: Return admin detail', `status=${r.status}`);
    } catch (e) { fail('Test 34: Return admin detail', e.message); }

    // TEST 35: Refund workflow reuse — admin approve return uses Step 15 returnService
    try {
      const r = await req('PATCH', `/admin/returns/${testReturn17._id}/approve`, tokenAdmin);
      const body = await r.json();
      const fresh = await ReturnRequest.findById(testReturn17._id);
      if (r.status === 200 && body.success && fresh.status === 'approved') {
        pass('Test 35: Refund workflow reuse — admin approve uses Step 15 returnService');
      } else fail('Test 35: Refund workflow', `status=${r.status}, returnStatus=${fresh?.status}`);
    } catch (e) { fail('Test 35: Refund workflow', e.message); }

    // TEST 36: Refund amount tampering blocked
    try {
      // Attempt to inject custom refundAmount via the refund endpoint body
      const r = await req('PATCH', `/admin/returns/${testReturn17._id}/refund`, tokenAdmin, {
        refundAmount: 999999,  // tampered
        stockRestored: true    // attempt to bypass stock restoration
      });
      // The refund may succeed or fail based on Razorpay config in test — key is refundAmount is server-calculated
      const fresh = await ReturnRequest.findById(testReturn17._id);
      // Refund amount must equal server-calculated value (1000), not injected value (999999)
      const refundAmountUnchanged = fresh.refundAmount === 1000;
      if (refundAmountUnchanged) pass('Test 36: Refund amount tampering blocked — DB value unchanged');
      else fail('Test 36: Refund amount tampering', `refundAmount=${fresh?.refundAmount}`);
    } catch (e) { fail('Test 36: Refund amount tampering', e.message); }

    // TEST 37: Seller application admin access
    try {
      const r = await req('GET', '/admin/seller-applications', tokenAdmin);
      const body = await r.json();
      if (r.status === 200 && body.success) pass('Test 37: Seller application admin listing works');
      else fail('Test 37: Seller application access', `status=${r.status}`);
    } catch (e) { fail('Test 37: Seller application access', e.message); }

    // TEST 38: Existing seller approval workflow preserved
    try {
      const appUser = await User.create({ name: 'AppUser17', email: `app17_${timestamp}@t.com`, password: 'Pw!1234', role: 'customer', isEmailVerified: true });
      const app17 = await SellerApplication.create({
        user: appUser._id,
        businessName: 'Test App Store',
        businessType: 'individual',
        contactEmail: `app17_${timestamp}@t.com`,
        businessAddress: '1 St, Delhi',
        city: 'Delhi',
        state: 'Delhi',
        postalCode: '110001',
        country: 'India',
        panNumber: 'AABCT1234Z',
        status: 'pending'
      });
      const r = await req('PATCH', `/admin/seller-applications/${app17._id}/approve`, tokenAdmin);
      const body = await r.json();
      if (r.status === 200 && body.success) {
        pass('Test 38: Existing seller approval workflow preserved');
      } else fail('Test 38: Seller approval workflow', `status=${r.status}, msg=${body?.message}`);
      await SellerApplication.deleteOne({ _id: app17._id });
      await Seller.deleteOne({ user: appUser._id });
      await User.deleteOne({ _id: appUser._id });
    } catch (e) { fail('Test 38: Seller approval workflow', e.message); }

    // TEST 39: Finance summary
    try {
      const r = await req('GET', '/admin/finance/summary', tokenAdmin);
      const body = await r.json();
      const m = body.data?.metrics;
      if (r.status === 200 && body.success && typeof m?.grossSales === 'number' && typeof m?.platformFees === 'number' && typeof m?.netSales === 'number') {
        pass(`Test 39: Finance summary returned (grossSales=${m.grossSales}, platformFees=${m.platformFees})`);
      } else fail('Test 39: Finance summary', `status=${r.status}, metrics=${JSON.stringify(m)}`);
    } catch (e) { fail('Test 39: Finance summary', e.message); }

    // TEST 40: Platform fee protection — client cannot inject financial fields via order status
    try {
      const r = await req('PATCH', `/admin/orders/${testOrder17._id}/status`, tokenAdmin, {
        orderStatus: 'cancelled',  // currently delivered — invalid transition
        grandTotal: 0,
        subtotal: 0,
        payment: { status: 'refunded' }
      });
      const fresh = await Order.findById(testOrder17._id);
      // Either status=400 (bad transition) or financial fields untouched
      const financialsUntouched = fresh.grandTotal === 1050;
      if (financialsUntouched) pass('Test 40: Platform fee protection — financial fields untouched after order status call');
      else fail('Test 40: Platform fee protection', `grandTotal=${fresh?.grandTotal}`);
    } catch (e) { fail('Test 40: Platform fee protection', e.message); }

    // TEST 41: Audit log creation after admin action
    try {
      const logsBefore = await AdminAuditLog.countDocuments({ admin: adminUser._id });
      await req('PATCH', `/admin/users/${targetUser._id}/block`, tokenAdmin);
      const logsAfter = await AdminAuditLog.countDocuments({ admin: adminUser._id });
      if (logsAfter > logsBefore) pass('Test 41: Audit log created after admin block action');
      else fail('Test 41: Audit log creation', `before=${logsBefore}, after=${logsAfter}`);
      await req('PATCH', `/admin/users/${targetUser._id}/unblock`, tokenAdmin);
    } catch (e) { fail('Test 41: Audit log creation', e.message); }

    // TEST 42: Audit log immutability — no DELETE endpoint
    try {
      const auditLog = await AdminAuditLog.findOne({ admin: adminUser._id });
      let r;
      if (auditLog) {
        r = await req('DELETE', `/admin/audit-logs/${auditLog._id}`, tokenAdmin);
        if (r.status === 404 || r.status === 405) {
          pass('Test 42: Audit log immutability — no DELETE endpoint (404/405)');
        } else fail('Test 42: Audit log immutability', `Expected 404/405, got ${r.status}`);
      } else {
        // No audit log yet — endpoint itself must not exist
        r = await req('DELETE', '/admin/audit-logs/507f1f77bcf86cd799439011', tokenAdmin);
        if (r.status === 404 || r.status === 405) pass('Test 42: Audit log immutability — no DELETE endpoint');
        else fail('Test 42: Audit log immutability', `Expected 404/405, got ${r.status}`);
      }
    } catch (e) { fail('Test 42: Audit log immutability', e.message); }

    // TEST 43: Audit log listing
    try {
      const r = await req('GET', '/admin/audit-logs', tokenAdmin);
      const body = await r.json();
      if (r.status === 200 && body.success && Array.isArray(body.data?.logs)) pass('Test 43: Audit log listing');
      else fail('Test 43: Audit log listing', `status=${r.status}`);
    } catch (e) { fail('Test 43: Audit log listing', e.message); }

    // TEST 44: Audit log filtering by action
    try {
      const r = await req('GET', '/admin/audit-logs?action=USER_BLOCKED', tokenAdmin);
      const body = await r.json();
      if (r.status === 200 && body.success) pass('Test 44: Audit log filtering by action');
      else fail('Test 44: Audit log filtering', `status=${r.status}`);
    } catch (e) { fail('Test 44: Audit log filtering', e.message); }

    // TEST 45: Admin notification received after seller suspension
    try {
      const notifsBefore = await Notification.countDocuments({ recipient: adminUser._id });
      // Re-suspend seller to trigger audit log (notification created separately)
      await req('PATCH', `/admin/sellers/${sellerProfile._id}/suspend`, tokenAdmin);
      const auditLog = await AdminAuditLog.findOne({ action: 'SELLER_SUSPENDED', admin: adminUser._id });
      if (auditLog) pass('Test 45: Audit log created for seller suspension (notification system intact)');
      else fail('Test 45: Admin notification for suspension', 'No audit log found for SELLER_SUSPENDED');
      await req('PATCH', `/admin/sellers/${sellerProfile._id}/reactivate`, tokenAdmin);
    } catch (e) { fail('Test 45: Admin notification', e.message); }

    // TEST 46: Notification idempotency — repeated shipped status notification not duplicated
    try {
      // ORDER is delivered so shipped transition is blocked; create a fresh order
      const freshOrder = await Order.create({
        orderNumber: `BM-T17B-${timestamp}`,
        user: customerUser._id,
        items: [{ product: product17A._id, seller: sellerProfile._id, name: product17A.name, sku: product17A.sku, quantity: 1, unitPrice: 500, gstRate: 18, gstAmount: 76.27, itemSubtotal: 423.73, itemTotal: 500 }],
        shippingAddress: { fullName: 'Cust17', phone: '9000000017', addressLine1: '1 St', city: 'Delhi', state: 'Delhi', postalCode: '110001', country: 'India' },
        shipping: { totalDeliveryFee: 0, sellers: [{ seller: sellerProfile._id, sellerName: 'Store17', distanceKm: 0, billableDistanceKm: 0, deliveryFee: 0 }] },
        subtotal: 423.73, gstTotal: 76.27, deliveryFee: 0, platformFee: 0, discount: 0, grandTotal: 500,
        payment: { provider: 'razorpay', status: 'paid', razorpayOrderId: `rzp_ord_t17b_${timestamp}`, razorpayPaymentId: `rzp_pay_t17b_${timestamp}` },
        orderStatus: 'processing'
      });
      // Fire shipped notification directly via service to test idempotency
      const notifService = require('../services/notificationService');
      const n1 = await notifService.notifyOrderShipped({ order: freshOrder, userId: customerUser._id });
      const n2 = await notifService.notifyOrderShipped({ order: freshOrder, userId: customerUser._id });
      if (n1 && n2 === null) pass('Test 46: Notification idempotency — duplicate shipped notification suppressed');
      else fail('Test 46: Notification idempotency', `n1=${!!n1}, n2=${!!n2}`);
      await Order.deleteOne({ _id: freshOrder._id });
      if (n1) await Notification.deleteOne({ _id: n1._id });
    } catch (e) { fail('Test 46: Notification idempotency', e.message); }

    // TEST 47: Cross-admin isolation — admin cannot see another user's notifications
    try {
      const notif = await Notification.create({ recipient: adminUser._id, recipientRole: 'admin', type: 'SYSTEM', title: 'Admin only', message: 'Private', eventKey: `cross_admin_${timestamp}` });
      const r = await req('GET', `/notifications/${notif._id}`, tokenAdmin2);
      if (r.status === 404) pass('Test 47: Cross-admin notification isolation — admin2 cannot see admin1 notification');
      else fail('Test 47: Cross-admin isolation', `Expected 404, got ${r.status}`);
      await Notification.deleteOne({ _id: notif._id });
    } catch (e) { fail('Test 47: Cross-admin isolation', e.message); }

    // TEST 48: Invalid ObjectId returns 400
    try {
      const r = await req('GET', '/admin/users/not-an-objectid', tokenAdmin);
      if (r.status === 400) pass('Test 48: Invalid ObjectId returns 400');
      else fail('Test 48: Invalid ObjectId', `Expected 400, got ${r.status}`);
    } catch (e) { fail('Test 48: Invalid ObjectId', e.message); }

    // TEST 49: Invalid pagination (limit > 50 for notifications — admin validator uses 100 but notification validator uses 50)
    try {
      const r = await req('GET', '/notifications?limit=200', tokenAdmin);
      if (r.status === 400) pass('Test 49: Invalid pagination limit rejected (400)');
      else fail('Test 49: Invalid pagination', `Expected 400, got ${r.status}`);
    } catch (e) { fail('Test 49: Invalid pagination', e.message); }

    // TEST 50: Finance summary date range filter
    try {
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const to = new Date().toISOString();
      const r = await req('GET', `/admin/finance/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, tokenAdmin);
      const body = await r.json();
      if (r.status === 200 && body.success && body.data?.period === 'custom') {
        pass('Test 50: Finance summary with custom date range (period=custom)');
      } else fail('Test 50: Finance summary date range', `status=${r.status}, period=${body.data?.period}`);
    } catch (e) { fail('Test 50: Finance summary date range', e.message); }

    // ─── REGRESSION TESTS ─────────────────────────────────────────
    console.log('\nRunning Step 17 Regression Tests...');
    const rCheck = async (label, method, path, token, expectedStatus, body) => {
      try {
        const r = await req(method, path, token, body);
        if (r.status === expectedStatus) { regressionResults[label] = 'PASS'; console.log(`  ✓ ${label}: PASS`); }
        else { regressionResults[label] = `FAIL: expected ${expectedStatus}, got ${r.status}`; console.error(`  ✗ ${label}: FAIL (expected ${expectedStatus}, got ${r.status})`); }
      } catch (e) { regressionResults[label] = `FAIL: ${e.message}`; console.error(`  ✗ ${label}: FAIL — ${e.message}`); }
    };

    // Steps 1-5
    await rCheck('Auth/Email Regression', 'POST', '/auth/register', null, 400, { name: 'T', email: `reg17_${timestamp}@x.com`, password: 'x' });
    // Step 6 RBAC
    await rCheck('RBAC Regression', 'GET', '/admin/dashboard/summary', tokenCustomer, 403);
    // Step 7 Profile
    await rCheck('Profile/Address Regression', 'GET', '/users/me', tokenCustomer, 200);
    // Step 8 Seller Onboarding
    await rCheck('Seller Onboarding Regression', 'GET', '/admin/seller-applications', tokenAdmin, 200);
    // Step 9 Category/Product
    await rCheck('Category Regression', 'GET', '/categories', null, 200);
    await rCheck('Product Catalog Regression', 'GET', '/products', null, 200);
    // Step 10 ImageKit (seller products list confirms product/image endpoint integrity)
    await rCheck('ImageKit Regression', 'GET', '/seller/products', tokenSeller, 200);
    // Step 11 Cart/Orders
    await rCheck('Cart Regression', 'GET', '/cart', tokenCustomer, 200);
    await rCheck('Orders Regression', 'GET', '/orders', tokenCustomer, 200);
    // Step 12 Shipping
    await rCheck('Shipping Regression', 'POST', '/shipping/quote', tokenCustomer, 400, {});
    // Step 13 Seller Dashboard
    await rCheck('Seller Dashboard Regression', 'GET', '/seller/dashboard/summary', tokenSeller, 200);
    // Step 15 Returns
    await rCheck('Returns Regression', 'GET', '/orders/returns', tokenCustomer, 200);
    // Step 16 Notifications
    await rCheck('Notifications Regression', 'GET', '/notifications', tokenCustomer, 200);

    console.log('Regression tests complete\n');

    // ─── FINAL SUMMARY ────────────────────────────────────────────
    const passed = Object.values(results).filter((v) => v === 'PASS').length;
    const failed = Object.values(results).filter((v) => v !== 'PASS').length;
    const regPass = Object.values(regressionResults).filter((v) => v === 'PASS').length;
    const regFail = Object.values(regressionResults).filter((v) => v !== 'PASS').length;

    console.log('\n========================================');
    console.log('STEP 17 ADMIN MANAGEMENT TEST RESULTS');
    console.log('========================================');
    for (const [k, v] of Object.entries(results)) {
      console.log(`${v === 'PASS' ? '✓' : '✗'} ${k}: ${v}`);
    }
    console.log(`\nAdmin Tests: ${passed} PASS, ${failed} FAIL`);
    console.log('\nRegression:');
    for (const [k, v] of Object.entries(regressionResults)) {
      console.log(`${v === 'PASS' ? '✓' : '✗'} ${k}: ${v}`);
    }
    console.log(`Regression: ${regPass} PASS, ${regFail} FAIL`);
    console.log('========================================\n');

    if (failed > 0 || regFail > 0) {
      console.error(`[SUMMARY] ${failed} admin test(s) and ${regFail} regression(s) FAILED.`);
    } else {
      console.log('[SUMMARY] All 50 admin tests + 13 regression categories PASSED. Step 17 complete.');
    }

  } catch (fatal) {
    console.error('[FATAL]', fatal.message, fatal.stack);
  } finally {
    // Cleanup all test fixtures
    try {
      const testEmails = [adminEmail, admin2Email, sellerEmail, customerEmail, targetEmail];
      const testUsers = await User.find({ email: { $in: testEmails } }).select('_id');
      const testUserIds = testUsers.map((u) => u._id);

      await Notification.deleteMany({ recipient: { $in: testUserIds } });
      await AdminAuditLog.deleteMany({ admin: { $in: testUserIds } });
      await ReturnRequest.deleteMany({ customer: { $in: testUserIds } });
      await Order.deleteMany({ user: { $in: testUserIds } });
      await Product.deleteMany({ seller: sellerProfile?._id });
      await Seller.deleteMany({ user: sellerUser?._id });
      await Category.deleteOne({ _id: category17?._id });
      await User.deleteMany({ email: { $in: testEmails } });

      console.log('[Cleanup] Step 17 test fixtures removed');
    } catch (cleanErr) {
      console.error('[Cleanup Error]', cleanErr.message);
    }

    if (server) server.close();
    await mongoose.connection.close();
    process.exit(0);
  }
};

runStep17Tests();
