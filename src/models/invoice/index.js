"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const InvoiceSchema = new mongoose.Schema({
  organisationId: { type: String, required: true },
  invoiceId: { type: String, required: true },
  vendorId: { type: String },
  disabled: { type: Boolean, default: false },
  date: { type: Date, required: true },
  requestIds: {
    type: [
      {
        requestId: String,
        waybillNumber: String,
        amount: Number,
        quantity: Number,
        destination: String,
      },
    ],
  },
  amount: { type: Number, required: true },
  remarks: {
    type: { userId: String, remark: String, date: String },
    required: false,
  },
  sentToCustomer: { type: Boolean, default: false },
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

InvoiceSchema.plugin(timestamp);

const InvoiceModel = mongoose.model("invoice", InvoiceSchema, "invoice");

module.exports = InvoiceModel;
