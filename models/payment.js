// models/payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    farmerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Farmer',
        required: true
    },
    animalIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Animal'
    }],
    paymentType: {
        type: String,
        enum: [
            'single_registration',      // ADD THIS - for single animal registration
            'bulk_registration',         // for bulk registration
            'plan_subscription',         // for plan subscription
            'plan_renewal',              // for plan renewal
            'vaccination_fee',           // for vaccination fees
            'service_fee',               // for service fees
            'vaccination',               // for individual vaccination
            'consultation',              // for consultation
            'other'                      // for other types
        ],
        default: 'single_registration',  // CHANGE default to match enum
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    paymentMethod: {
        type: String,
        enum: ['online', 'cash', 'bank_transfer', 'qr_code', 'pending'],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
        default: 'pending'
    },
    transactionId: {
        type: String,
        unique: true,
        sparse: true
    },
    utrNumber: {
        type: String,
        sparse: true
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    paidDate: {
        type: Date
    },
    paymentDetails: {
        upiId: String,
        qrCodeData: String,
        bankName: String,
        accountNumber: String,
        reference: String
    },
    description: {
        type: String
    },
    metadata: {
        planType: String,
        planDuration: Number,
        startDate: Date,
        endDate: Date,
        customFields: mongoose.Schema.Types.Mixed
    },
    notes: {
        type: String
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    verifiedAt: Date
}, {
    timestamps: true
});

// Generate transaction ID
paymentSchema.pre('save', async function(next) {
    if (!this.transactionId) {
        const prefix = 'PAY';
        const timestamp = Date.now().toString().slice(-8);
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.transactionId = `${prefix}${timestamp}${random}`;
    }
    next();
});

module.exports = mongoose.model('Payment', paymentSchema);