const TyreModel = require("../models/tyre");
const VendorAgentModel = require("../models/vendorAgent");
const TruckModel = require("../models/truck");
const TripModel = require("../models/trip");
const TyreInspectionModel = require("../models/tyreInspection");
const mongoose = require("mongoose");
const {
  canDeleteOrEditOrganisationTyreRemark,
  canEditOrganisationTyre,
  canCreateOrganisationTyre,
} = require("../helpers/actionPermission");

const getName = (contact) => {
  if (!contact) return null;
  if (contact?.companyName) return contact?.companyName;

  return `${contact?.firstName} ${contact?.lastName}`;
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
    const exist = await TyreInspectionModel.findOne(
      {
        organisationId,
        inspectionId: code,
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

const createTyre = async (req, res) => {
  const {
    organisationId,
    purchaseDate,
    estimatedReplacementDate,
    userId,
    serialNo,
    remark,
    vehicleId,
    size,
    status,
  } = req.body;

  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    if (!purchaseDate)
      return res.status(400).json({ error: "Please provide purchase date" });
    if (!estimatedReplacementDate)
      return res
        .status(400)
        .json({ error: "Please provide estimated replacement date" });
    if (!size)
      return res.status(400).json({ error: "Please provide tyre size" });
    if (!status)
      return res.status(400).json({ error: "Please provide status" });

    if (!vehicleId)
      return res
        .status(400)
        .json({ error: "Please provide vehicle that the tire belongs to" });

    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    if (!serialNo)
      return res.status(400).json({ error: "Please provide serial number" });

    const existed = await TyreModel.findOne(
      { organisationId, serialNo },
      { lean: true }
    );
    if (existed) {
      return res.status(400).json({ error: "Serial number already exist" });
    }
    const assignedTruck = await TruckModel.findOne({
      _id: vehicleId,
      organisationId,
    });
    if (!assignedTruck)
      return res.status(400).json({ error: "Assigned Truck not found" });

    if (status === "Active") {
      const tyreCount = assignedTruck?.tyreCount;
      const activeTruckTyres = await TyreModel.find(
        {
          vehicleId: vehicleId,
          organisationId,
          disabled: false,
          status: "Active",
        },
        { _id: 1 }
      ).lean();

      if (activeTruckTyres.length >= tyreCount)
        return res.status(400).json({
          error: `Total active tyres for this truck is already reached : ${tyreCount}`,
        });
    }
    const param = { organisationId, userId };
    const canPerformAction = await canCreateOrganisationTyre(param);
    if (!canPerformAction)
      return res.status(400).send({
        error: "you dont have the permission to carry out this request",
      });

    const log = {
      date: new Date(),
      userId: userId,
      action: "create",
      details: `Tyre -  created`,
      reason: `added new tyre`,
    };
    let remarks = [];

    if (remark) {
      remarks.push({
        remark,
        userId,
        date: new Date(),
      });
    }
    const trips = [];
    if (assignedTruck?.status === "On Trip" && status === "Active") {
      const trip = await TripModel.findOne(
        {
          vehicleId: assignedTruck._id,
          organisationId,
          disabled: false,
          isCompleted: false,
        },
        { _id: 1 }
      );
      if (trip) {
        trips.push(trip._id);
      }
    }
    let params;

    params = {
      ...req.body,
      logs: [log],
      remarks,
      trips,
    };

    const newTyres = new TyreModel({
      ...params,
    });
    const saveTyres = await newTyres.save();
    if (!saveTyres)
      return res.status(401).json({ error: "Internal in saving tyres" });

    return res
      .status(200)
      .send({ message: "Tyres created successfully", data: saveTyres });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const recordTyreInspection = async (req, res) => {
  const { organisationId, userId, remark, vehicleId, details, date } = req.body;

  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }

    if (!vehicleId)
      return res
        .status(400)
        .json({ error: "Please provide vehicle that the tire belongs to" });

    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    if (!details || details.length === 0)
      return res.status(400).json({ error: "Please provide details" });
    if (!date)
      return res.status(400).json({ error: "Please provide inspection date" });
    const vehicle = await TruckModel.findById({ _id: vehicleId });
    if (!vehicle)
      return res.status(400).json({ error: "Vehicle does not exist" });

    let detailIsvaild = true;
    const verifyDetails = details.forEach(async (detail) => {
      const {
        serialNo,
        scratchType,
        tyreHealthCheckRating,
        inflationPercentage,
        bulge,
      } = detail;
      if (!serialNo || !scratchType || !tyreHealthCheckRating) {
        detailIsvaild = false;
      }
      const tyre = await TyreModel.findOne({
        organisationId,
        serialNo,
        vehicleId,
      });

      if (!tyre) {
        detailIsvaild = false;
        console.log("reached here 0.1", tyre);
      }
    });
    await Promise.resolve(verifyDetails);
    console.log("reached here 1");
    if (!detailIsvaild)
      return res.status(400).json({
        error:
          "Invalid details. Ensure all required values are provided and that all the tyes belong to the selected vehicle ID",
      });

    const param = { organisationId, userId };

    const canPerformAction = await canCreateOrganisationTyre(param);
    if (!canPerformAction)
      return res.status(400).send({
        error: "you dont have the permission to carry out this request",
      });

    const log = {
      date: new Date(),
      userId: userId,
      action: "create",
      details: `Tyre - Inspection -  recorded`,
      reason: `recorded tyre inspection`,
    };
    let remarks = [];

    if (remark) {
      remarks.push({
        remark,
        userId,
        date: new Date(),
      });
    }
    let params;
    const inspectionId = await generateUniqueCode(organisationId);

    params = {
      ...req.body,
      inspectionId,
      logs: [log],
      remarks,
    };

    const newTyreInspections = new TyreInspectionModel({
      ...params,
    });
    const saveTyreInspections = await newTyreInspections.save();
    if (!saveTyreInspections)
      return res.status(401).json({ error: "Internal in saving tyres" });

    return res.status(200).send({
      message: "Tyres created successfully",
      data: saveTyreInspections,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const attachTrip = async (tyre) => {
  const { trips } = tyre;
  const matchedTrips = await TripModel.find({
    _id: { $in: trips },
  }).lean();
  return {
    ...tyre,
    trips: matchedTrips,
  };
};

const attachVehicle = async (tyres, organisationId) => {
  const vehicleIds = tyres.map((tyre) => {
    if (tyre.vehicleId && tyre.vehicleId !== "") {
      return tyre.vehicleId;
    } else {
      return null;
    }
  });

  const vehicles = await TruckModel.find(
    {
      _id: { $in: vehicleIds },
    },
    { assignedPartnerId: 1, regNo: 1 }
  ).lean();

  const tyresWithVehicle = tyres.map((tyre) => {
    const vehicle = vehicles.find((vehicle) => vehicle._id == tyre.vehicleId);

    return {
      ...tyre,
      vehicle: vehicle,
    };
  });
  return tyresWithVehicle;
};

const getTyres = async (req, res) => {
  const { organisationId, disabled } = req.query;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    const tyres = await TyreModel.find({
      organisationId,
      disabled: disabled ? disabled : false,
    }).lean();
    if (!tyres)
      return res.status(401).json({ error: "Internal error in getting tyres" });

    const tyresWithVehicle = await attachVehicle(tyres, organisationId);

    return res.status(200).send({
      message: "Tyres fetched successfully",
      data: tyresWithVehicle.sort(function (a, b) {
        return new Date(b?.purchaseDate) - new Date(a?.purchaseDate);
      }),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const getTyresByParams = async (req, res) => {
  const { organisationId, disabled } = req.query;

  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }

    const tyres = await TyreModel.find({
      organisationId,
      disabled: disabled ? disabled : false,
      ...req.query,
    }).lean();
    if (!tyres) return res.status(200).json({ data: [] });

    const tyresWithVehicle = await attachVehicle(tyres, organisationId);

    return res.status(200).send({
      message: "Tyre Inspections fetched successfully",
      data: tyresWithVehicle.sort(function (a, b) {
        return new Date(b?.purchaseDate) - new Date(a?.purchaseDate);
      }),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const getTyreInspections = async (req, res) => {
  const { organisationId, disabled } = req.query;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    const tyreInspections = await TyreInspectionModel.find({
      organisationId,
      disabled: disabled ? disabled : false,
    }).lean();
    if (!tyreInspections)
      return res
        .status(401)
        .json({ error: "Internal error in getting tyre Inspections" });

    const tyreInspectionsWithVehicle = await attachVehicle(
      tyreInspections,
      organisationId
    );

    return res.status(200).send({
      message: "Tyre Inspections fetched successfully",
      data: tyreInspectionsWithVehicle.sort(function (a, b) {
        return new Date(b?.date) - new Date(a?.date);
      }),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const getTyresByVehicleId = async (req, res) => {
  const { organisationId, disabled, vehicleId } = req.query;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    if (!vehicleId)
      return res.status(400).json({ error: "Please provide vehicle id" });

    const tyres = await TyreModel.find({
      organisationId,
      vehicleId,
      disabled: disabled ? disabled : false,
    }).lean();
    if (!tyres)
      return res.status(401).json({ error: "Internal error in getting tyres" });

    return res.status(200).send({
      message: "Tyres fetched successfully",
      data: tyres.sort(function (a, b) {
        return new Date(b?.purchaseDate) - new Date(a?.purchaseDate);
      }),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const getTyreInspectionByVehicleId = async (req, res) => {
  const { organisationId, disabled, vehicleId } = req.query;
  try {
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisation id",
      });
    }
    if (!vehicleId)
      return res.status(400).json({ error: "Please provide vehicle id" });
    const inspections = await TyreInspectionModel.find({
      organisationId,
      vehicleId,
      disabled: disabled ? disabled : false,
    }).lean();
    if (!inspections) {
      return res
        .status(401)
        .json({ error: "Internal error in getting inspections" });
    }

    return res.status(200).send({
      message: "Reports fetched successfully",
      data: inspections.sort(function (a, b) {
        return new Date(b?.date) - new Date(a?.date);
      }),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getTyre = async (req, res) => {
  
  try {
    const { _id, organisationId } = req.query;
    if (!_id) return res.status(400).send({ error: "tyre _id is required" });
    if (!organisationId )
      return res.status(400).send({ error: "organisationId is required" });
    const tyre = await TyreModel.findOne({ _id, organisationId }).lean();
    if (!tyre) return res.status(400).send({ error: "tyre not found" });

    const tyreWithVehicle = await attachVehicle([tyre], organisationId);


    const tyreWithTrip = await attachTrip(tyreWithVehicle[0], organisationId);

    return res.status(200).send({ data: tyreWithTrip });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getTyreInspection = async (req, res) => {
  try {
    const { _id, organisationId } = req.query;
    if (!_id)
      return res.status(400).send({ error: "inspection _id is required" });
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    const inspection = await TyreInspectionModel.findOne({
      _id: _id,
      organisationId,
    }).lean();
    if (!inspection)
      return res.status(400).send({ error: "inspection not found" });
    return res.status(200).send({ data: inspection });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const updateTyre = async (req, res) => {
  const { _id, userId, organisationId, status, reason } = req.body;
  try {
    if (!_id) return res.status(400).json({ error: "Please provide _id" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const oldData = await TyreModel.findById(_id).lean();

    const vehicleId = oldData?.vehicleId;

    if (status === "Active" && oldData?.status !== "Active") {
      const assignedTruck = await TruckModel.findOne({
        _id: vehicleId,
        organisationId,
      });
      if (!assignedTruck)
        return res.status(400).json({ error: "Assigned Truck not found" });
      const tyreCount = assignedTruck?.tyreCount;
      const activeTruckTyres = await TyreModel.find(
        {
          vehicleId: vehicleId,
          organisationId,
          disabled: false,
          status: "Active",
        },
        { _id: 1 }
      ).lean();
      if (activeTruckTyres.length >= tyreCount)
        return res.status(400).json({
          error: `Total active tyres for this truck is already reached : ${tyreCount}`,
        });
    }
    const newData = req.body;
    const difference = [];

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
        key !== "remarks" &&
        key !== "userId" &&
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

    if (req.body?.vehicleId && req.body?.vehicleId !== oldData?.vehicleId) {
      const oldVehicle = await TruckModel.findOne({
        _id: oldData?.vehicleId,
        organisationId,
      });
      const newVehicle = await TruckModel.findOne({
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
      details: `Tyres - updated`,
      reason: reason || "not provided",
      difference,
    };

    const params = {
      ...req.body,
      logs: [log],
    };

    const updateTyres = await TyreModel.findByIdAndUpdate(
      _id,
      {
        ...params,
      },
      { new: true }
    );

    if (!updateTyres)
      return res
        .status(401)
        .json({ error: "Internal error in updating tyres" });

    return res
      .status(200)
      .send({ message: "Tyres updated successfully", data: updateTyres });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const updateTyreInspection = async (req, res) => {
  const { _id, userId, organisationId } = req.body;
  try {
    if (!_id) return res.status(400).json({ error: "Please provide _id" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const oldData = TyreInspectionModel.findById(_id, { lean: true });
    const newData = req.body;
    const difference = [];

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
        key !== "remarks" &&
        key !== "userId" &&
        key !== "vehicleId" &&
        key !== "details"
      ) {
        difference.push({
          field: key,
          old: oldData[key] || "not provided",
          new: newData[key],
        });
      }
    }

    if (req.body?.vehicleId && req.body?.vehicleId !== oldData?.vehicleId) {
      const oldVehicle = await TruckModel.findOne({
        _id: oldData?.vehicleId,
        organisationId,
      });
      const newVehicle = await TruckModel.findOne({
        _id: req.body?.vehicleId,
        organisationId,
      });
      difference.push({
        field: "vehicle",
        old: oldVehicle?.regNo || "not provided",
        new: newVehicle?.regNo,
      });
    }

    if (req.body?.details) {
      const oldDetails = oldData?.details || [];
      const newDetails = req.body?.details || [];
      //check if contents are same
      const changedKeys = [];
      const isSame = oldDetails.every((item, index) => {
        if (item !== newDetails[index]) {
          changedKeys.push(index);
        }
        return item === newDetails[index];
      });
      if (!isSame) {
        changedKeys.forEach((key) => {
          difference.push({
            field: `details - ${key}`,
            old: oldDetails[key] || "not provided",
            new: newDetails[key],
          });
        });
      }
    }

    const log = {
      date: new Date(),
      userId: userId,
      action: "edit",
      details: `Tyres Inspection - updated`,
      reason: `updated tyres inspection`,
      difference,
    };

    const params = {
      ...req.body,
      logs: [log],
    };

    const updateTyresInspection = await TyreInspectionModel.findByIdAndUpdate(
      _id,
      {
        ...params,
      },
      { new: true }
    );

    if (!updateTyresInspection)
      return res
        .status(401)
        .json({ error: "Internal error in updating tyres" });

    return res.status(200).send({
      message: "Tyres updated successfully",
      data: updateTyresInspection,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const validateTyres = async (ids) => {
  const tyres = await TyreModel.find({ _id: { $in: ids } });
  if (tyres.length !== ids.length) {
    return false;
  }
  return true;
};
const disableTyres = async (ids, userId) => {
  const log = {
    date: new Date(),
    userId: userId,
    action: "delete",
    details: `Tyre -  deleted`,
    reason: `deleted tyre`,
  };
  const updateExp = await TyreModel.updateMany(
    { _id: { $in: ids } },
    { disabled: true, $push: { logs: log } }
  );
  if (!updateExp) return false;
  return true;
};
const enableTyres = async (ids, userId) => {
  const log = {
    date: new Date(),
    userId: userId,
    action: "restore",
    details: `Tyre -  restored`,
    reason: `deleted tyre`,
  };
  const updateExp = await TyreModel.updateMany(
    { _id: { $in: ids } },
    { disabled: false, $push: { logs: log } }
  );
  if (!updateExp) return false;
  return true;
};
const validateTyreInspections = async (ids) => {
  const tyreInspections = await TyreInspectionModel.find({ _id: { $in: ids } });
  if (tyreInspections.length !== ids.length) {
    return false;
  }
  return true;
};
const disableTyreInspections = async (ids, userId) => {
  const log = {
    date: new Date(),
    userId: userId,
    action: "delete",
    details: `Tyre -  deleted`,
    reason: `deleted tyre`,
  };
  const updateExp = await TyreInspectionModel.updateMany(
    { _id: { $in: ids } },
    { disabled: true, $push: { logs: log } }
  );
  if (!updateExp) return false;
  return true;
};
const enableTyreInspections = async (ids, userId) => {
  const log = {
    date: new Date(),
    userId: userId,
    action: "restore",
    details: `Tyre -  restored`,
    reason: `deleted tyre`,
  };
  const updateExp = await TyreInspectionModel.updateMany(
    { _id: { $in: ids } },
    { disabled: false, $push: { logs: log } }
  );
  if (!updateExp) return false;
  return true;
};

const deleteTyres = async (req, res) => {
  const { ids, userId } = req.body;
  try {
    if (!ids || ids.length === 0)
      return res.status(400).send({ error: "No tyre id is provided" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const isValid = await validateTyres(ids);
    if (!isValid)
      return res.status(400).send({ error: "Invalid tyre id is provided" });
    const isDisabled = await disableTyres(ids, userId);
    if (!isDisabled)
      return res.status(400).send({ error: "Error in deleting tyres" });
    return res
      .status(200)
      .send({ message: "Tyres deleted successfully", data: ids });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const deleteTyreInspections = async (req, res) => {
  const { ids, userId } = req.body;
  try {
    if (!ids || ids.length === 0)
      return res
        .status(400)
        .send({ error: "No tyre inspection id is provided" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const isValid = await validateTyreInspections(ids);
    if (!isValid)
      return res
        .status(400)
        .send({ error: "Invalid tyre inspection id is provided" });
    const isDisabled = await disableTyreInspections(ids, userId);
    if (!isDisabled)
      return res
        .status(400)
        .send({ error: "Error in deleting tyre inspections" });
    return res
      .status(200)
      .send({ message: "Tyre Inspections deleted successfully", data: ids });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const restoreTyres = async (req, res) => {
  const { ids, userId } = req.body;
  try {
    if (!ids || ids.length === 0)
      return res.status(400).send({ error: "No tyre id is provided" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const isValid = await validateTyres(ids);
    if (!isValid)
      return res.status(400).send({ error: "Invalid tyre id is provided" });
    const isDisabled = await enableTyres(ids, userId);
    if (!isDisabled)
      return res.status(400).send({ error: "Error in restoring tyres" });
    return res
      .status(200)
      .send({ message: "Tyres restored successfully", data: ids });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
const restoreTyreInspections = async (req, res) => {
  const { ids, userId } = req.body;
  try {
    if (!ids || ids.length === 0)
      return res
        .status(400)
        .send({ error: "No tyre inspection id is provided" });
    if (!userId)
      return res
        .status(400)
        .json({ error: "Please provide logged in user id" });
    const isValid = await validateTyreInspections(ids);
    if (!isValid)
      return res
        .status(400)
        .send({ error: "Invalid tyre inspection id is provided" });
    const isDisabled = await enableTyreInspections(ids, userId);
    if (!isDisabled)
      return res
        .status(400)
        .send({ error: "Error in restoring tyre inspection" });
    return res
      .status(200)
      .send({ message: "Tyre Inspections restored successfully", data: ids });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getTyreLogs = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "Tyres _id is required" });
    const tyres = await TyreModel.aggregate([
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

    const logs = tyres[0]?.logs;
    if (!logs || logs?.length === 0) return res.status(200).send({ data: [] });

    return res.status(200).send({
      data: logs,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const addTyreRemark = async (req, res) => {
  try {
    const { _id, remarkObj } = req.body;

    const { remark, userId } = remarkObj;

    if (!_id) return res.status(400).send({ error: "tyres_id is required" });
    if (!remark) return res.status(400).send({ error: "empty remark " });

    if (!userId)
      return res.status(400).send({ error: "current userId is required " });
    const tyres = await TyreModel.findById({ _id });
    if (!tyres) return res.status(400).send({ error: "tyres not found" });
    remarkObj.date = new Date();
    const updateRemark = await TyreModel.findByIdAndUpdate(
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
      details: `added remark on tyres`,
    };
    const updateTyres = await TyreModel.findByIdAndUpdate(
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

const deleteTyreRemark = async (req, res) => {
  try {
    const { tyresId, remarkId, userId } = req.body;
    if (!tyresId) return res.status(400).send({ error: "tyresId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });

    const tyres = await TyreModel.findById({
      _id: tyresId,
    });
    if (!tyres) return res.status(400).send({ error: "tyres not found" });
    const param = { tyresId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationTyresRemark(
      param
    );
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to delete this remark" });
    const log = {
      date: new Date(),
      userId,
      action: "delete",
      reason: "deleted remark",
      details: `deleted remark on tyres`,
    };

    const updateRemark = await TyreModel.findByIdAndUpdate(
      {
        _id: tyresId,
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
const editTyreRemark = async (req, res) => {
  try {
    const { tyresId, remarkId, userId, remark } = req.body;
    if (!tyresId) return res.status(400).send({ error: "tyresId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });
    if (!remark) return res.status(400).send({ error: "remark is required" });

    const tyres = await TyreModel.findById({
      _id: tyresId,
    });
    if (!tyres) return res.status(400).send({ error: "tyres not found" });
    const param = { tyresId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationTyreRemark(param);
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to edit this remark" });

    const updateRemark = await TyreModel.updateOne(
      {
        _id: tyresId,
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
      details: `edited remark on tyres`,
    };
    const updateTyre = await TyreModel.findByIdAndUpdate(
      { _id: tyresId },
      { $push: { logs: log } },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const getTyreRemarks = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "tyres _id is required" });
    const tyres = await TyreModel.aggregate([
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

    const remarks = tyres[0]?.remarks;

    if (!remarks || remarks?.length === 0) return res.status(200).send([]);

    return res.status(200).send({
      data: remarks,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  addTyreRemark,
  deleteTyreRemark,
  editTyreRemark,
  getTyreRemarks,
  createTyre,
  getTyreInspection,
  getTyreInspections,
  getTyres,
  getTyresByParams,
  getTyresByVehicleId,
  getTyre,
  updateTyre,
  deleteTyres,
  getTyreLogs,
  restoreTyres,
  recordTyreInspection,
  getTyreInspectionByVehicleId,
  updateTyreInspection,
  deleteTyreInspections,
  restoreTyreInspections,
};
