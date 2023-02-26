const express = require("express");
const router = express.Router();
const homeResolver = require("../resolvers/home");
const organisationUsersResolver = require("../resolvers/organisationUsers");
const organisationProfileResolver = require("../resolvers/organisationProfile");
const OrganisationBranchResolver = require("../resolvers/organisationBranch");
const uploadImage = require("../middleware/uploadImage");
const authMiddleware = require("../middleware/firebaseUserAuth");
const organisationContactResolver = require("../resolvers/organisationContact");
const truckResolver = require("../resolvers/trucks");
const driverResolver = require("../resolvers/driver");
const organisationpartnerResolver = require("../resolvers/organisationPartner");
const customerResolver = require("../resolvers/customer");
const tripResolver = require("../resolvers/trip");
const vendorAgentResolver = require("../resolvers/vendorAgent");


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
    uploadImage,
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

  router.post("/truck/create", uploadImage, truckResolver.createTruck);
  router.get("/trucks", authMiddleware, truckResolver.getTrucks);
  router.get("/truck", authMiddleware, truckResolver.getTruck);
  router.get("/truck/param", authMiddleware, truckResolver.getTruckByParam);
  router.get("/trucks/partner", authMiddleware, truckResolver.getPartnerTrucks);
  router.put(
    "/truck/edit",
    authMiddleware,
    uploadImage,
    truckResolver.editTruck
  );
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
    uploadImage,
    truckResolver.uploadTruckDoc
  );

  //Driver
  router.post("/driver/create", uploadImage, driverResolver.createDriver);
  router.get("/drivers", authMiddleware, driverResolver.getDrivers);
  router.get("/driver", authMiddleware, driverResolver.getDriver);
  router.get("/driver/param", authMiddleware, driverResolver.getDriverByParam);
  router.put(
    "/driver/edit",
    authMiddleware,
    uploadImage,
    driverResolver.editDriver
  );
  router.put("/driver/activate", authMiddleware, driverResolver.activateDriver);
  router.put("/driver/delete", authMiddleware, driverResolver.deleteDriver);
  router.put("/driver/restore", authMiddleware, driverResolver.restoreDriver);
  router.put(
    "/driver/uploadDriverDoc",
    authMiddleware,
    uploadImage,
    driverResolver.uploadDriverDoc
  );



  //OrganisationPartner
  router.post(
    "/organisationPartner/create",
    authMiddleware,
    uploadImage,
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
    uploadImage,
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
  router.post( "/vendorAgent/create", authMiddleware, vendorAgentResolver.createVendorAgent);
  router.get("/vendorAgents", authMiddleware, vendorAgentResolver.getAllVendorAgents);
  router.get("/vendorAgent", authMiddleware, vendorAgentResolver.getVendorAgent);
  router.get("/vendorAgent/remarks", authMiddleware, vendorAgentResolver.getVendorAgentRemarks);
  router.put("/vendorAgent/edit", authMiddleware, vendorAgentResolver.editVendorAgent);
  router.put("/vendorAgent/delete", authMiddleware, vendorAgentResolver.deleteVendorAgent);
  router.put("/vendorAgent/restore", authMiddleware, vendorAgentResolver.restoreVendorAgent);
  router.put("/vendorAgent/addRemark", authMiddleware, vendorAgentResolver.addVendorAgentRemark);
  router.put("/vendorAgent/deleteRemark", authMiddleware, vendorAgentResolver.deleteVendorAgentRemark);
  router.put("/vendorAgent/editRemark", authMiddleware, vendorAgentResolver.editVendorAgentRemark);


  //Trip
  router.post("/trip/create", authMiddleware, tripResolver.createTrip);
  router.get("/trips", authMiddleware, tripResolver.getTrips);
  router.get("/trip", authMiddleware, tripResolver.getTrip);
  router.get("/trip/remarks", authMiddleware, tripResolver.getTripRemarks);
  router.put("/trip/edit", authMiddleware, tripResolver.updateTrip);
  router.put("/trip/delete", authMiddleware, tripResolver.deleteTrips);
  router.put("/trip/restore", authMiddleware, tripResolver.restoreTrips);
  router.put("/trip/addRemark", authMiddleware, tripResolver.addTripRemark);
  router.put(
    "/trip/deleteRemark",
    authMiddleware,
    tripResolver.deleteTripRemark
  );
  router.put("/trip/editRemark", authMiddleware, tripResolver.editTripRemark);

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
