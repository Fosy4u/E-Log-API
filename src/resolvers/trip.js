const TripModel = require("../models/trip");
const TruckModel = require("../models/truck");
const VendorAgentModel = require("../models/vendorAgent");
const {
  canDeleteOrEditOrganisationTripRemark,
} = require("../helpers/actionPermission");
const {
  verifyUserId,
  verifyVehicleId,
  verifyVendorAgentId,
} = require("../helpers/verifyValidity");

const getTrip = async (req, res) => {
  try {
    const { _id, organisationId } = req.query;
    if (!_id) return res.status(400).send({ error: "trip _id is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    const trip = await TripModel.findOne({ _id, organisationId }).lean();
    if (!trip) return res.status(400).send({ error: "trip not found" });
    return res.status(200).send({ data: trip });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getTrips = async (req, res) => {
  try {
    const { organisationId, disabled } = req.query;
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    const trips = await TripModel.find({
      organisationId,
      disabled: disabled || false,
    }).lean();
    return res.status(200).send({ data: trips });
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
    const exist = await TripModel.findOne({
      organisationId,
      requestId: code,
    });
    if (exist) {
      found = true;
    } else {
      found = false;
    }
  } while (!found);

  return code.toString();
};

const createTrip = async (req, res) => {
  const {
    organisationId,
    userId,
    remark,
    vehicleId,
    cargoName,
    customerId,
    pickUpAddress,
    pickUpDate,
    dropOffAddress,
    dropOffDate,
    price,
    vendorId,
    isVendorRequested
  } = req.body;
  try {
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });

    if (!userId) return res.status(400).send({ error: "userId is required" });
    if (!vehicleId)
      return res.status(400).send({ error: "vehicleId is required" });
    if (!cargoName)
      return res.status(400).send({ error: "cargoName is required" });
    if (!customerId)
      return res.status(400).send({ error: "customerId is required" });
    if (!pickUpAddress)
      return res.status(400).send({ error: "pickUpAddress is required" });
    if (!pickUpDate)
      return res.status(400).send({ error: "pickUpDate is required" });
    if (!dropOffAddress)
      return res.status(400).send({ error: "dropOffAddress is required" });
    if (!dropOffDate)
      return res.status(400).send({ error: "dropOffDate is required" });
    if (!price) return res.status(400).send({ error: "price is required" });
    if (!isVendorRequested)
      return res.status(400).send({ error: "isVendorRequested is required" });

    const log = {
      date: new Date(),
      userId: userId,
      action: "create",
      details: `trip created`,
      reason: `accepted customer request`,
    };

    const vehicle = await TruckModel.findOne({
      _id: vehicleId,
      organisationId,
      disabled: false,
    }).lean();
    if (!vehicle) return res.status(400).send({ error: "vehicle not found" });
    if (vehicle.status !== "available")
      return res.status(400).send({ error: "vehicle not available" });
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
    const params = {
      ...req.body,
      remarks,
      requestId,
      logs: [log],
    };

    const createTrip = new TripModel({ ...params });
    const newTrip = await createTrip.save();
    if (newTrip) {
      const updateVehicle = await TruckModel.findByIdAndUpdate(
        vehicleId,
        {
          status: "on trip",
        },
        { new: true }
      );
      return res.status(200).send({ message: "Trip created", data: newTrip });
    }
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
    if (req?.body?.vehicleId) {
      const vehicle = await TruckModel.findOne({
        _id: req?.body?.vehicleId,
        organisationId,
        disabled: false,
      }).lean();
      if (!vehicle) return res.status(400).send({ error: "vehicle not found" });
      if (vehicle.status !== "available")
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
        field: "customer",
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
      details: `trip - ${updateTrip.requestId} updated`,
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
            status: "available",
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
      const updateLog = await TripModel.findByIdAndUpdate(
        disabled._id,

        { $push: { logs: log } },
        { new: true }
      );
      result.push(_id);
    }

    return result;
  }, []);
};

const deleteTrips = async (req, res) => {
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

    const trip = await CustomerModel.findById({
      _id: tripId,
    });
    if (!trip) return res.status(400).send({ error: "trip not found" });
    const param = { tripId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationTripRemark(param);
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to delete this remark" });
    const updateRemark = await TruckModel.findByIdAndUpdate(
      {
        _id: tripId,
      },
      {
        $pull: {
          remarks: { _id: remarkId },
        },
      },
      { new: true }
    );
    const log = {
      date: new Date(),
      userId,
      action: "delete",
      reason: "deleted remark",
      details: `deleted remark on trip`,
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

// const assignVehicleToTrip = async (req, res) => {
//   try {
//     const { tripId, vehicleId, userId } = req.body;
//     if (!tripId) return res.status(400).send({ error: "tripId is required" });
//     if (!vehicleId)
//       return res.status(400).send({ error: "vehicleId is required" });
//     if (!userId) return res.status(400).send({ error: "userId is required" });

//     const validVehicle = await TruckModel.findOne({ _id: vehicleId });
//     if (!validVehicle) {
//       return res.status(400).send({ error: "vehicleId is invalid" });
//     }
//     const assignedVehicle = await TripModel.findOne({
//       vehicleId,
//       status: { $ne: "completed" },
//     });
//     if (assignedVehicle)
//       return res.status(400).send({
//         error: "vehicle is already assigned to another uncompleted trip",
//       });
//     const assignVehicle = await TripModel.findByIdAndUpdate(
//       { _id: tripId },
//       {
//         $set: {
//           vehicleId,
//         },
//       },
//       { new: true }
//     );
//     if (!assignVehicle)
//       return res
//         .status(400)
//         .send({ error: "error in assigning vehicle. ensure trip exists" });
//     const log = {
//       date: new Date(),
//       userId,
//       action: "assign",
//       details: `trip assigned to vehicle - ${vehicleId}`,
//       reason: `accepted request`,
//     };
//     const updateTrip = await TripModel.findByIdAndUpdate(
//       { _id: tripId },
//       { $push: { logs: log } },
//       { new: true }
//     );
//     return res.status(200).send({ data: assignVehicle });
//   } catch (error) {
//     return res.status(500).send(error.message);
//   }
// };

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
};
