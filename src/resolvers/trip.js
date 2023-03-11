const mongoose = require("mongoose");
const TripModel = require("../models/trip");
const TruckModel = require("../models/truck");
const VendorAgentModel = require("../models/vendorAgent");
const CustomerModel = require("../models/customer");
const OrganisationPartnerModel = require("../models/organisationPartner");
const OrganisationProfileModel = require("../models/organisationProfile");
const {
  canDeleteOrEditOrganisationTripRemark,
  canEditOrganisationTrip,
} = require("../helpers/actionPermission");
const {
  verifyUserId,
  verifyVehicleId,
  verifyVendorAgentId,
} = require("../helpers/verifyValidity");
const path = require("path");
const root = require("../../root");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const { storageRef } = require("../config/firebase"); // reference to our db

//saving image to firebase storage
const addImage = async (req, filename) => {
  let url = {};
  if (filename) {
    const source = path.join(root + "/uploads/" + filename);
    await sharp(source)
      .resize(1024, 1024)
      .jpeg({ quality: 90 })
      .toFile(path.resolve(req.file.destination, "resized", filename));
    const storage = await storageRef.upload(
      path.resolve(req.file.destination, "resized", filename),
      {
        public: true,
        destination: `/partner/${filename}`,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4(),
        },
      }
    );
    url = { link: storage[0].metadata.mediaLink, name: filename };
    return url;
  }
  return url;
};
const deleteImageFromFirebase = async (name) => {
  if (name) {
    storageRef
      .file("/partner/" + name)
      .delete()
      .then(() => {
        return true;
      })
      .catch((err) => {
        return false;
      });
  }
};
const getPartnerTitle = (partner) => {
  if (!partner) return null;
  if (partner?.companyName) return partner?.companyName;

  return `${partner?.firstName} ${partner?.lastName}`;
};

const attachPartnerToVehicle = async (vehicles, organisationId) => {
  const organisation = await OrganisationProfileModel.findOne(
    {
      _id: organisationId,
    },
    { name: 1 }
  );
  console.log("org", organisation);

  const partnerIds = vehicles.map((vehicle) => vehicle.assignedPartnerId);
  const partners = await OrganisationPartnerModel.find({
    _id: { $in: partnerIds },
  }).lean();
  const partnerMap = {};
  partners.forEach((partner) => {
    partnerMap[partner._id] = partner;
  });
  return vehicles.map((vehicle) => {
    return {
      ...vehicle,
      transporter:
        getPartnerTitle(partnerMap[vehicle.assignedPartnerId]) ||
        organisation?.name ||
        null,
    };
  });
};
const attachVehicle = async (trips, organisationId) => {
  const vehicleIds = trips.map((trip) => trip.vehicleId);
  const vehicles = await TruckModel.find(
    {
      _id: { $in: vehicleIds },
    },
    { assignedPartnerId: 1, regNo: 1 }
  ).lean();
  const attachPartners = await attachPartnerToVehicle(vehicles, organisationId);
  const vehicleMap = {};
  attachPartners.forEach((vehicle) => {
    vehicleMap[vehicle._id] = vehicle;
  });
  return trips.map((trip) => {
    return {
      ...trip,
      vehicle: vehicleMap[trip.vehicleId] || null,
    };
  });
};

