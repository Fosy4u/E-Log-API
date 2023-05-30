"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const ReceivedEmailsSchema = new mongoose.Schema({
  email: { type: String, required: true },
  date: { type: Date, required: true },
  docAttached: { type: Boolean, default: false },
});

const PaymentSchema = new mongoose.Schema({
  organisationId: { type: String, required: true },
  paymentId: { type: String, required: true },
  invoiceId: { type: String },
  disabled: { type: Boolean, default: false },
  date: { type: Date, required: true },
  requestIds: {
    type: [
      {
        requestId: String,
        amount: Number,
      },
    ],
  },
  shareCode: {
    type: {
      code: String,
      date: Date,
      userId: String,
      expiresAt: Date,
    },
    required: false,
  },
  isTrip: { type: Boolean, default: false },
  vendorId: { type: String },
  isVendorRequested: { type: Boolean, required: true },
  customerId: { type: String },
  amount: { type: Number },
  description: { type: String },
  paymentMethod: { type: String, required: true },
  receiptMessage: { type: String },
  sentToCustomer: { type: Boolean, default: false },
  receivedEmails: { type: [ReceivedEmailsSchema] },
  remarks: {
    type: [{ userId: String, remark: String, date: String }],
    required: false,
  },
  logs: [
    {
      date: Date,
      user: String,
      userId: String,
      action: String,
      details: String,
      comment: String,
      difference: [{ _id: false, field: String, old: String, new: String }],
      reason: String,
    },
  ],
});

PaymentSchema.plugin(timestamp);

const PaymentModel = mongoose.model("payment", PaymentSchema, "payment");

module.exports = PaymentModel;
