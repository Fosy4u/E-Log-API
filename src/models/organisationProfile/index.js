"use strict";
const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const BankDetailSchema = new mongoose.Schema({
  bankName: { type: String, required: false },
  accountName: { type: String, required: false },
  accountNumber: { type: String, required: false },
});
const SocialSchema = new mongoose.Schema({
  twitter: String,
  linkedIn: String,
  tikTok: String,
  facebook: String,
  instagram: String,
  youtube: String,
});
const RegionalSettings = new mongoose.Schema({
  language: String,
  currency: { type: String, default: "₦" },
  timeZone: {
    label: {
      type: String,
      required: false,
      default: "Africa/Lagos (GMT+01:00)",
    },
    name: {
      type: String,
      required: false,
      default: "GMT+01:00) Lagos, Kano, Ibadan, Kaduna, Port Harcourt",
    },
    tzCode: { type: String, required: false, default: "Africa/Lagos" },
    utc: { type: String, required: false, default: "+01:00" },
  },
  inventoryStartDate: String,
  fiscalYear: {
    fiscalYearDay: { type: String, required: false, default: "1" },
    fiscalYearMonth: {
      type: String,
      required: false,
      default: "January - December",
    },
  },
});

const OrganisationProfileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  industry: { type: String, required: false },
  branchId: { type: String, required: false },
  tradingName: { type: String, required: false },
  companyRegNo: { type: String, required: false },
  websiteURL: { type: String, required: false },
  logoUrl: {
    link: { type: String, required: false },
    name: { type: String, required: false },
  },
  contactEmail: { type: String, required: true },
  phoneNo: { type: String, required: true },
  foundedAt: Date,
  country: { type: String, required: true },
  region: { type: String, required: true },
  social: SocialSchema,
  regionalSettings: RegionalSettings,
  active: { type: Boolean, required: true, default: true },

  deletionReasons: {
    type: Array,
    default: [
      "stolen product",
      "product on fire",
      "product written off",
      "damaged product",
      "stock re-evaluation",
    ],
  },
  vendorAgentClassification: {
    type: Array,
    default: [
      {
        name: "Tools",
        value: "Tools",
        description:
          "Allows vendor/agent to be listed on tools procurement",
      },
      {
        name: "Trips Provider",
        value: "Trips Provider",
        description: "Allows vendor/agent to be listed on trips assignment",
      },
      {
        name : "Fuel Provider",
        value : "Fuel Provider",
        description : "Allows vendor/agent to be listed on fuel procurement"
      },
      {
        name : "Service Provider",
        value : "Service Provider",
        description : "Allows vendor/agent to be listed on service order"
      },
      {
        name : "Vehicle Provider",
        value : "Vehicle Provider",
        description : "Allows vendor/agent to be listed on vehicle procurement"
      }
    ],
  },
  bankDetails: { type: [BankDetailSchema] },
});

OrganisationProfileSchema.plugin(timestamp);

const OrganisationProfileModel = mongoose.model(
  "organisationProfiles",
  OrganisationProfileSchema,
  "organisationProfiles"
);

module.exports = OrganisationProfileModel;
