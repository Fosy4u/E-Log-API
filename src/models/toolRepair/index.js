"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const ToolRepair = new mongoose.Schema({
  repairId: { type: String, required: true },
  toolId: { type: String, required: true },
  date: { type: String, required: true },
  expensesId: { type: String, required: false },
  description: { type: String, required: false },
  repairType: { type: String, required: true },
  userId: { type: String, required: true },
  remarks: {
    type: [{ userId: String, remark: String, date: String }],
    required: false,
  },
});

ToolRepair.plugin(timestamp);

const ToolRepairModel = mongoose.model("toolRepair", ToolRepair, "toolRepair");

module.exports =  ToolRepairModel;
