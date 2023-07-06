"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");


const Issue = new mongoose.Schema({
  organisationId: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  description: { type: String, required: false },
  assetId: { type: String, required: true },
  issueId: { type: String, required: true },
  priority: { type: String, required: false },
  reportedDate: { type: String, required: true },
  dueDate: { type: String, required: false },
  subject: { type: String, required: true },
  category: { type: String, required: true },
  reportedBy: { type: String, required: true },
  verifiedBy: { type: String, required: false },
  
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

Issue.plugin(timestamp);


const IssueModel = mongoose.model("issue", Issue, "issue");

module.exports = IssueModel;
