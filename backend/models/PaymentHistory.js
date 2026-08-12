const mongoose = require('mongoose');

// One row per real PayPal charge. The 'activation' row is created immediately
// at /confirm (so history is visible even before any webhook arrives), then
// enriched with the real transaction id once the matching PAYMENT.SALE.COMPLETED
// webhook event arrives. Later charges for the same subscription insert new
// 'renewal' rows. See backend/routes/payments.js for the exact reconciliation logic.
const paymentHistorySchema = new mongoose.Schema({
  user:                 { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  paypalSubscriptionId: { type: String, required: true, index: true },
  paypalTransactionId:  { type: String, default: null },
  type:                 { type: String, enum: ['activation', 'renewal'], required: true },
  billingCycle:         { type: String, enum: ['monthly', 'yearly'], required: true },
  amount:               { type: Number, required: true },
  currency:             { type: String, default: 'USD' },
  occurredAt:           { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model('PaymentHistory', paymentHistorySchema);
