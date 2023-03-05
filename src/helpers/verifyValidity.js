const OrganisationUserModel = require("../models/organisationUsers");
const TruckModel = require("../models/truck");
const VendorAgentModel = require("../models/vendorAgent");

const verifyUserId = async (userId, organisationId) => {
  let valid = false;
  const user = await OrganisationUserModel.findOne({
    _id: userId,
    organisationId,
  });
  if (user) {
    valid = true;
  }
  return valid;
};

const verifyVehicleId = async (vehicleId, organisationId) => {
  let valid = false;
  const vehicle = await TruckModel.findOne({ _id: vehicleId, organisationId });
  if (vehicle) {
    valid = true;
  }
  return valid;
};

const verifyVendorAgentId = async (vendorAgentId, organisationId) => {
  let valid = false;
  const vendorAgent = await VendorAgentModel.findOne({
    _id: vendorAgentId,
    organisationId,
  });
  if (vendorAgent) {
    valid = true;
  }
  return valid;
};


module.exports = {
  verifyUserId,
  verifyVehicleId,
  verifyVendorAgentId,
};
