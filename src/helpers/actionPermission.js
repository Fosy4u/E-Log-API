const OrganisationPartnerModel = require("../models/organisationPartner");
const CustomerModel = require("../models/customer");
const TripModel = require("../models/trip");
const VendorAgentModel = require("../models/vendorAgent");
const OrganisationUserModel = require("../models/organisationUsers");
const ExpensesModel = require("../models/expenses");
const IncomeModel = require("../models/income");
const InvoiceModel = require("../models/invoice");

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
const canEditOrganisationTrip = async (param) => {
  const { tripId, userId } = param;
  let canPerformAction = false;
  const trip = await TripModel.findOne({
    _id: tripId,
  });
  const organisationId = trip?.organisationId;
  const user = await OrganisationUserModel.findOne({
    _id: userId,
    organisationId,
  });
  if (user) {
    canPerformAction = true;
  }
  return canPerformAction;
};

const canDeleteOrEditOrganisationExpensesRemark = async (param) => {
  const { expensesId, remarkId, userId } = param;

  let canPerformAction = false;
  const expenses = await ExpensesModel.findOne({
    _id: expensesId,
  });

  if (expenses?.remarks?.length > 0) {
    const remark = expenses.remarks.find(
      (remark) => remark._id.toString() === remarkId
    );
    console.log(remark);
    if (remark) {
      canPerformAction = remark.userId.toString() === userId;
    }
  }
  return canPerformAction;
};
const canEditOrganisationExpenses = async (param) => {
  const { expensesId, userId } = param;
  let canPerformAction = false;
  const expenses = await ExpensesModel.findOne({
    _id: expensesId,
  });
  const organisationId = expenses?.organisationId;
  const user = await OrganisationUserModel.findOne({
    _id: userId,
    organisationId,
  });
  if (user) {
    canPerformAction = true;
  }
  return canPerformAction;
};
const canCreateOrganisationExpenses = async (param) => {
  const { organisationId, userId } = param;

  let canPerformAction = false;
  const user = await OrganisationUserModel.findOne({ _id: userId });
  if (user?.organisationId.toString() === organisationId) {
    canPerformAction = true;
  }
  return canPerformAction;
};

const canDeleteOrEditOrganisationIncomeRemark = async (param) => {
  const { incomeId, remarkId, userId } = param;

  let canPerformAction = false;
  const income = await IncomeModel.findOne({
    _id: incomeId,
  });

  if (income?.remarks?.length > 0) {
    const remark = income.remarks.find(
      (remark) => remark._id.toString() === remarkId
    );
    console.log(remark);
    if (remark) {
      canPerformAction = remark.userId.toString() === userId;
    }
  }
  return canPerformAction;
};
const canCreateOrganisationIncome = async (param) => {
  const { organisationId, userId } = param;
  let canPerformAction = false;
  const user = await OrganisationUserModel.findOne({ _id: userId });
  if (user?.organisationId.toString() === organisationId) {
    canPerformAction = true;
  }
  return canPerformAction;
};
const canEditOrganisationIncome = async (param) => {
  const { incomeId, userId } = param;
  let canPerformAction = false;
  const income = await IncomeModel.findOne({
    _id: incomeId,
  });
  const organisationId = income?.organisationId;
  const user = await OrganisationUserModel.findOne({
    _id: userId,
    organisationId,
  });
  if (user) {
    canPerformAction = true;
  }
  return canPerformAction;
};
const canDeleteOrEditOrganisationInvoiceRemark = async (param) => {
  const { invoiceId, remarkId, userId } = param;

  let canPerformAction = false;
  const invoice = await InvoiceModel.findOne({
    _id: invoiceId,
  });

  if (invoice?.remarks?.length > 0) {
    const remark = invoice.remarks.find(
      (remark) => remark._id.toString() === remarkId
    );
    console.log(remark);
    if (remark) {
      canPerformAction = remark.userId.toString() === userId;
    }
  }
  return canPerformAction;
};
const canCreateOrganisationInvoice = async (param) => {
  const { organisationId, userId } = param;
  let canPerformAction = false;
  const user = await OrganisationUserModel.findOne({ _id: userId });
  if (user?.organisationId.toString() === organisationId) {
    canPerformAction = true;
  }
  return canPerformAction;
};
const canEditOrganisationInvoice = async (param) => {
  const { invoiceId, userId } = param;
  let canPerformAction = false;
  const invoice = await InvoiceModel.findOne({
    _id: invoiceId,
  });
  const organisationId = invoice?.organisationId;
  const user = await OrganisationUserModel.findOne({
    _id: userId,
    organisationId,
  });
  if (user) {
    canPerformAction = true;
  }
  return canPerformAction;
};

module.exports = {
  canDeleteOrEditOrganisationPartnerRemark,
  canDeleteOrEditOrganisationCustomerRemark,
  canDeleteOrEditOrganisationTripRemark,
  canDeleteOrEditOrganisationVendorAgentRemark,
  canEditOrganisationTrip,
  canDeleteOrEditOrganisationExpensesRemark,
  canCreateOrganisationExpenses,
  canEditOrganisationExpenses,
  canDeleteOrEditOrganisationIncomeRemark,
  canEditOrganisationIncome,
  canCreateOrganisationIncome,
  canDeleteOrEditOrganisationInvoiceRemark,
  canEditOrganisationInvoice,
  canCreateOrganisationInvoice,
};
