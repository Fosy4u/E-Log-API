"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");





const DetailSchema = new mongoose.Schema({
  serialNo: { type: String, required: true },
  scratchType: { type: String, required: true },
  isWheelAligned: { type: Boolean, required: true, default: true},
  tyreHealthCheckRating: { type: Number, required: true },
  isOilLeakage: { type: Boolean, required: true, default: false },
  inflationPercentage: { type: Number, required: true },
  bulge: { type: Number, required: true },
});
const TyreInspectionSchema = new mongoose.Schema({
  inspectionId: { type: String, required: true },
  organisationId: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  date: { type: String, required: true },
  vehicleId: { type: String, required: true },
  userId: { type: String, required: true },
  details: [DetailSchema],
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

TyreInspectionSchema.plugin(timestamp);
const TyreInspectionModel = mongoose.model(
  "tyreInspection",
  TyreInspectionSchema,
  "tyreInspection"
);
module.exports = TyreInspectionModel;
