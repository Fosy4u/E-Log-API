"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const TemplateSchema = new mongoose.Schema({
  disabled: { type: Boolean, default: false },
  organisationId: { type: String, required: true },
  vendorAgentClassification: {
    type: Array,
    default: [
      {
        name: "Tools",
        value: "Tools",
        description: "Allows vendor/agent to be listed on tools procurement",
      },
      {
        name: "Trips Provider",
        value: "Trips Provider",
        description: "Allows vendor/agent to be listed on trips assignment",
      },
      {
        name: "Fuel Provider",
        value: "Fuel Provider",
        description: "Allows vendor/agent to be listed on fuel procurement",
      },
      {
        name: "Service Provider",
        value: "Service Provider",
        description: "Allows vendor/agent to be listed on service order",
      },
      {
        name: "Vehicle Provider",
        value: "Vehicle Provider",
        description: "Allows vendor/agent to be listed on vehicle procurement",
      },
    ],
  },
  expenseType: {
    type: Array,
    default: [
      {
        name: "Fuel",
        value: "Fuel",
      },
      {
        name: "Service",
        value: "Service",
      },
      {
        name: "Tools",
        value: "Tools",
      },
      {
        name: "Salary",
        value: "Salary",
      },
      {
        name: "Driver Fee",
        value: "Driver Fee",
      },
      {
        name: "Vehicle Maintenance",
        value: "Vehicle Maintenance",
      },
      {
        name: "Vehicle Insurance",
        value: "Vehicle Insurance",
      },
      {
        name: "Vehicle Registration",
        value: "Vehicle Registration",
      },
      {
        name: "Vehicle License / Permit",
        value: "Vehicle License / Permit",
      },
      {
        name: "Vehicle Tyres",
        value: "Vehicle Tyres",
      },
      {
        name: "Vehicle Others",
        value: "Vehicle Others",
      },
      {
        name: "Fines",
        value: "Fines",
      },
      {
        name: "Goods in Transit Insurance",
        value: "Goods in Transit Insurance",
      },
      {
        name: "Legal",
        value: "Legal",
      },
      {
        name: "Loan Payment",
        value: "Loan Payment",
      },
      {
        name: "Technology",
        value: "Technology",
      },
      {
        name: "Office Rent",
        value: "Office Rent",
      },
      {
        name: "Office Utilities",
        value: "Office Utilities",
      },
      {
        name: "Tax",
        value: "Tax",
      },
      {
        name: "Miscellaneous",
        value: "Miscellaneous",
      },
      {
        name: "Charity",
        value: "Charity",
      },
      {
        name: "Other",
        value: "Other",
      }

    ],
  },
});

TemplateSchema.plugin(timestamp);

const TemplateModel = mongoose.model("template", TemplateSchema, "template");

module.exports = TemplateModel;
