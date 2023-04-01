"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const Tyre = new mongoose.Schema({
  organisationId: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  purchaseDate: { type: String, required: true },
  estimatedReplacementDate: { type: String, required: true },
  vehicleId: { type: String },
  userId: { type: String, required: true },
  serialNo: { type: String, required: true },
  brand: { type: String },
  size: { type: String },
  status: { type: String, required: true, default: "Active" },
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

Tyre.plugin(timestamp);

const TyreModel = mongoose.model("tyre", Tyre, "tyre");

module.exports = TyreModel;
