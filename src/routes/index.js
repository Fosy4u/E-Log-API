const express = require("express");
const router = express.Router();
const homeResolver = require("../resolvers/home");
const organisationUsersResolver = require("../resolvers/organisationUsers");
const organisationProfileResolver = require("../resolvers/organisationProfile");
const OrganisationBranchResolver = require("../resolvers/organisationBranch");
const { upload, uploadMultiple } = require("../middleware/uploadImage");
const authMiddleware = require("../middleware/firebaseUserAuth");
const organisationContactResolver = require("../resolvers/organisationContact");
const truckResolver = require("../resolvers/trucks");
const driverResolver = require("../resolvers/driver");
const organisationpartnerResolver = require("../resolvers/organisationPartner");
const customerResolver = require("../resolvers/customer");
const tripResolver = require("../resolvers/trip");
const vendorAgentResolver = require("../resolvers/vendorAgent");
const expensesResolver = require("../resolvers/expenses");
const templateResolver = require("../resolvers/template");
const paymentResolver = require("../resolvers/payment");
const invoiceResolver = require("../resolvers/invoice");
const tyreResolver = require("../resolvers/tyre");
const toolResolver = require("../resolvers/tool");
const tyreRepairResolver = require("../resolvers/tyreRepair");
const toolRepairResolver = require("../resolvers/toolRepair");
const reportResolver = require("../resolvers/report");
const docValidatorResolver = require("../resolvers/docValidator");
const sendEmailResolver = require("../resolvers/emailer");
const downloaderResolver = require("../resolvers/downloader");

const handleMoreFieldsUploads = uploadMultiple.fields([
  { name: "documents", maxCount: 5 },
  { name: "pictures", maxCount: 5 },
]);

