"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const IncomeSchema = new mongoose.Schema({
  organisationId: { type: String, required: true },
  incomeId: { type: String, required: true },
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

IncomeSchema.plugin(timestamp);

const IncomeModel = mongoose.model("income", IncomeSchema, "income");

module.exports = IncomeModel;
