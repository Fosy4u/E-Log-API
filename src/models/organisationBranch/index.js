const mongoose = require("mongoose");
const timestamp = require("mongoose-timestamp");

const BranchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  region: { type: String, required: true },
  country: { type: String, required: true },
  email: { type: String },
  phoneNo: { type: String },
  headOffice: { type: Boolean, default: false },
  status: { type: String, default: "active" },
});
const OrganisationBranchSchema = new mongoose.Schema({
  organisationId: { type: String, required: true },
  branches: [BranchSchema],
});

OrganisationBranchSchema.plugin(timestamp);
const OrganisationBranchModel = mongoose.model(
  "organisationBranch",
  OrganisationBranchSchema,
  "organisationBranch"
);

module.exports = OrganisationBranchModel;
