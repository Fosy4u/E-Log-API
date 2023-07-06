"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const ReceivedEmailsSchema = new mongoose.Schema({
  email: { type: String, required: true },
  date: { type: Date, required: true },
  docAttached: { type: Boolean, default: false },
});

const InvoiceSchema = new mongoose.Schema({
  organisationId: { type: String, required: true },
  invoiceId: { type: String, required: true },
  shareCode: {
    type: {
      code: String,
      date: Date,
      userId: String,
      expiresAt: Date,
    },
    required: false,
  },
  vendorId: { type: String },
  disabled: { type: Boolean, default: false },
  date: { type: Date, required: true },
  dueDate: { type: Date, required: false },
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
  receivedEmails: { type: [ReceivedEmailsSchema] },
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
