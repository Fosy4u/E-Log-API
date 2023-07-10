"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");


const Maintainance = new mongoose.Schema({
  organisationId: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  description: { type: String, required: false },
  assetId: { type: String, required: true },
  issueIds: { type: [String], required: false },
  priority: { type: String, required: false },
  submittedDate: { type: String, required: true },
  resolvedDate: { type: String, required: false },
  startDate: { type: String, required: false },
  dueDate: { type: String, required: false },
  subject: { type: String, required: true },
  category: { type: String, required: true },
  submittedBy: { type: String, required: true },
  approvedBy: { type: String, required: false },
  resolutionNote: { type: String, required: false },
  maintainanceId: { type: String, required: true },
  vendorId: { type: String, required: false },
  maintainanceType: { type: String, required: true },
  assignedPersonnelsList: {
    type: [
      {
        date: String,
        userId: String,
        assignedUserId: [String],
        action: String,
      },
    ],
  },
  status: { type: String, required: true, default: "Pending" },
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

Maintainance.plugin(timestamp);


const MaintainanceModel = mongoose.model("maintainance", Maintainance, "maintainance");

module.exports = MaintainanceModel;
