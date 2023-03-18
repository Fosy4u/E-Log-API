"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const Expenses = new mongoose.Schema({
  organisationId: { type: String, required: true },
  expensesId: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  date: { type: String, required: true },
  vehicleId: { type: String },
  userId: { type: String, required: true },
  tripId: { type: String},
  vendorId: { type: String },
  expenseType: { type: String, required: true },
  amount: { type: Number, required: true },
  documents: [{
    link: { type: String, required: false },
    name: { type: String, required: false },
  }],
  pictures: [{
    link: { type: String, required: false },
    name: { type: String, required: false },
  }],

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

Expenses.plugin(timestamp);

const ExpensesModel = mongoose.model("expenses", Expenses, "expenses");

module.exports = ExpensesModel;
