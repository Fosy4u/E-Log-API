const OrganisationPartnerModel = require("../models/organisationPartner");
const CustomerModel = require("../models/customer");
const IssueModel = require("../models/issue");
const TripModel = require("../models/trip");
const VendorAgentModel = require("../models/vendorAgent");
const OrganisationUserModel = require("../models/organisationUsers");
const ExpensesModel = require("../models/expenses");
const PaymentModel = require("../models/payment");
const InvoiceModel = require("../models/invoice");
const TyreModel = require("../models/tyre");
const ToolModel = require("../models/tool");
const TruckModel = require("../models/truck");

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

const canDeleteOrEditOrganisationTyreRemark = async (param) => {
  const { tyreId, remarkId, userId } = param;
  let canPerformAction = false;
  const tyre = await TyreModel.findOne({
    _id: tyreId,
  });

  if (tyre?.remarks?.length > 0) {
    const remark = tyre.remarks.find(
      (remark) => remark._id.toString() === remarkId
    );
 
    if (remark) {
      canPerformAction = remark.userId.toString() === userId;
    }
  }
  return canPerformAction;
};
const canEditOrganisationTyre = async (param) => {
  const { tyreId, userId } = param;
  let canPerformAction = false;
  const tyre = await TyreModel.findOne({
    _id: tyreId,
  });
  const organisationId = tyre?.organisationId;
  const user = await OrganisationUserModel.findOne({
    _id: userId,
    organisationId,
  });
  if (user) {
    canPerformAction = true;
  }
  return canPerformAction;
};
const canCreateOrganisationTyre = async (param) => {
  const { organisationId, userId } = param;

  let canPerformAction = false;
  const user = await OrganisationUserModel.findOne({ _id: userId });
  if (user?.organisationId.toString() === organisationId) {
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

const canDeleteOrEditOrganisationPaymentRemark = async (param) => {
  const { paymentId, remarkId, userId } = param;

  let canPerformAction = false;
  const payment = await PaymentModel.findOne({
    _id: paymentId,
    disabled: false,
  });

  if (payment?.remarks?.length > 0) {
    const remark = payment.remarks.find(
      (remark) => remark._id.toString() === remarkId
    );

    if (remark) {
      canPerformAction = remark.userId.toString() === userId;
    }
  }
  return canPerformAction;
};
const canCreateOrganisationPayment = async (param) => {
  const { organisationId, userId } = param;
  let canPerformAction = false;
  const user = await OrganisationUserModel.findOne({ _id: userId });
  if (user?.organisationId.toString() === organisationId) {
    canPerformAction = true;
  }
  return canPerformAction;
};
const canEditOrganisationPayment = async (param) => {
  const { paymentId, userId } = param;
  let canPerformAction = false;
  const payment = await PaymentModel.findOne({
    _id: paymentId,
    disabled: false,
  });
  const organisationId = payment?.organisationId;
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
    disabled: false,
  }).lean();

  if (invoice?.remarks?.length > 0) {
    const remark = invoice.remarks.find(
      (remark) => remark._id.toString() === remarkId
    );

    if (remark) {
      canPerformAction = remark.userId.toString() === userId;
    }
  }
  return canPerformAction;
};
const canDeleteOrEditOrganisationTruckRemark = async (param) => {
  const { truckId, remarkId, userId } = param;

  let canPerformAction = false;
  const truck = await TruckModel.findOne({
    _id: truckId,
    disabled: false,
  });

  if (truck?.remarks?.length > 0) {
    const remark = truck.remarks.find(
      (remark) => remark._id.toString() === remarkId
    );

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
    disabled: false,
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

const canDeleteOrEditOrganisationToolRemark = async (param) => {
  const { toolId, remarkId, userId } = param;
  let canPerformAction = false;
  const tool = await ToolModel.findOne({
    _id: toolId,
  });

  if (tool?.remarks?.length > 0) {
    const remark = tool.remarks.find(
      (remark) => remark._id.toString() === remarkId
    );
  
    if (remark) {
      canPerformAction = remark.userId.toString() === userId;
    }
  }
  return canPerformAction;
};

const canEditOrganisationTool = async (param) => {
  const { toolId, userId } = param;
  let canPerformAction = false;
  const tyre = await ToolModel.findOne({
    _id: toolId,
  });
  const organisationId = tyre?.organisationId;
  const user = await OrganisationUserModel.findOne({
    _id: userId,
    organisationId,
  });
  if (user) {
    canPerformAction = true;
  }
  return canPerformAction;
};
const canCreateOrganisationTool = async (param) => {
  const { organisationId, userId } = param;

  let canPerformAction = false;
  const user = await OrganisationUserModel.findOne({ _id: userId });
  if (user?.organisationId.toString() === organisationId) {
    canPerformAction = true;
  }
  return canPerformAction;
};
const canEditOrganisationIssues = async (param) => {
  const { issueId, userId } = param;
  let canPerformAction = false;
  const issue = await IssueModel.findOne({
    _id: issueId,
  });
  const organisationId = issue?.organisationId;
  const user = await OrganisationUserModel.findOne({
    _id: userId,
    organisationId,
  });
  if (user) {
    canPerformAction = true;
  }
  return canPerformAction;
};

const canCreateOrganisationIssues = async (param) => {
  const { organisationId, userId } = param;

  let canPerformAction = false;
  const user = await OrganisationUserModel.findOne({ _id: userId });
  if (user?.organisationId.toString() === organisationId) {
    canPerformAction = true;
  }
  return canPerformAction;
};

const canDeleteOrEditOrganisationIssuesRemark = async (param) => {
  const { issueId, remarkId, userId } = param;
  let canPerformAction = false;
  const issue = await IssueModel.findOne({
    _id: issueId,
  });

  if (issue?.remarks?.length > 0) {
    const remark = issue.remarks.find(
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
  canDeleteOrEditOrganisationVendorAgentRemark,
  canEditOrganisationTrip,
  canDeleteOrEditOrganisationExpensesRemark,
  canCreateOrganisationExpenses,
  canEditOrganisationExpenses,
  canDeleteOrEditOrganisationPaymentRemark,
  canEditOrganisationPayment,
  canCreateOrganisationPayment,
  canDeleteOrEditOrganisationInvoiceRemark,
  canEditOrganisationInvoice,
  canCreateOrganisationInvoice,
  canDeleteOrEditOrganisationTyreRemark,
  canEditOrganisationTyre,
  canCreateOrganisationTyre,
  canDeleteOrEditOrganisationTruckRemark,
  canDeleteOrEditOrganisationToolRemark,
  canEditOrganisationTool,
  canCreateOrganisationTool,
  canCreateOrganisationIssues,
  canEditOrganisationIssues,
  canDeleteOrEditOrganisationIssuesRemark,
};
