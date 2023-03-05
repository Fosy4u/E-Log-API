const OrganisationPartnerModel = require("../models/organisationPartner");
const CustomerModel = require("../models/customer");
const TripModel = require("../models/trip");
const VendorAgentModel = require("../models/vendorAgent");

const canDeleteOrEditOrganisationPartnerRemark = async (param) => {
  const { partnerId, remarkId, userId } = param;
  let canPerformAction = false;
  const partner = await OrganisationPartnerModel.findOne({
    _id: partnerId,
  });
  if (partner.remarks?.length > 0) {
    const remark = partner.remarks.find(
      (remark) => remark._id.toString() === remarkId
    );
    if (remark) {
      canPerformAction = remark.userId.toString() === userId;
    }
  }
  return canPerformAction;
};
const canDeleteOrEditOrganisationCustomerRemark = async (param) => {
  const { customerId, remarkId, userId } = param;
  let canPerformAction = false;
  const customer = await CustomerModel.findOne({
    _id: customerId,
  });
  if (customer.remarks?.length > 0) {
    const remark = customer.remarks.find(
      (remark) => remark._id.toString() === remarkId
    );
    if (remark) {
      canPerformAction = remark.userId.toString() === userId;
    }
  }
  return canPerformAction;
};
const canDeleteOrEditOrganisationVendorAgentRemark = async (param) => {
  const { vendorAgentId, remarkId, userId } = param;
  let canPerformAction = false;
  const vendor = await VendorAgentModel.findOne({
    _id: vendorAgentId,
  });
  if (vendor?.remarks?.length > 0) {
    const remark = vendor.remarks.find(
      (remark) => remark._id.toString() === remarkId
    );
    if (remark) {
      canPerformAction = remark.userId.toString() === userId;
    }
  }
  return canPerformAction;
};
const canDeleteOrEditOrganisationTripRemark = async (param) => {
  const { tripId, remarkId, userId } = param;
  let canPerformAction = false;
  const trip = await TripModel.findOne({
    _id: tripId,
  });
  if (trip.remarks?.length > 0) {
    const remark = trip.remarks.find(
      (remark) => remark._id.toString() === remarkId
    );
    if (remark) {
      canPerformAction = remark.userId.toString() === userId;
    }
  }
  return canPerformAction;
};

module.exports = {
  canDeleteOrEditOrganisationPartnerRemark,
  canDeleteOrEditOrganisationCustomerRemark,
  canDeleteOrEditOrganisationTripRemark,
  canDeleteOrEditOrganisationVendorAgentRemark
};