const getTrip = async (req, res) => {
  try {
    const { _id, organisationId } = req.query;
    if (!_id) return res.status(400).send({ error: "trip _id is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    const trip = await TripModel.findOne({ _id, organisationId }).lean();
    if (!trip) return res.status(400).send({ error: "trip not found" });
    const tripsWithVehicle = await attachVehicle([trip], organisationId);
    return res.status(200).send({ data: tripsWithVehicle[0] });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getTrips = async (req, res) => {
  try {
    const { organisationId, disabled } = req.query;
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    const trips = await TripModel.find(
      {
        organisationId,
        disabled: disabled || false,
      },
      { remarks: 0, logs: 0, timeline: 0 }
    ).lean();
    const tripsWithVehicle = await attachVehicle(trips, organisationId);
    return res.status(200).send({ data: tripsWithVehicle });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniqueCode = async (organisationId) => {
  let code;
  let found = true;

  do {
    const randomVal = getRandomInt(1000000, 9999999);
    code = `${randomVal}`;
    const exist = await TripModel.findOne(
      {
        organisationId,
        requestId: code,
      },
      { lean: true }
    );

    if (exist || exist !== null) {
      found = true;
    } else {
      found = false;
    }
  } while (found);

  return code.toString();
};

const createTrip = async (req, res) => {
  const {
    organisationId,
    userId,
    remark,

    productName,
    customerId,
    pickupAddress,
    pickupDate,
    dropOffAddress,
    estimatedDropOffDate,
    price,
    vendorId,
    isVendorRequested,
  } = req.body;
  try {
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });

    if (!userId) return res.status(400).send({ error: "userId is required" });

    if (!productName)
      return res.status(400).send({ error: "productName is required" });
    if (!customerId)
      return res.status(400).send({ error: "customerId is required" });
    if (!pickupAddress)
      return res.status(400).send({ error: "pickupAddress is required" });
    if (!pickupDate)
      return res.status(400).send({ error: "pickupDate is required" });
    if (!dropOffAddress)
      return res.status(400).send({ error: "dropOffAddress is required" });

    if (!price) return res.status(400).send({ error: "price is required" });
    if (isVendorRequested && !vendorId)
      return res.status(400).send({ error: "vendorId is required" });

    const log = {
      date: new Date(),
      userId: userId,
      action: "create",
      details: `trip created`,
      reason: `accepted customer request`,
    };

    const validUserId = await verifyUserId(userId, organisationId);

    if (!validUserId) {
      return res
        .status(400)
        .send({ error: "userId is invalid for this organisation" });
    }
    if (vendorId) {
      const validVendorId = await verifyVendorAgentId(vendorId, organisationId);

      if (!validVendorId) {
        return res
          .status(400)
          .send({ error: "vendorId is invalid for this organisation" });
      }
    }

    const requestId = await generateUniqueCode(organisationId);

    let remarks = [];

    if (remark) {
      remarks.push({
        remark,
        userId,
        date: new Date(),
      });
    }
    const timeline = [
      {
        date: new Date(),
        userId: userId,
        action: "created",
        status: "done",
      },
    ];

    const params = {
      ...req.body,
      remarks,
      requestId,
      timeline,
      logs: [log],
    };

    const createTrip = new TripModel({ ...params });
    const newTrip = await createTrip.save();
    // if (newTrip) {
    //   const updateVehicle = await TruckModel.findByIdAndUpdate(
    //     vehicleId,
    //     {
    //       status: "on trip",
    //     },
    //     { new: true }
    //   );
    //   return res.status(200).send({ message: "Trip created", data: newTrip });
    // }
    return res.status(200).send({ message: "Trip created", data: newTrip });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getName = (contact) => {
  if (contact?.companyName) return contact?.companyName;

  return `${contact?.firstName} ${contact?.lastName}`;
};

const updateTrip = async (req, res) => {
  try {
    const { _id, organisationId, userId, vendorId } = req.body;
    if (!_id) return res.status(400).send({ error: "trip _id is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });

    const validUserId = await verifyUserId(userId, organisationId);
    if (!validUserId) {
      return res
        .status(400)
        .send({ error: "userId is invalid for this organisation" });
    }

    const permitted = await canEditOrganisationTrip({ tripId: _id, userId });
    if (!permitted) {
      return res.status(400).send({ error: "you cannot edit this trip" });
    }

    if (req?.body?.vehicleId) {
      const vehicle = await TruckModel.findOne({
        _id: req?.body?.vehicleId,
        organisationId,
        disabled: false,
      }).lean();
      if (!vehicle) return res.status(400).send({ error: "vehicle not found" });
      if (vehicle.status !== "Available")
        return res.status(400).send({ error: "vehicle not available" });
    }

    if (vendorId) {
      const validVendorId = await verifyVendorAgentId(vendorId, organisationId);
      if (!validVendorId) {
        return res
          .status(400)
          .send({ error: "vendorId is invalid for this organisation" });
      }
    }

    const currentTrip = TripModel.findOne({ _id, organisationId }).lean();
    if (!currentTrip) return res.status(400).send({ error: "trip not found" });

    const difference = [];
    const oldData = currentTrip;
    const newData = req.body;
    for (const key in newData) {
      if (
        oldData[key] !== newData[key] &&
        key !== "_id" &&
        key !== "logs" &&
        key !== "createdAt" &&
        key !== "updatedAt" &&
        key !== "__v" &&
        key !== "disabled" &&
        key !== "organisationId" &&
        key !== "requestId" &&
        key !== "remarks" &&
        key !== "userId" &&
        key !== "customerId" &&
        key !== "vendorId" &&
        key !== "vehicleId"
      ) {
        difference.push({
          field: key,
          old: oldData[key] || "not provided",
          new: newData[key],
        });
      }
    }
    if (req.body?.customerId && req.body?.customerId !== oldData?.customerId) {
      const oldCustomer = await CustomerModel.findOne({
        _id: oldData?.customerId,
        organisationId,
      });
      const newCustomer = await CustomerModel.findOne({
        _id: req.body?.customerId,
        organisationId,
      });
      difference.push({
        field: "customer",
        old: getName(oldCustomer) || "not provided",
        new: getName(newCustomer),
      });
    }
    if (req.body?.vendorId && req.body?.vendorId !== oldData?.vendorId) {
      const oldVendor = await VendorAgentModel.findOne({
        _id: oldData?.vendorId,
        organisationId,
      });
      const newVendor = await VendorAgentModel.findOne({
        _id: req.body?.vendorId,
        organisationId,
      });
      difference.push({
        field: "vendor",
        old: getName(oldVendor) || "not provided",
        new: getName(newVendor),
      });
    }
    if (req.body?.customerId && req.body?.customerId !== oldData?.customerId) {
      const oldCustomer = await CustomerModel.findOne({
        _id: oldData?.customerId,
        organisationId,
      });
      const newCustomer = await CustomerModel.findOne({
        _id: req.body?.customerId,
        organisationId,
      });
      difference.push({
        field: "customer",
        old: getName(oldCustomer) || "not provided",
        new: getName(newCustomer),
      });
    }

    if (req.body?.vehicleId && req.body?.vehicleId !== oldData?.vehicleId) {
      const oldVehicle = await VehicleModel.findOne({
        _id: oldData?.vehicleId,
        organisationId,
      });
      const newVehicle = await VehicleModel.findOne({
        _id: req.body?.vehicleId,
        organisationId,
      });
      difference.push({
        field: "vehicle",
        old: oldVehicle?.regNo || "not provided",
        new: newVehicle?.regNo,
      });
    }

    const log = {
      date: new Date(),
      userId: userId,
      action: "edit",
      details: `trip updated`,
      reason: `updated trip`,
      difference,
    };
    const updateTrip = await TripModel.findByIdAndUpdate(
      _id,
      { ...req.body, $push: { logs: log } },
      { new: true }
    );
    if (updateTrip) {
      if (req.body?.vehicleId && req.body?.vehicleId !== oldData?.vehicleId) {
        const updateOldVehicle = await TruckModel.findByIdAndUpdate(
          oldData?.vehicleId,
          {
            status: "Available",
          },
          { new: true }
        );
        const updateNewVehicle = await TruckModel.findByIdAndUpdate(
          req.body?.vehicleId,
          {
            status: "on trip",
          },
          { new: true }
        );
      }
      return res
        .status(200)
        .send({ message: "Trip updated", data: updateTrip });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const validateTrips = async (ids) => {
  const invalidTrip = await ids.reduce(async (acc, _id) => {
    let invalid = await acc;

    const found = await TripModel.findById(_id).lean();

    if (!found) {
      invalid.push(_id);
    }

    return invalid;
  }, []);

  return invalidTrip;
};

const deleteRestoreTrips = async (trips, userId, disabledValue) => {
  return trips.reduce(async (acc, _id) => {
    const result = await acc;

    const disabled = await TripModel.findByIdAndUpdate(
      _id,
      { disabled: disabledValue },
      { new: true }
    );

    if (disabled) {
      const log = {
        date: new Date(),
        userId: userId,
        action: disabledValue ? "delete" : "restore",
        details: `trip - ${disabled.firstName} ${disabled.lastName} ${
          disabledValue ? "deleted" : "restored"
        }`,
        reason: `${disabledValue ? "deleted" : "restored"} trip`,
      };
      const timeline = disabled?.timeline?.filter(
        (item) => item?.action === "created"
      );

      const updateLog = await TripModel.findByIdAndUpdate(
        disabled._id,

        {
          $push: { logs: log },
          $set: {
            timeline: timeline,
            status: disabledValue ? "Deleted" : "Pending",
          },
          $unset: { vehicleId: 1 },
        },
        { new: true }
      );
      if (
        updateLog &&
        disabled?.vehicleId &&
        disabled?.status.toLowerCase() !== "delivered"
      ) {
        const updateVehicle = await TruckModel.findByIdAndUpdate(
          disabled?.vehicleId,
          {
            status: "Available",
          },
          { new: true }
        );
      }
      result.push(_id);
    }

    return result;
  }, []);
};

const deleteTrips = async (req, res) => {
  try {
    const { ids, userId } = req.body;
    if (!ids || ids.length === 0)
      return res.status(400).send({ error: "no trip id provided" });
    const invalidTrips = await validateTrips(ids);
    if (invalidTrips.length > 0) {
      return res.status(400).send({
        error: `request failed as the following trips(s)  ${
          invalidTrips.length > 1 ? " do" : " does"
        } not exist. Please contact NemFraTech support if this error persist unexpectedly : [${invalidTrips}]`,
      });
    }
    const disabledValue = true;
    const disabledTrips = await deleteRestoreTrips(ids, userId, disabledValue);
    if (disabledTrips.length > 0) {
      return res.status(200).send({
        message: "trip deleted successfully",
        data: disabledTrips,
      });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const restoreTrips = async (req, res) => {
  try {
    const { ids, userId } = req.body;
    const invalidTrips = await validateTrips(ids);
    if (invalidTrips.length > 0) {
      return res.status(400).send({
        error: `request failed as the following trips(s)  ${
          invalidTrips.length > 1 ? " do" : " does"
        } not exist. Please contact NemFraTech support if this error persist unexpectedly : [${invalidTrips}]`,
      });
    }
    const disabledValue = false;
    const restoredTrips = await deleteRestoreTrips(ids, userId, disabledValue);
    if (restoredTrips.length > 0) {
      return res.status(200).send({
        message: "trip deleted successfully",
        data: restoredTrips,
      });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getTripLogs = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "trip _id is required" });
    const trip = await TripModel.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(_id),
        },
      },

      { $unwind: "$logs" },
      {
        $sort: { "logs.date": -1 },
      },
      {
        $lookup: {
          from: "organisationUsers",
          let: {
            searchId: { $toObjectId: "$logs.userId" },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$searchId"],
                },
              },
            },
          ],
          as: "user",
        },
      },
      {
        $project: {
          logs: {
            $mergeObjects: [
              "$logs",
              {
                user: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$user",
                        as: "contact",
                        cond: {
                          $eq: [
                            "$$contact._id",
                            { $toObjectId: "$logs.userId" },
                          ],
                        },
                      },
                    },
                    0,
                  ],
                },
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          logs: { $push: "$logs" },
        },
      },
    ]);

    const logs = trip[0]?.logs;
    if (!logs || logs?.length === 0) return res.status(200).send({ data: [] });

    return res.status(200).send({
      data: logs,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const addTripRemark = async (req, res) => {
  try {
    const { _id, remarkObj } = req.body;

    const { remark, userId } = remarkObj;

    if (!_id) return res.status(400).send({ error: "trip_id is required" });
    if (!remark) return res.status(400).send({ error: "empty remark " });

    if (!userId)
      return res.status(400).send({ error: "current userId is required " });
    const trip = await TripModel.findById({ _id });
    if (!trip) return res.status(400).send({ error: "trip not found" });
    remarkObj.date = new Date();
    const updateRemark = await TripModel.findByIdAndUpdate(
      {
        _id,
      },
      {
        $push: {
          remarks: remarkObj,
        },
      },
      { new: true }
    );
    const log = {
      date: new Date(),
      userId,
      action: "remark",
      reason: "added remark",
      details: `added remark on trip - ${trip.requestId}`,
    };
    const updateTrip = await CustomerModel.findByIdAndUpdate(
      { _id },
      { $push: { logs: log } },
      { new: true }
    );
    return res
      .status(200)
      .send({ message: "remark added successfully", data: updateRemark });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const deleteTripRemark = async (req, res) => {
  try {
    const { tripId, remarkId, userId } = req.body;
    if (!tripId) return res.status(400).send({ error: "tripId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });

    const trip = await TripModel.findById({
      _id: tripId,
    });
    if (!trip) return res.status(400).send({ error: "trip not found" });
    const param = { tripId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationTripRemark(param);
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to delete this remark" });
    const log = {
      date: new Date(),
      userId,
      action: "delete",
      reason: "deleted remark",
      details: `deleted remark on trip`,
    };

    const updateRemark = await TripModel.findByIdAndUpdate(
      {
        _id: tripId,
      },
      {
        $pull: {
          remarks: { _id: remarkId },
        },
        $push: { logs: log },
      },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const editTripRemark = async (req, res) => {
  try {
    const { tripId, remarkId, userId, remark } = req.body;
    if (!tripId) return res.status(400).send({ error: "tripId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });
    if (!remark) return res.status(400).send({ error: "remark is required" });

    const trip = await TripModel.findById({
      _id: tripId,
    });
    if (!trip) return res.status(400).send({ error: "trip not found" });
    const param = { tripId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationTripRemark(param);
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to edit this remark" });

    const updateRemark = await TripModel.updateOne(
      {
        _id: tripId,
        remarks: { $elemMatch: { _id: remarkId } },
      },

      {
        $set: {
          "remarks.$.remark": remark,
        },
      },
      { new: true }
    );
    const log = {
      date: new Date(),
      userId,
      action: "edit",
      reason: "edited remark",
      details: `edited remark on trip`,
    };
    const updateTrip = await CustomerModel.findByIdAndUpdate(
      { _id: tripId },
      { $push: { logs: log } },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const getTripRemarks = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "trip _id is required" });
    const trip = await TripModel.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(_id),
        },
      },

      { $unwind: "$remarks" },
      {
        $sort: { "remarks.date": -1 },
      },
      {
        $lookup: {
          from: "organisationUsers",
          let: {
            searchId: { $toObjectId: "$remarks.userId" },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$searchId"],
                },
              },
            },
          ],
          as: "user",
        },
      },
      {
        $project: {
          remarks: {
            $mergeObjects: [
              "$remarks",
              {
                user: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$user",
                        as: "contact",
                        cond: {
                          $eq: [
                            "$$contact._id",
                            { $toObjectId: "$remarks.userId" },
                          ],
                        },
                      },
                    },
                    0,
                  ],
                },
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          remarks: { $push: "$remarks" },
        },
      },
    ]);

    const remarks = trip[0]?.remarks;

    if (!remarks || remarks?.length === 0) return res.status(200).send([]);

    return res.status(200).send({
      data: remarks,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const uploadWaybill = async (req, res) => {
  try {
    if (!req.file) return res.status(400).send({ error: "file is required" });
    const { _id, userId, field } = req.body;
    if (!_id) return res.status(400).send({ error: "tripId is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    if (!field) return res.status(400).send({ error: "field is required" });
    if (
      field !== "deliveredWaybilImageUrl" &&
      field !== "requestedWaybilImageUrl"
    )
      return res.status(400).send({ error: "field is invalid" });
    const permitted = await canEditOrganisationTrip({ tripId: _id, userId });
    if (!permitted) {
      return res.status(400).send({ error: "you cannot edit this trip" });
    }
    const trip = await TripModel.findById({ _id });
    if (!trip) return res.status(400).send({ error: "trip not found" });
    let oldImageName;
    const filename = req.file.filename;
    const imageUrl = await addImage(req, filename);
    let updateTrip;
    let log;
    const difference = [];
    if (field === "deliveredWaybilImageUrl") {
      difference.push({
        field: "delivered Waybil",
        oldValue: trip.deliveredWaybilImageUrl?.name,
        newValue: imageUrl?.name,
      });
      log = {
        date: new Date(),
        userId,
        action: "edit",
        reason: "uploaded delivered waybill",
        details: `uploaded delivered waybill on trip`,
        difference,
      };
      oldImageName = trip?.deliveredWaybilImageUrl?.name;
      updateTrip = await TripModel.findByIdAndUpdate(
        { _id },
        { deliveredWaybilImageUrl: imageUrl, $push: { logs: log } },
        { new: true }
      );
      if (!updateTrip)
        return res.status(400).send({ error: "error in waybill upload" });
      if (oldImageName !== imageUrl?.name)
        await deleteImageFromFirebase(oldImageName);
      return res.status(200).send({ data: updateTrip });
    }
    if (field === "requestedWaybilImageUrl") {
      difference.push({
        field: "request Waybil",
        oldValue: trip.requestedWaybilImageUrl?.name,
        newValue: imageUrl?.name,
      });
      log = {
        date: new Date(),
        userId,
        action: "edit",
        reason: "uploaded request waybill",
        details: `uploaded request waybill on trip`,
        difference,
      };
      oldImageName = trip?.requestedWaybilImageUrl?.name;
      updateTrip = await TripModel.findByIdAndUpdate(
        { _id },
        { requestedWaybilImageUrl: imageUrl, $push: { logs: log } },
        { new: true }
      );
      if (!updateTrip)
        return res.status(400).send({ error: "error in waybill upload" });
      if (oldImageName !== imageUrl?.name)
        await deleteImageFromFirebase(oldImageName);
      return res.status(200).send({ data: updateTrip });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const tripAction = async (req, res) => {
  try {
    const {
      tripId,
      vehicleId,
      userId,
      action,
      cancelReason,
      resumeReason,
      actualFuelCost,
      actualFuelLitres,
    } = req.body;

    if (!tripId) return res.status(400).send({ error: "tripId is required" });
    if (!userId) return res.status(400).send({ error: "userId is required" });
    if (!action) return res.status(400).send({ error: "action is required" });
    const permitted = await canEditOrganisationTrip({ tripId, userId });
    if (!permitted) {
      return res.status(400).send({ error: "you cannot edit this trip" });
    }
    const trip = await TripModel.findById({ _id: tripId });
    if (!trip) return res.status(400).send({ error: "trip not found" });
    let timelineAction;
    let log;

    if (action === "assign vehicle") {
      if (!vehicleId)
        return res.status(400).send({ error: "vehicleId is required" });
      const availableVehicle = await TruckModel.findOne({
        _id: vehicleId,
        status: "Available",
      });

      if (!availableVehicle && trip?.vehicleId !== vehicleId) {
        return res
          .status(400)
          .send({ error: "vehicle is not available or not found" });
      }

      log = {
        date: new Date(),
        userId,
        action: "action",
        details: `trip assigned to vehicle - ${vehicleId}`,
        reason: `accepted request`,
      };
      timelineAction = {
        date: new Date(),
        userId,
        action: "assign vehicle",
        status: "done",
      };
      const assignVehicle = await TripModel.findByIdAndUpdate(
        { _id: tripId },
        {
          $set: {
            vehicleId,
          },
          $push: { logs: log, timeline: timelineAction },
          status: "Vehicle Assigned",
        },
        { new: true }
      );
      if (!assignVehicle)
        return res
          .status(400)
          .send({ error: "error in assigning vehicle. ensure trip exists" });
      const upDateTruckStatus = await TruckModel.findByIdAndUpdate(
        { _id: vehicleId },
        { $set: { status: "On Trip" } },
        { new: true }
      );

      return res.status(200).send({ data: assignVehicle });
    }
    if (action === "mark loaded") {
      log = {
        date: new Date(),
        userId,
        action: "action",
        details: `trip loaded`,
        reason: `loading completed`,
      };
      timelineAction = {
        date: new Date(),
        userId,
        action: "mark loaded",
        status: "done",
      };
      const loadTrip = await TripModel.findByIdAndUpdate(
        { _id: tripId },
        {
          $set: { status: "Loaded" },
          $push: { logs: log, timeline: timelineAction },
        },
        { new: true }
      );
      if (!loadTrip)
        return res.status(400).send({ error: "error in loading trip" });
      return res.status(200).send({ data: loadTrip });
    }
    if (action === "mark en route") {
      const requestWaybil = trip?.requestedWaybilImageUrl?.link;
      if (!requestWaybil)
        return res
          .status(400)
          .send({ error: "Request waybill has to be uploaded first" });
      log = {
        date: new Date(),
        userId,
        action: "action",
        details: `trip en route`,
        reason: `trip started`,
      };
      timelineAction = {
        date: new Date(),
        userId,
        action: "mark en route",
        status: "done",
      };
      const enRouteTrip = await TripModel.findByIdAndUpdate(
        { _id: tripId },
        {
          $set: { status: "En Route" },
          $push: { logs: log, timeline: timelineAction },
        },
        { new: true }
      );
      if (!enRouteTrip)
        return res.status(400).send({ error: "error in starting trip" });
      return res.status(200).send({ data: enRouteTrip });
    }
    if (action === "mark arrived at destination") {
      log = {
        date: new Date(),
        userId,
        action: "action",
        details: `vehicle at destination`,
        reason: `vehicle arrived at destination`,
      };
      timelineAction = {
        date: new Date(),
        userId,
        action: "mark arrived at destination",
        status: "done",
      };
      const atDestinationTrip = await TripModel.findByIdAndUpdate(
        { _id: tripId },
        {
          $set: { status: "At Destination" },
          $push: { logs: log, timeline: timelineAction },
        },
        { new: true }
      );
      if (!atDestinationTrip)
        return res
          .status(400)
          .send({ error: "error in updaing status to at destination" });
      return res.status(200).send({ data: atDestinationTrip });
    }
    if (action === "mark delivered") {
      const deliveredWaybil = trip?.deliveredWaybilImageUrl?.link;
      if (!deliveredWaybil)
        return res
          .status(400)
          .send({ error: "Signed delivered waybill has to be uploaded first" });
      log = {
        date: new Date(),
        userId,
        action: "action",
        details: `delivered`,
        reason: `trip completed`,
      };
      timelineAction = {
        date: new Date(),
        userId,
        action: "delivered",
        status: "done",
      };
      const deliveredTrip = await TripModel.findByIdAndUpdate(
        { _id: tripId },
        {
          $set: {
            status: "Delivered",
            dropOffDate: new Date(),
            actualFuelLitres,
            actualFuelCost,
          },
          $push: { logs: log, timeline: timelineAction },
        },
        { new: true }
      );
      if (!deliveredTrip)
        return res.status(400).send({ error: "error in completing trip" });
      const upDateTruckStatus = await TruckModel.findByIdAndUpdate(
        { _id: deliveredTrip.vehicleId },
        { $set: { status: "Available" } },
        { new: true }
      );
      return res.status(200).send({ data: deliveredTrip });
    }
    if (action === "cancel") {
      const timeline = trip?.timeline?.filter(
        (item) => item?.action === "created"
      );
      if (!cancelReason)
        return res.status(400).send({ error: "cancel reason is required" });
      log = {
        date: new Date(),
        userId,
        action: "action",
        details: `trip cancelled`,
        reason: cancelReason,
      };
      timelineAction = {
        date: new Date(),
        userId,
        action: "cancel",
        status: "done",
      };
      timeline.push(timelineAction);
      const cancelTrip = await TripModel.findByIdAndUpdate(
        { _id: tripId },
        {
          $set: { status: "Cancelled" },
          timeline,
          $push: { logs: log },
          $unset: { vehicleId: 1 },
        },

        { new: true }
      );
      if (!cancelTrip)
        return res.status(400).send({ error: "error in cancelling trip" });
      if (trip?.vehicleId) {
        const upDateTruckStatus = await TruckModel.findByIdAndUpdate(
          { _id: trip.vehicleId },
          { $set: { status: "Available" } },
          { new: true }
        );
      }
      return res.status(200).send({ data: cancelTrip });
    }
    if (action === "resume") {
      if (!resumeReason)
        return res.status(400).send({ error: "resume reason is required" });
      log = {
        date: new Date(),
        userId,
        action: "action",
        details: `trip resumed`,
        reason: resumeReason,
      };
      const resumeTrip = await TripModel.findByIdAndUpdate(
        { _id: tripId },
        { $set: { status: "Pending" }, $push: { logs: log } },
        { new: true }
      );
      if (!resumeTrip)
        return res.status(400).send({ error: "error in resuming trip" });
      return res.status(200).send({ data: resumeTrip });
    }
    return res.status(400).send({ error: "invalid action" });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

module.exports = {
  createTrip,
  getTrip,
  getTrips,
  getTripLogs,
  addTripRemark,
  deleteTripRemark,
  editTripRemark,
  deleteTrips,
  restoreTrips,
  updateTrip,
  getTripRemarks,
  uploadWaybill,
  tripAction,
};
