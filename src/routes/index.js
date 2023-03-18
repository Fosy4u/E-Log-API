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

let routes = (app) => {
  router.get("/", homeResolver.getHome);

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

  router.get("/user", organisationUsersResolver.getOrganisationUser);

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
  router.get("/trip", authMiddleware, tripResolver.getTrip);
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
  const handleMoreFieldsUploads = uploadMultiple.fields([
    { name: "documents", maxCount: 5 },
    { name: "pictures", maxCount: 5 },
  ]);
  router.post(
    "/expenses/create",
    authMiddleware,
    handleMoreFieldsUploads,
    expensesResolver.createExpenses
  );
  router.get( "/expenses", authMiddleware, expensesResolver.getExpenses);
  router.get( "/oneExpenses", authMiddleware, expensesResolver.getOneExpenses);
  router.get( "/expenses/remarks", authMiddleware, expensesResolver.getExpensesRemarks);
  router.get( "/expenses/logs", authMiddleware, expensesResolver.getExpensesLogs);
  router.put( "/expenses/edit", authMiddleware, expensesResolver.updateExpenses);
  router.put( "/expenses/delete", authMiddleware, expensesResolver.deleteExpenses);
  router.put( "/expenses/restore", authMiddleware, expensesResolver.restoreExpenses);
  router.put( "/expenses/addRemark", authMiddleware, expensesResolver.addExpensesRemark);
  router.put( "/expenses/deleteRemark", authMiddleware, expensesResolver.deleteExpensesRemark);
  router.put( "/expenses/editRemark", authMiddleware, expensesResolver.editExpensesRemark);
  router.put( "/expenses/uploads", authMiddleware, expensesResolver.uploadImages);
  router.put( "/expenses/deleteUploads", authMiddleware, expensesResolver.deleteExpensesImage);

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
  router.get(
    "/organisationContact/ContactRemark",
    authMiddleware,
    organisationContactResolver.getOrganisationContactRemark
  );
  router.get(
    "/organisationContact/ContactLogs",
    authMiddleware,
    organisationContactResolver.getOrganisationContactLogs
  );
  router.get(
    "/organisationContact/CustomerRanking",
    authMiddleware,
    organisationContactResolver.getOrganisationCustomerRanking
  );
  router.get(
    "/organisationContact/CustomerStatement",
    authMiddleware,
    organisationContactResolver.getCustomerStatement
  );
  router.put(
    "/organisationContact/editContact",
    authMiddleware,
    organisationContactResolver.editOrganisationContact
  );
  router.put(
    "/organisationContact/addRemark",
    authMiddleware,
    organisationContactResolver.addOrganisationContactRemark
  );
  router.put(
    "/organisationContact/deleteRemark",
    authMiddleware,
    organisationContactResolver.deleteOrganisationContactRemark
  );
  router.put(
    "/organisationContact/deleteContact",
    authMiddleware,
    organisationContactResolver.deleteOrganisationContact
  );
  router.put(
    "/organisationContact/restoreContact",
    authMiddleware,
    organisationContactResolver.restoreOrganisationContact
  );

  return app.use("/", router);
};

module.exports = routes;
