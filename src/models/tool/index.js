"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");
const AutoIncrement = require("mongoose-sequence")(mongoose);

const Tool = new mongoose.Schema({
  organisationId: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  description: { type: String, required: false },
  name: { type: String, required: true },
  purchaseDate: { type: String, required: false },
  puchaseExpensesId: { type: String, required: false },
  linkedOtherExpensesId: { type: [String], required: false, default: [] },
  estimatedReplacementDate: { type: String, required: false },
  vehicleId: { type: String },
  assignedUserId: { type: String, required: false },
  userId: { type: String, required: true },
  serialNo: { type: String },
  brand: { type: String },
  size: { type: String },
  model: { type: String },
  warantyExpiryDate: { type: String },
  status: { type: String, required: true, default: "Active" },
  remarks: {
    type: [{ userId: String, remark: String, date: String }],
    required: false,
  },
  statusList: {
    type: [
      {
        status: String,
        date: String,
        userId: String,
      },
    ],
  },
  assignedUserList: {
    type: [
      {
        date: String,
        userId: String,
        assignedUserId: String,
        action: String,
      },
    ],
  },
  assignedVehicleList: {
    type: [
      {
        date: String,
        userId: String,
        vehicleId: String,
        action: String,
      },
    ],
  },
  documents: [
    {
      link: { type: String, required: false },
      name: { type: String, required: false },
    },
  ],
  pictures: [
    {
      link: { type: String, required: false },
      name: { type: String, required: false },
    },
  ],
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

Tool.plugin(timestamp);
Tool.plugin(AutoIncrement, { inc_field: "toolId" });

const TyreModel = mongoose.model("tool", Tool, "tool");

module.exports = TyreModel;