let routes = (app) => {
  router.get("/", homeResolver.getHome);

  //Emailer
  router.post(
    "/emailer/sendEmail",
    authMiddleware,
    sendEmailResolver.sendEmail
  );
  router.post("/downloader", authMiddleware, downloaderResolver.downloadDoc);

  //DocValidator
  router.get("/francong/validateDoc", docValidatorResolver.getDoc);
  router.get(
    "/francong/validateDoc/nemfrancongokpatu2010api",
    docValidatorResolver.getDownloadDoc
  );

  //OgranisationProfile
  router.post(
    "/organisationProfile/create",
    organisationProfileResolver.createOrganisationProfile
  );
  router.get(
    "/organisationProfile",
    organisationProfileResolver.getOrganisationProfile
  );
  router.put(
    "/organisation/editOrganisation",
    upload,
    organisationProfileResolver.editOrganisationProfile
  );
  router.put(
    "/organisation/addOrganisationEmailSenders",
    organisationProfileResolver.addOrganisationEmailSenders
  );
  router.put(
    "/organisation/deleteOrganisationEmailSenders",
    organisationProfileResolver.deleteOrganisationEmailSenders
  );
  router.put(
    "/organisation/makeDefaultOrganisationEmailSenders",
    organisationProfileResolver.makeDefaultOrganisationEmailSenders
  );
  router.delete(
    "/organisation/deletionReason",
    organisationProfileResolver.deleteOrganisationProfileDeletionReason
  );

  router.get(
    "/organisation/bankDetails",
    authMiddleware,
    organisationProfileResolver.getBankDetails
  );
  router.post(
    "/organisation/bankDetails/update",
    authMiddleware,
    organisationProfileResolver.updateBankDetails
  );
  router.put(
    "/organisation/bankDetails/delete",
    authMiddleware,
    organisationProfileResolver.deleteBankDetails
  );

  router.get("/branches", authMiddleware, OrganisationBranchResolver.getBranch);
  router.post(
    "/branches/create",
    authMiddleware,
    OrganisationBranchResolver.createBranch
  );
  router.put(
    "/branch/add",
    authMiddleware,
    OrganisationBranchResolver.addBranch
  );
  router.put(
    "/branch/edit",
    authMiddleware,
    OrganisationBranchResolver.editBranch
  );
  router.put(
    "/branch/delete",
    authMiddleware,
    OrganisationBranchResolver.deleteBranch
  );

  router.post(
    "/user/create",
    authMiddleware,
    upload,
    organisationUsersResolver.createOrganisationUsers
  );
  router.get("/user", organisationUsersResolver.getOrganisationUser);
  router.get("/user/id", organisationUsersResolver.getOrganisationUserById);
  router.get("/users", organisationUsersResolver.getOrganisationUsers);
  router.get(
    "/users/personnels",
    organisationUsersResolver.getOrganisationPersonnels
  );
  router.put(
    "/user/edit",
    upload,
    organisationUsersResolver.updateOrganisationUser
  );
  router.put(
    "/user/userUnAssignments",
    upload,
    organisationUsersResolver.userUnAssignments
  );
  router.put(
    "/user/signIn",
    upload,
    organisationUsersResolver.recordUserSignIn
  );
  router.put(
    "/user/userAssignments",
    upload,
    organisationUsersResolver.userAssignments
  );
  router.put(
    "/user/delete",
    
    organisationUsersResolver.deleteOrganisationUser
  );
  router.put(
    "/user/restore",
    
    organisationUsersResolver.restoreOrganisationUser
  );
  router.put(
    "/user/upload",
    upload,
    organisationUsersResolver.uploadProfilePic
  );

  //Trucks

  router.post("/truck/create", upload, truckResolver.createTruck);
  router.get("/trucks", authMiddleware, truckResolver.getTrucks);
  router.get("/truck", authMiddleware, truckResolver.getTruck);
  router.get("/truck/param", authMiddleware, truckResolver.getTruckByParam);
  router.get("/trucks/partner", authMiddleware, truckResolver.getPartnerTrucks);
  router.get(
    "/trucks/available",
    authMiddleware,
    truckResolver.getAvailableTrucks
  );
  router.put("/truck/edit", authMiddleware, upload, truckResolver.editTruck);
  router.put("/truck/delete", authMiddleware, truckResolver.deleteTruck);
  router.put("/truck/restore", authMiddleware, truckResolver.restoreTruck);
  router.get("/truck/remarks", authMiddleware, truckResolver.getTruckRemarks);

  router.put("/truck/addRemark", authMiddleware, truckResolver.addTruckRemark);
  router.put(
    "/truck/deleteRemark",
    authMiddleware,
    truckResolver.deleteTruckRemark
  );
  router.put(
    "/truck/editRemark",
    authMiddleware,
    truckResolver.editTruckRemark
  );

  router.put(
    "/truck/assignTruckDriver",
    authMiddleware,
    truckResolver.assignTruckDriver
  );
  router.put(
    "/truck/assignTruckPartner",
    authMiddleware,
    truckResolver.assignPartnerTruck
  );
  router.put(
    "/truck/removeTruckPartner",
    authMiddleware,
    truckResolver.removePartnerTruck
  );
  router.put("/truck/activate", authMiddleware, truckResolver.activateTruck);
  router.put(
    "/truck/uploadTruckDoc",
    authMiddleware,
    upload,
    truckResolver.uploadTruckDoc
  );

  //Driver
  router.post("/driver/create", upload, driverResolver.createDriver);
  router.get("/drivers", authMiddleware, driverResolver.getDrivers);
  router.get("/driver", authMiddleware, driverResolver.getDriver);
  router.get("/driver/param", authMiddleware, driverResolver.getDriverByParam);
  router.put("/driver/edit", authMiddleware, upload, driverResolver.editDriver);
  router.put("/driver/activate", authMiddleware, driverResolver.activateDriver);
  router.put("/driver/delete", authMiddleware, driverResolver.deleteDriver);
  router.put("/driver/restore", authMiddleware, driverResolver.restoreDriver);
  router.put(
    "/driver/uploadDriverDoc",
    authMiddleware,
    upload,
    driverResolver.uploadDriverDoc
  );

  //OrganisationPartner
  router.post(
    "/organisationPartner/create",
    authMiddleware,
    upload,
    organisationpartnerResolver.createOrganisationPartner
  );
  router.get(
    "/organisationPartners",
    authMiddleware,
    organisationpartnerResolver.getAllOrganisationPartners
  );
  router.get(
    "/organisationPartner",
    authMiddleware,
    organisationpartnerResolver.getOrganisationPartner
  );
  router.get(
    "/organisationPartner/validate",
    authMiddleware,
    organisationpartnerResolver.validateOrganisationPartner
  );
  router.get(
    "/organisationPartner/remarks",
    authMiddleware,
    organisationpartnerResolver.getOrganisationPartnerRemarks
  );
  router.get(
    "/organisationPartner/logs",
    authMiddleware,
    organisationpartnerResolver.getOrganisationPartnerLogs
  );
  router.put(
    "/organisationPartner/edit",
    authMiddleware,
    upload,
    organisationpartnerResolver.editOrganisationPartner
  );
  router.put(
    "/organisationPartner/delete",
    authMiddleware,
    organisationpartnerResolver.deleteOrganisationPartner
  );
  router.put(
    "/organisationPartner/restore",
    authMiddleware,
    organisationpartnerResolver.restoreOrganisationPartner
  );
  router.put(
    "/organisationPartner/addRemark",
    authMiddleware,
    organisationpartnerResolver.addOrganisationPartnerRemark
  );
  router.put(
    "/organisationPartner/deleteRemark",
    authMiddleware,
    organisationpartnerResolver.deleteOrganisationPartnerRemark
  );
  router.put(
    "/organisationPartner/editRemark",
    authMiddleware,
    organisationpartnerResolver.editOrganisationPartnerRemark
  );

  //Customer
  router.post(
    "/customer/create",
    authMiddleware,
    customerResolver.createCustomer
  );
  router.get("/customers", authMiddleware, customerResolver.getAllCustomers);
  router.get("/customer", authMiddleware, customerResolver.getCustomer);
  router.get(
    "/customer/remarks",
    authMiddleware,
    customerResolver.getCustomerRemarks
  );
  router.get(
    "/customer/logs",
    authMiddleware,
    customerResolver.getCustomerLogs
  );
  router.put("/customer/edit", authMiddleware, customerResolver.editCustomer);
  router.put(
    "/customer/delete",
    authMiddleware,
    customerResolver.deleteCustomer
  );
  router.put(
    "/customer/restore",
    authMiddleware,
    customerResolver.restoreCustomer
  );
  router.put(
    "/customer/addRemark",
    authMiddleware,
    customerResolver.addCustomerRemark
  );
  router.put(
    "/customer/deleteRemark",
    authMiddleware,
    customerResolver.deleteCustomerRemark
  );
  router.put(
    "/customer/editRemark",
    authMiddleware,
    customerResolver.editCustomerRemark
  );

  //VendorAgent
  router.post(
    "/vendorAgent/create",
    authMiddleware,
    vendorAgentResolver.createVendorAgent
  );
  router.get(
    "/vendorAgents",
    authMiddleware,
    vendorAgentResolver.getAllVendorAgents
  );
  router.get(
    "/vendorAgent",
    authMiddleware,
    vendorAgentResolver.getVendorAgent
  );
  router.get(
    "/vendorAgent/remarks",
    authMiddleware,
    vendorAgentResolver.getVendorAgentRemarks
  );
  router.put(
    "/vendorAgent/edit",
    authMiddleware,
    vendorAgentResolver.editVendorAgent
  );
  router.put(
    "/vendorAgent/delete",
    authMiddleware,
    vendorAgentResolver.deleteVendorAgent
  );
  router.put(
    "/vendorAgent/restore",
    authMiddleware,
    vendorAgentResolver.restoreVendorAgent
  );
  router.put(
    "/vendorAgent/addRemark",
    authMiddleware,
    vendorAgentResolver.addVendorAgentRemark
  );
  router.put(
    "/vendorAgent/deleteRemark",
    authMiddleware,
    vendorAgentResolver.deleteVendorAgentRemark
  );
  router.put(
    "/vendorAgent/editRemark",
    authMiddleware,
    vendorAgentResolver.editVendorAgentRemark
  );

  //Trip
  router.post(
    "/trip/create",
    authMiddleware,

    tripResolver.createTrip
  );
  router.get("/trips", authMiddleware, tripResolver.getTrips);
  router.get("/trips/params", authMiddleware, tripResolver.getTripsByParams,);
  router.get(
    "/trips/vehicleId",
    authMiddleware,
    tripResolver.getTripsByVehicleId
  );
  router.get(
    "/trips/driverId",
    authMiddleware,
    tripResolver.getTripsByDriverId
  );
  router.get(
    "/trips/univoiced/unpaid",
    authMiddleware,
    tripResolver.unInvoicedUnpaidTrips
  );
  router.get("/trip", authMiddleware, tripResolver.getTrip);
  router.get(
    "/trip/requestId",
    authMiddleware,
    tripResolver.getTripByRequestId
  );
  router.get("/trip/remarks", authMiddleware, tripResolver.getTripRemarks);
  router.get("/trip/logs", authMiddleware, tripResolver.getTripLogs);
  router.put("/trip/edit", authMiddleware, tripResolver.updateTrip);
  router.put("/trip/delete", authMiddleware, tripResolver.deleteTrips);
  router.put("/trip/restore", authMiddleware, tripResolver.restoreTrips);
  router.put("/trip/addRemark", authMiddleware, tripResolver.addTripRemark);
  router.put("/trip/action", authMiddleware, tripResolver.tripAction);
  router.put(
    "/trip/waybil/upload",
    authMiddleware,
    upload,
    tripResolver.uploadWaybill
  );

  router.put(
    "/trip/deleteRemark",
    authMiddleware,
    tripResolver.deleteTripRemark
  );
  router.put("/trip/editRemark", authMiddleware, tripResolver.editTripRemark);

  //Expenses

  router.post(
    "/expenses/create",
    authMiddleware,
    handleMoreFieldsUploads,
    expensesResolver.createExpenses
  );
  router.get("/expenses", authMiddleware, expensesResolver.getExpenses);
  router.get("/oneExpenses", authMiddleware, expensesResolver.getOneExpenses);
  router.get(
    "/expenses/remarks",
    authMiddleware,
    expensesResolver.getExpensesRemarks
  );
  router.get(
    "/expenses/logs",
    authMiddleware,
    expensesResolver.getExpensesLogs
  );
  router.put(
    "/expenses/edit",
    authMiddleware,
    handleMoreFieldsUploads,
    expensesResolver.updateExpenses
  );
  router.put(
    "/expenses/delete",
    authMiddleware,
    expensesResolver.deleteExpenses
  );

  router.put(
    "/expenses/addRemark",
    authMiddleware,
    expensesResolver.addExpensesRemark
  );
  router.put(
    "/expenses/deleteRemark",
    authMiddleware,
    expensesResolver.deleteExpensesRemark
  );
  router.put(
    "/expenses/editRemark",
    authMiddleware,
    expensesResolver.editExpensesRemark
  );
  router.put(
    "/expenses/uploads",
    authMiddleware,
    handleMoreFieldsUploads,
    expensesResolver.uploadImages
  );
  router.put(
    "/expenses/deleteUploads",
    authMiddleware,
    expensesResolver.deleteExpensesImage
  );
  //Payment

  router.post(
    "/payment/create",
    authMiddleware,

    paymentResolver.createPayment
  );
  router.get("/payments", authMiddleware, paymentResolver.getPayments);
  router.get(
    "/payments/invoiceId",
    authMiddleware,
    paymentResolver.getPaymentsByInvoiceId
  );
  router.get(
    "/payments/invoiceIds",
    authMiddleware,
    paymentResolver.getInvoicesRecordedPayment
  );
  router.get("/payment", authMiddleware, paymentResolver.getPayment);
  router.get(
    "/payment/remarks",
    authMiddleware,
    paymentResolver.getPaymentRemarks
  );
  router.get("/payment/logs", authMiddleware, paymentResolver.getPaymentLogs);
  router.put(
    "/payment/edit",
    authMiddleware,

    paymentResolver.updatePayment
  );
  router.put("/payment/delete", authMiddleware, paymentResolver.deletePayments);

  router.put(
    "/payment/addRemark",
    authMiddleware,
    paymentResolver.addPaymentRemark
  );
  router.put(
    "/payment/deleteRemark",
    authMiddleware,
    paymentResolver.deletePaymentRemark
  );
  router.put(
    "/payment/editRemark",
    authMiddleware,
    paymentResolver.editPaymentRemark
  );
  router.put(
    "/payment/shareCode",
    authMiddleware,
    paymentResolver.getReceiptShareCode
  );

  //Invoice

  router.post(
    "/invoice/create",
    authMiddleware,

    invoiceResolver.createInvoice
  );
  router.get("/invoices", authMiddleware, invoiceResolver.getInvoices);
  router.get(
    "/invoices/unpaid",
    authMiddleware,
    invoiceResolver.getUnpaidInvoices
  );
  router.get("/invoice", authMiddleware, invoiceResolver.getInvoice);
  router.get(
    "/invoice/invoiceId",
    authMiddleware,
    invoiceResolver.getInvoiceByInvoiceId
  );
  router.get(
    "/invoice/remarks",
    authMiddleware,
    invoiceResolver.getInvoiceRemarks
  );
  router.get("/invoice/logs", authMiddleware, invoiceResolver.getInvoiceLogs);
  router.put(
    "/invoice/edit",
    authMiddleware,

    invoiceResolver.updateInvoice
  );
  router.put(
    "/invoice/markAsSent",
    authMiddleware,

    invoiceResolver.markInvoiceAsSent
  );
  router.put("/invoice/delete", authMiddleware, invoiceResolver.deleteInvoices);

  router.put(
    "/invoice/addRemark",
    authMiddleware,
    invoiceResolver.addInvoiceRemark
  );
  router.put(
    "/invoice/deleteRemark",
    authMiddleware,
    invoiceResolver.deleteInvoiceRemark
  );
  router.put(
    "/invoice/editRemark",
    authMiddleware,
    invoiceResolver.editInvoiceRemark
  );
  router.put(
    "/invoice/shareCode",
    authMiddleware,
    invoiceResolver.getInvoiceShareCode
  );

  //Tyre
  router.post("/tyre/create", authMiddleware, tyreResolver.createTyre);
  router.post(
    "/tyres/inspection/record",
    authMiddleware,
    tyreResolver.recordTyreInspection
  );
  router.get("/tyres", authMiddleware, tyreResolver.getTyres);
  router.get("/tyres/params", authMiddleware, tyreResolver.getTyresByParams);
  router.get(
    "/tyres/vehicleId",
    authMiddleware,
    tyreResolver.getTyresByVehicleId
  );
  router.get(
    "/tyres/inspection/vehicleId",
    authMiddleware,
    tyreResolver.getTyreInspectionByVehicleId
  );
  router.get(
    "/tyres/inspections/",
    authMiddleware,
    tyreResolver.getTyreInspections
  );
  router.get(
    "/tyres/inspections/params",
    authMiddleware,
    tyreResolver.getTyreInspectionsByParams
  );
  router.get(
    "/tyres/inspection/",
    authMiddleware,
    tyreResolver.getTyreInspection
  );
  router.get("/tyre", authMiddleware, tyreResolver.getTyre);
  router.get("/tyre/remarks", authMiddleware, tyreResolver.getTyreRemarks);
  router.get("/tyre/logs", authMiddleware, tyreResolver.getTyreLogs);
  router.put("/tyre/edit", authMiddleware, tyreResolver.updateTyre);
  router.put(
    "/tyre/inspection/edit",
    authMiddleware,
    tyreResolver.updateTyreInspection
  );
  router.put("/tyre/delete", authMiddleware, tyreResolver.deleteTyres);
  router.put(
    "/tyre/inspections/delete",
    authMiddleware,
    tyreResolver.deleteTyreInspections
  );
  router.put("/tyre/restore", authMiddleware, tyreResolver.restoreTyres);
  router.put(
    "/tyre/inspections/restore",
    authMiddleware,
    tyreResolver.restoreTyreInspections
  );
  router.put("/tyre/addRemark", authMiddleware, tyreResolver.addTyreRemark);
  router.put(
    "/tyre/deleteRemark",
    authMiddleware,
    tyreResolver.deleteTyreRemark
  );
  router.put("/tyre/editRemark", authMiddleware, tyreResolver.editTyreRemark);

  //TyreRepair
  router.post(
    "/tyreRepair/create",
    authMiddleware,
    tyreRepairResolver.createTyreRepair
  );
  router.get("/tyreRepairs", authMiddleware, tyreRepairResolver.getTyreRepairs);
  router.get(
    "/tyreRepairs/tyre",
    authMiddleware,
    tyreRepairResolver.getTyreRepairsByTyre
  );
  router.get(
    "/tyreRepairs/vehicleId",
    authMiddleware,
    tyreRepairResolver.getTyreRepairsByVehicleID
  );
  router.get("/tyreRepair", authMiddleware, tyreRepairResolver.getTyreRepair);
  router.put(
    "/tyreRepair/edit",
    authMiddleware,
    tyreRepairResolver.updateTyreRepair
  );
  router.delete(
    "/tyreRepair/delete",
    authMiddleware,
    tyreRepairResolver.deleteTyreRepair
  );
  //ToolRepair
  router.post(
    "/toolRepair/create",
    authMiddleware,
    toolRepairResolver.createToolRepair
  );
  router.get("/toolRepairs", authMiddleware, toolRepairResolver.getToolRepairs);
  router.get(
    "/toolRepairs/tool",
    authMiddleware,
    toolRepairResolver.getToolRepairsByTool
  );
  router.get(
    "/toolRepairs/vehicleId",
    authMiddleware,
    toolRepairResolver.getToolRepairsByVehicleID
  );
  router.get("/toolRepair", authMiddleware, toolRepairResolver.getToolRepair);
  router.put(
    "/toolRepair/edit",
    authMiddleware,
    toolRepairResolver.updateToolRepair
  );
  router.delete(
    "/toolRepair/delete",
    authMiddleware,
    toolRepairResolver.deleteToolRepair
  );

  //Tool
  router.post(
    "/tool/create",
    authMiddleware,
    handleMoreFieldsUploads,
    toolResolver.createTool
  );
  router.post(
    "/tool/uploads",
    authMiddleware,
    handleMoreFieldsUploads,
    toolResolver.uploadToolImages
  );
  router.get("/tools", authMiddleware, toolResolver.getTools);
  router.get("/tools/params", authMiddleware, toolResolver.getToolsByParams);
  router.get(
    "/tools/vehicleId",
    authMiddleware,
    toolResolver.getToolsByVehicleId
  );
  router.get(
    "/tools/inspection/vehicleId",
    authMiddleware,
    toolResolver.getToolInspectionByVehicleId
  );
  router.get(
    "/tools/inspections/",
    authMiddleware,
    toolResolver.getToolInspections
  );
  router.get(
    "/tools/inspection/",
    authMiddleware,
    toolResolver.getToolInspection
  );
  router.get("/tool", authMiddleware, toolResolver.getTool);
  router.get("/tool/expenses", authMiddleware, toolResolver.getToolExpenses);
  router.get("/tool/remarks", authMiddleware, toolResolver.getToolRemarks);
  router.get("/tool/logs", authMiddleware, toolResolver.getToolLogs);
  router.put(
    "/tool/edit",
    authMiddleware,
    handleMoreFieldsUploads,
    toolResolver.updateTool
  );
  router.put(
    "/tool/image/delete",
    authMiddleware,
    toolResolver.deleteToolImage
  );
  router.put(
    "/tool/linkToExpenses",
    authMiddleware,

    toolResolver.linkToolToExpenses
  );
  router.put(
    "/tool/unlinkToExpenses",
    authMiddleware,

    toolResolver.unlinkToolToExpenses
  );
  router.put(
    "/tool/inspection/edit",
    authMiddleware,
    toolResolver.updateToolInspection
  );
  router.put("/tool/delete", authMiddleware, toolResolver.deleteTools);
  router.put(
    "/tool/inspections/delete",
    authMiddleware,
    toolResolver.deleteToolInspections
  );
  router.put("/tool/restore", authMiddleware, toolResolver.restoreTools);
  router.put(
    "/tool/inspections/restore",
    authMiddleware,
    toolResolver.restoreToolInspections
  );
  router.put("/tool/addRemark", authMiddleware, toolResolver.addToolRemark);
  router.put(
    "/tool/deleteRemark",
    authMiddleware,
    toolResolver.deleteToolRemark
  );
  router.put("/tool/editRemark", authMiddleware, toolResolver.editToolRemark);

  //Template
  router.get("/template", templateResolver.getTemplate);
  router.put("/template/addTyreBrand", templateResolver.addTyreBrand);
  router.put("/template/deleteTyreBrand", templateResolver.deleteTyreBrand);
  router.put("/template/editTyreBrand", templateResolver.editTyreBrand);
  router.put("/template/addTyreSize", templateResolver.addTyreSize);
  router.put("/template/deleteTyreSize", templateResolver.deleteTyreSize);
  router.put("/template/editTyreSize", templateResolver.editTyreSize);
  router.put("/template/addEmailTemplate", templateResolver.addEmailTemplate);
  router.put(
    "/template/deleteEmailTemplate",
    templateResolver.deleteEmailTemplate
  );
  router.put("/template/editEmailTemplate", templateResolver.editEmailTemplate);

  //report
  router.get(
    "/report/lastUpdate",
    authMiddleware,
    reportResolver.getLastUpdated
  );
  router.get(
    "/report/allProfitAndLoss/",
    authMiddleware,
    reportResolver.getAllProfitAndLoss
  );
  router.get(
    "/report/profitAndLossByTrip/",
    authMiddleware,
    reportResolver.getProfitAndLossByTrip
  );
  router.get(
    "/report/profitAndLossMostRecentByTrip/",
    authMiddleware,
    reportResolver.getMostRecentProfitAndLossByTrip
  );
  router.get(
    "/report/profitAndLossByVehicle/",
    authMiddleware,
    reportResolver.getProfitAndLossByVehicle
  );
  router.get(
    "/report/allExpenses/",
    authMiddleware,
    reportResolver.getAllExpenses
  );
  router.get(
    "/report/expensesByTrip/",
    authMiddleware,
    reportResolver.getAllExpensesByTrip
  );
  router.get(
    "/report/expensesByVehicle/",
    authMiddleware,
    reportResolver.getAllExpensesByVehicle
  );
  router.get(
    "/report/nonTripExpenses/",
    authMiddleware,
    reportResolver.getNonTripExpenses
  );
  router.get(
    "/report/payments/",
    authMiddleware,
    reportResolver.getAllPayments
  );
  router.get(
    "/report/paymentsByTrip/",
    authMiddleware,
    reportResolver.getPaymentsByTrip
  );
  router.get(
    "/report/paymentsByRequesters/",
    authMiddleware,
    reportResolver.getPaymentsByRequesters
  );
  router.get(
    "/report/paymentsByNonTrip/",
    authMiddleware,
    reportResolver.getPaymentsByNonTrip
  );
  router.get(
    "/report/tripsByTripProviders/",
    authMiddleware,
    reportResolver.getTopTripProviders
  );
  router.get(
    "/report/analyticsByVehicleID/",
    authMiddleware,
    reportResolver.getAnalyticsByVehicleID
  );
  router.get(
    "/report/analyticsByDriverID/",
    authMiddleware,
    reportResolver.getAnalyticsByDriverID
  );
  router.get(
    "/report/analyticsByTripID/",
    authMiddleware,
    reportResolver.getAnalyticsByTripID
  );

  //OrganisationContact
  router.post(
    "/organisationContact/create",
    authMiddleware,
    organisationContactResolver.createOrganisationContact
  );
  router.get(
    "/organisationContacts",
    authMiddleware,
    organisationContactResolver.getAllOrganisationContacts
  );
  router.get(
    "/organisationContact/Contact",
    authMiddleware,
    organisationContactResolver.getOrganisationContact
  );
  router.put(
    "/organisationContact/editContact",
    authMiddleware,
    organisationContactResolver.editOrganisationContact
  );
  router.delete(
    "/organisationContact/deleteContact",
    authMiddleware,
    organisationContactResolver.deleteOrganisationContact
  );

  return app.use("/", router);
};

module.exports = routes;
