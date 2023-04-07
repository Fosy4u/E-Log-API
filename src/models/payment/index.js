"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const PaymentSchema = new mongoose.Schema({
  organisationId: { type: String, required: true },
  paymentId: { type: String, required: true },
  invoiceId: { type: String },
  disabled: { type: Boolean, default: false },
  date: { type: String },
  requestIds: { type: [{
    requestId: String,
    amount: Number,
  }] },
  vendorId: { type: String },
  amount: { type: Number },
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
