"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const EmailTemplateSchema = new mongoose.Schema({
  type: { type: String, required: true },
  // subject: { type: String, required: true },
  body: { type: String, required: true },
});

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
  tyreBrands: {
    type: Array,
    default: [
      "Apollo",
      "Bridgestone",
      "CEAT",
      "Continental",
      "Dunlop",
      "Goodyear",
      "JK",
      "MRF",
      "Michelin",
      "Nexen",
      "Pirelli",
      "Yokohama",
      "Gallant",
    ],
  },
  tyreSizes: {
    type: Array,
    default: [
      "125/70 R16",
      "135/70 R13",
      "135/70 R15",
      "135/80 R12",
      "135/80 R13",
      "145/60 R13",
      "145/65 R15",
      "145/70 R12",
      "145/70 R13",
      "145/80 R10",
      "145/80 R12",
      "145/80 R13",
      "145/80 R14",
      "155/55 R14",
      "155/65 R13",
      "155/65 R14",
      "155/65 R15",
      "155/70 R12",
      "155/70 R13",
      "155/70 R15",
      "155/80 R12",
      "155/80 R13",
      "165/50 R15",
      "165/55 R13",
      "165/55 R14",
      "165/60 R12",
      "165/60 R14",
      "165/60 R15",
      "165/65 R13",
      "165/65 R14",
      "165/70 R14",
      "165/70 R13",
      "165/80 R15",
      "175/50 R13",
      "175/50 R15",
      "175/55 R15",
      "175/55 R16",
      "175/60 R13 ",
      "175/60 R14",
      "175/60 R15",
      "175/65 R16",
      "175/65 R13",
      "175/65 R14",
      "175/65 R15",
      "175/70 R13",
      "175/70 R14",
      "175/80 R14",
      "185/50 R14",
      "185/50 R16",
      "185/55 R14",
      "185/55 R15",
      "185/55 R16",
    ],
  },
  statusOptions: {
    type: Array,
    default: [
      "Active",
      "Spare",
      "Scrap",
      "Sold",
      "Lost",
      "Stolen",
      "Damaged",
      "Retired",
      "Expired",
    ],
  },
  tyreCountOptions: {
    type: Array,
    default: [
      {
        value: 4,
        label: "4 Tyres Truck",
      },
      {
        value: 8,
        label: "8 Tyres Truck",
      },
      {
        value: 10,
        label: "10 Tyres Truck",
      },
      {
        value: 12,
        label: "12 Tyres Truck",
      },
      {
        value: 14,
        label: "14 Tyres Truck",
      },
      {
        value: 16,
        label: "16 Tyres Truck",
      },
    ],
  },
  emailTemplates : [EmailTemplateSchema],

  expenseType: {
    type: Array,
    default: [
      {
        name: "Fuel",
        value: "Fuel",
      },
      {
        name: "Partner Payout",
        value: "Partner Payout",
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
        name: "Bonus",
        value: "Bonus",
      },
      {
        name: "Motor Boy Fee",
        value: "Motor Boy Fee",
      },

      {
        name: "Other",
        value: "Other",
      },
    ],
  },
});

TemplateSchema.plugin(timestamp);

const TemplateModel = mongoose.model("template", TemplateSchema, "template");

module.exports = TemplateModel;
