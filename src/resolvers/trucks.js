const TruckModel = require("../models/truck");
const TripModel = require("../models/trip");
const DriverModel = require("../models/driver");
const OrganisationPartnerModel = require("../models/organisationPartner");
const OrganisationUserModel = require("../models/organisationUsers");
const randomColor = require("randomcolor");
const mongoose = require("mongoose");
const { storageRef } = require("../config/firebase"); // reference to our db
const root = require("../../root");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const { deleteLocalFile } = require("../helpers/utils");
const {
  canDeleteOrEditOrganisationTruckRemark,
} = require("../helpers/actionPermission");

//generate random color
const generateColor = async (organisationId) => {
  let color;
  let found = true;
  const excludedColors = ["rgb(164, 249, 184)"];

  do {
    color = randomColor({
      luminosity: "dark",
      format: "rgb",
    });
    const exist = await TruckModel.findOne(
      {
        organisationId,
        colorTag: color,
      },
      { lean: true }
    );

    if (exist || exist !== null || excludedColors.includes(color)) {
      found = true;
    } else {
      found = false;
    }
  } while (found);

  return color;
};

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
        destination: `/trucks/${filename}`,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4(),
        },
      }
    );
    url = { link: storage[0].metadata.mediaLink, name: filename };
    const deleteSourceFile = await deleteLocalFile(source);
    const deleteResizedFile = await deleteLocalFile(
      path.resolve(req.file.destination, "resized", filename)
    );
    await Promise.all([deleteSourceFile, deleteResizedFile]);
    return url;
  }
  return url;
};

const deleteImageFromFirebase = async (name) => {
  console.log("starting image del", name);

  if (name) {
    storageRef
      .file("/trucks/" + name)
      .delete()
      .then(() => {
        console.log("del is", name);
        return true;
      })
      .catch((err) => {
        console.log("err is", err);
        return false;
      });
  }
};

const createTruck = async (req, res) => {
  const {
    regNo,
    chasisNo,
    manufacturer,
    maxLoad,
    truckType,
    organisationId,
    ownership,
    userId,
  } = req.body;
  try {
    if (
      !regNo ||
      !chasisNo ||
      !manufacturer ||
      !maxLoad ||
      !truckType ||
      !organisationId ||
      !ownership
    ) {
      return res
        .status(400)
        .send({ error: "some required fields are missing" });
    }
    if (!userId) {
      return res.status(400).send({ error: "userId is required" });
    }
    const user = await OrganisationUserModel.findById({ _id: userId }).lean();
    if (!user) {
      return res
        .status(400)
        .send({ error: "current logged in user not found" });
    }
    let assignedPersonnelsId;
    if (req.body?.assignedPersonnelsId) {
      assignedPersonnelsId = JSON.parse(req.body.assignedPersonnelsId);
    }
    const assignedPersonnelsList = [];
    if (assignedPersonnelsId?.length > 0) {
      await Promise.all(
        assignedPersonnelsId?.map(async (personnelId) => {
          const validPersonnerlId = await OrganisationUserModel.findById(
            personnelId
          );
          if (!validPersonnerlId) {
            return res
              .status(400)
              .send({ error: "one or more assignedPersonnelsId is invalid" });
          }
          assignedPersonnelsList.push({
            assignedUserId: personnelId,
            date: new Date(),
            userId,
            action: "assigned",
          });
        })
      );
    }

    const log = {
      date: new Date(),
      userId: userId,
      action: "added",
      details: `truck created`,
      reason: `added new truck`,
    };
    if (req.file) {
      const filename = req.file.filename;
      const imageUrl = await addImage(req, filename);
      const colorTag = await generateColor(organisationId);

      const createTruck = new TruckModel({
        ...req.body,
        imageUrl,
        colorTag,
        logs: [log],
        assignedPersonnelsList,
      });
      const newTruck = await createTruck.save();

      if (!newTruck) {
        return res.status(400).send({ error: "error in adding truck" });
      }
      return res.status(200).send({ data: newTruck });
    } else {
      const colorTag = await generateColor(organisationId);
      const createTruck = new TruckModel({
        ...req.body,
        colorTag,
        logs: [log],
      });
      const newTruck = await createTruck.save();

      if (!newTruck) {
        return res.status(400).send({ error: "error in adding truck" });
      }
      return res.status(200).send({ data: newTruck });
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getTruck = async (req, res) => {
  try {
    const { truckId } = req.query;
    if (!truckId) return res.status(400).send({ error: "truckId is required" });
    const truck = await TruckModel.findById({ _id: truckId }).lean();

    if (!truck) return res.status(400).send({ error: "no truck found" });
    const assignedPersonnelsList = [];

    if (truck?.assignedPersonnelsList?.length > 0) {
      await Promise.all(
        truck?.assignedPersonnelsList?.map(async (personnel) => {
          const { assignedUserId } = personnel;
          if (!assignedUserId) return;
          const user = await OrganisationUserModel.findOne({
            _id: assignedUserId,
          }).lean();
          if (user) {
            assignedPersonnelsList.push({
              ...personnel,
              user,
            });
          }
        })
      );
    }

    truck.assignedPersonnelsList = assignedPersonnelsList;

    const addStatusToTrucks = await confirmActiveTruck(truck);
    return res.status(200).send({ data: addStatusToTrucks });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getPartnerTrucks = async (req, res) => {
  try {
    const { partnerId } = req.query;
    if (!partnerId)
      return res.status(400).send({ error: "partnerId is required" });
    const trucks = await TruckModel.find({
      assignedPartnerId: partnerId,
    }).lean();

    if (!trucks) return res.status(200).send([]);
    const addStatusToTrucks = [];
    await Promise.all(
      trucks.map(async (truck) => {
        return addStatusToTrucks.push(confirmActiveTruck(truck));
      })
    );
    return res.status(200).send({ data: addStatusToTrucks });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getTruckByParam = async (req, res) => {
  try {
    const param = req.query;
    const organisationId = req.query.organisationId;
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });
    const trucks = await TruckModel.find({ ...param }).lean();
    if (!trucks) return res.status(200).send([]);
    const addStatusToTrucks = [];
    await Promise.all(
      trucks.map(async (truck) => {
        return addStatusToTrucks.push(confirmActiveTruck(truck));
      })
    );
    return res.status(200).send({ data: addStatusToTrucks });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const confirmActiveTruck = (truck) => {
  const cloned = { ...truck };
  if (!cloned.active) {
    cloned.status === "inactive";
  }
  return cloned;
};

const getTrucks = async (req, res) => {
  try {
    const { organisationId, disabled } = req.query;
    if (!organisationId)
      return res.status(400).send({ error: "organisationId is required" });

    const trucks = await TruckModel.find(
      {
        organisationId,
        disabled: disabled === "true" ? true : false,
      },
      { remarks: 0, logs: 0, timeline: 0 }
    ).lean();
    if (!trucks) return res.status(400).send({ error: "no truck found" });
    
    const addStatusToTrucks = [];
    await Promise.all(
      trucks.map(async (truck) => {
        return addStatusToTrucks.push(confirmActiveTruck(truck));
      })
    );
    return res.status(200).send({ data: addStatusToTrucks });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const validateTruck = async (ids) => {
  const invalidTrucks = await ids.reduce(async (acc, item) => {
    let invalid = await acc;
    const id = item;

    const found = await TruckModel.findById(id);

    if (!found) {
      invalid.push(id);
    }

    return invalid;
  }, []);

  return invalidTrucks;
};
const validateTruckStatus = async (ids) => {
  const invalidTrucks = await ids.reduce(async (acc, item) => {
    let invalid = await acc;
    const id = item;

    const found = await TruckModel.findById(id);
    if (found?.status === "On Trip") {
      invalid.push(found?.regNo || id);
    }

    return invalid;
  }, []);

  return invalidTrucks;
};

const deleteTruckModel = async (ids, userId) => {
  return ids.reduce(async (acc, _id) => {
    const log = {
      date: new Date(),
      userId: userId,
      action: "delete",
      details: `deleted truck`,
      reason: `deleted truck`,
    };
    const result = await acc;
    const update = await TruckModel.findByIdAndUpdate(
      _id,

      {
        disabled: true,
        status: "Deleted",
        $push: { logs: log },
      },
      { new: true }
    );

    const deletedTruck = update?._id;

    if (!deletedTruck) {
      result.push(_id);
    }

    return result;
  }, []);
};

const restoreTruckModel = async (ids, userId) => {
  return ids.reduce(async (acc, _id) => {
    const result = await acc;
    const log = {
      date: new Date(),
      userId: userId,
      action: "restore",
      details: `restored truck`,
      reason: `restored previously deleted truck`,
    };
    const truck = await TruckModel.findById(_id).lean();
    const status = truck?.active ? "Available" : "Inactive";

    const update = await TruckModel.findByIdAndUpdate(
      _id,

      { disabled: false, status, $push: { logs: log } },
      { new: true }
    );

    const restoredTruck = update?._id;

    if (!restoredTruck) {
      result.push(_id);
    }

    return result;
  }, []);
};

const restoreTruck = async (req, res) => {
  const { ids, userId } = req.body;

  try {
    if (!userId)
      return res.status(400).send({
        error:
          "userId is required. Please contact NemFra Tech support if this error persist unexpectedly",
      });
    const user = await OrganisationUserModel.findById(userId);
    if (!user) {
      return res.status(400).send({ error: "user not found" });
    }

    const invalidTrucks = await validateTruck(ids);
    if (invalidTrucks.length > 0) {
      return res.status(400).send({
        error: `request failed as the following truck(s)  ${
          invalidTrucks.length > 1 ? " do" : " does"
        } not exist. Please contact FosyTech support if this error persist unexpectedly : [${invalidTrucks}]`,
      });
    }

    const failedRestoredTruck = await restoreTruckModel(ids, userId);

    if (failedRestoredTruck.length > 0) {
      return res.status(400).send({
        error: `request failed. Please ensure you have good internet. if error persists, contact NemFra Tech support`,
      });
    }
    return res.status(200).send({ data: "success" });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const deleteTruck = async (req, res) => {
  const { ids, images, userId } = req.body;
  try {
    if (!userId)
      return res.status(400).send({
        error:
          "userId is required. Please contact NemFra Tech support if this error persist unexpectedly",
      });
    const user = await OrganisationUserModel.findById(userId);
    if (!user) {
      return res.status(400).send({ error: "user not found" });
    }
    const invalidTrucks = await validateTruckStatus(ids);
    if (invalidTrucks.length > 0) {
      return res.status(400).send({
        error: `request failed as the following truck(s)  ${
          invalidTrucks.length > 1 ? " are" : " is"
        } on trip. You can not delete a truck that is on trip. Please contact FosyTech support if this error persist unexpectedly : [${invalidTrucks}]`,
      });
    }

    const deletedTruck = await deleteTruckModel(ids, userId);

    if (deletedTruck.length > 0) {
      return res.status(400).send({
        error: `request failed. Please ensure you have good internet. if error persists, contact NemFra Tech support`,
      });
    }
    // if(images.length > 0){
    // const deleteImage = await deleteTruckImageFirebase(images)};
    return res.status(200).send({ data: "success" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const editTruck = async (req, res) => {
  try {
    const { _id, userId } = req.body;
    if (!userId)
      return res.status(400).send({
        error:
          "userId is required. Please contact support if this error persist unexpectedly",
      });
    if (!_id)
      return res.status(400).send({
        error:
          "truckId is required. Please contact support if this error persist unexpectedly",
      });
    let assignedPersonnelsId;
    if (req.body?.assignedPersonnelsId) {
      assignedPersonnelsId = JSON.parse(req.body.assignedPersonnelsId);
    }

    if (!userId)
      return res.status(400).send({
        error:
          "userId is required. Please contact NemFra Tech support if this error persist unexpectedly",
      });
    const user = await OrganisationUserModel.findById(userId);
    if (!user) {
      return res.status(400).send({ error: "current user not found" });
    }

    const truck = await TruckModel.findById(_id).lean();

    const difference = [];
    const oldData = truck;
    const newData = { ...req.body };

    for (const key in newData) {
      if (
        oldData[key] !== newData[key] &&
        key !== "_id" &&
        key !== "logs" &&
        key !== "createdAt" &&
        key !== "updatedAt" &&
        key !== "file" &&
        key !== "__v" &&
        key !== "disabled" &&
        key !== "organisationId" &&
        key !== "userId" &&
        key !== "tyreCount" &&
        key !== "assignedPersonnelsId"
      ) {
        difference.push({
          field: key,
          old: oldData[key] || "not provided",
          new: newData[key],
        });
      }
    }

    if (req.body?.tyreCount != truck?.tyreCount) {
      difference.push({
        field: "tyre Count",
        old: oldData.tyreCount || "not provided",
        new: newData.tyreCount,
      });
    }

    let assignedPersonnelsList = [];
    if (assignedPersonnelsId?.length > 0) {
      await Promise.all(
        assignedPersonnelsId?.map(async (personnelId) => {
          const validPersonnerlId = await OrganisationUserModel.findById(
            personnelId
          );
          if (!validPersonnerlId) {
            return res
              .status(400)
              .send({ error: "one or more assignedPersonnelsId is invalid" });
          }
          const found = oldData?.assignedPersonnelsId?.find(
            (assigned) => assigned?.assignedUserId === personnelId
          );
          if (!found) {
            assignedPersonnelsList.push({
              assignedUserId: personnelId,
              date: new Date(),
              userId,
              action: "assigned",
            });
            difference.push({
              field: "assignedPersonnels",
              old: "-",
              new: `${validPersonnerlId?.firstName} ${validPersonnerlId?.lastName}  assigned`,
            });
          }
        })
      );

      oldData?.assignedPersonnelsId?.map(async (assigned) => {
        const validPersonnerlId = await OrganisationUserModel.findById(
          assigned?.assignedUserId
        );
        const exist = assignedPersonnelsId?.find(
          (personnelId) => personnelId === assigned?.assignedUserId
        );
        if (!exist) {
          difference.push({
            field: "assignedPersonnels",
            old: `${validPersonnerlId?.firstName} ${validPersonnerlId?.lastName} removed from assignedPersonnels`,
            new: "-",
          });
        }
      });
    }

    const log = {
      date: new Date(),
      userId: userId,
      action: "update",
      details: `${truck.regNo} - updated`,
      reason: `updated truck details`,
      difference,
    };
    if (!req.body.imageUrl && req.file) {
      const filename = req.file.filename;
      const imageUrl = await addImage(req, filename);
      const truck = await TruckModel.findById(_id);
      if (!truck) {
        return res.status(400).send({ error: "truck does not exist" });
      }
      const truckImage = truck?.imageUrl?.name;

      const update = await TruckModel.findByIdAndUpdate(
        _id,

        { ...req.body, imageUrl, assignedPersonnelsList, $push: { logs: log } },
        { new: true }
      );
      if (!update) {
        return res.status(400).send({ error: "error in updating truck" });
      }
      if (truckImage && update) {
        const deletePrevImageFromFireBase = Promise.resolve(
          deleteImageFromFirebase(truckImage)
        );
      }
      if (update?.ownership !== "Partner" && update?.assignedPartnerId) {
        const removePartner = await TruckModel.findByIdAndUpdate(
          _id,
          { assignedPartnerId: " " },
          { new: true }
        );
        return res.status(200).send({ data: removePartner });
      }

      return res.status(200).send({ data: update });
    } else {
      const update = await TruckModel.findByIdAndUpdate(
        _id,

        { ...req.body, assignedPersonnelsList, $push: { logs: log } },
        { new: true }
      );

      if (update) {
        if (update?.ownership !== "Partner" && update?.assignedPartnerId) {
          const removePartner = await TruckModel.findByIdAndUpdate(
            _id,
            { assignedPartnerId: null },
            { new: true }
          );
          return res.status(200).send({ data: removePartner });
        }
        return res.status(200).send({ data: update });
      }
    }
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const uploadTruckDoc = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ error: "no file uploaded" });
    }

    const { _id, value, expiryDate, insuranceNo } = req.body;

    if (!_id) {
      return res.status(400).send({ error: "no truck id provided" });
    }
    if (!value) {
      return res.status(400).send({ error: "no value provided" });
    }
    if (!value === "proofOfInsurance" && !insuranceNo) {
      return res.status(400).send({ error: "no insuranceNo provided" });
    }
    if (!expiryDate) {
      return res.status(400).send({ error: "no expiry date provided" });
    }
    const filename = req.file.filename;
    const imageUrl = await addImage(req, filename);

    imageUrl.expiryDate = expiryDate;
    if (value === "proofOfInsurance") {
      imageUrl.insuranceNo = insuranceNo;
    }
    const obj = {
      title: value,
      imageUrl,
      expiryDate,
      insuranceNo,
    };
    const truck = await TruckModel.findById(_id);
    if (!truck) {
      return res.status(400).send({ error: "truck does not exist" });
    }
    const carDocs = truck?.carDocs || {};
    if (carDocs[value]) {
      const deletePrevDocFromFireBase = await deleteImageFromFirebase(
        carDocs[value]?.imageUrl?.name
      );
    }

    carDocs[value] = obj;

    const update = await TruckModel.findByIdAndUpdate(
      { _id },
      { carDocs: carDocs },
      { new: true }
    );

    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const assignTruckDriver = async (req, res) => {
  try {
    const { truckId, driverId } = req.body;
    if (!truckId) {
      return res.status(400).send({ error: "no truckId provided" });
    }
    if (!driverId) {
      return res.status(400).send({ error: "no driverId provided" });
    }
    const truck = await TruckModel.findById({ _id: truckId });
    if (!truck?.active) {
      return res.status(400).send({ error: "truck is not active" });
    }
    const driver = await DriverModel.findById({ _id: driverId });
    if (!driver?.active) {
      return res.status(400).send({ error: "driver is not active" });
    }
    const updatedTruck = await TruckModel.findByIdAndUpdate(
      { _id: truckId },
      { assignedDriverId: driverId },
      { new: true }
    );
    const updatedDriver = await DriverModel.findByIdAndUpdate(
      { _id: driverId },
      { assignedTruckId: truckId },
      { new: true }
    );

    return res.status(200).send({ data: "success" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const assignPartnerTruck = async (req, res) => {
  try {
    const { truckId, partnerId } = req.body;
    if (!truckId) {
      return res.status(400).send({ error: "no truckId provided" });
    }
    if (!partnerId) {
      return res.status(400).send({ error: "no partnerId provided" });
    }
    const truck = await TruckModel.findById({ _id: truckId });
    if (!truck?.active) {
      return res.status(400).send({ error: "truck is not active" });
    }
    const partner = await OrganisationPartnerModel.findById({ _id: partnerId });
    if (partner?.disabled) {
      return res.status(400).send({ error: "driver is disabled / deleted" });
    }
    if (!partner) {
      return res.status(400).send({ error: "invalid partner Id" });
    }
    const updatedTruck = await TruckModel.findByIdAndUpdate(
      { _id: truckId },
      { assignedPartnerId: partnerId },
      { new: true }
    );

    return res.status(200).send({ data: "success" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const removePartnerTruck = async (req, res) => {
  try {
    const { truckId, partnerId } = req.body;
    if (!truckId) {
      return res.status(400).send({ error: "no truckId provided" });
    }
    if (!partnerId) {
      return res.status(400).send({ error: "no partnerId provided" });
    }
    const truck = await TruckModel.findById({ _id: truckId });
    if (!truck?.active) {
      return res.status(400).send({ error: "truck is not active" });
    }

    const updatedTruck = await TruckModel.findByIdAndUpdate(
      { _id: truckId },
      { assignedPartnerId: null },
      { new: true }
    );

    return res.status(200).send({ data: "success" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const activateTruck = async (req, res) => {
  try {
    const { truckId, activate } = req.body;

    if (!truckId) {
      return res.status(400).send({ error: "no truckId provided" });
    }
    const truck = await TruckModel.findById({
      _id: truckId,
    });

    if (!truck) {
      return res.status(400).send({ error: "truck does not exist" });
    }
    if (truck.active && activate) {
      return res.status(400).send({ error: "truck is already active" });
    }

    if (
      activate === true &&
      (!truck?.carDocs?.proofOfOwnership?.imageUrl?.link ||
        !truck?.carDocs?.proofOfInsurance?.imageUrl?.link ||
        !truck?.carDocs?.roadWorthyNess?.imageUrl?.link ||
        !truck?.carDocs?.vehicleLicense?.imageUrl?.link)
    ) {
      return res.status(400).send({ error: "missing truck documents" });
    }

    if (
      activate === true &&
      (new Date() >
        new Date(truck?.carDocs?.proofOfInsurance?.imageUrl?.expiryDate) ||
        new Date() >
          new Date(truck?.carDocs?.roadWorthyNess?.imageUrl?.expiryDate) ||
        new Date() >
          new Date(truck?.carDocs?.vehicleLicense?.imageUrl?.expiryDate) ||
        new Date() >
          new Date(truck?.carDocs?.proofOfOwnership?.imageUrl?.expiryDate))
    ) {
      return res
        .status(400)
        .send({ error: "one or more of truck documents has expired" });
    }
    const update = await TruckModel.findByIdAndUpdate(
      { _id: truckId },
      {
        active: activate || false,
        status: activate ? "Available" : "Inactive",
      },
      { new: true }
    );
    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getAvailableTrucks = async (req, res) => {
  try {
    const { organisationId } = req.query;
    if (!organisationId) {
      return res.status(400).send({ error: "no organisationId provided" });
    }
    const trucks = await TruckModel.find({
      active: true,
      disabled: false,
      organisationId,
      status: "Available",
    });

    return res.status(200).send({ data: trucks });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const addTruckRemark = async (req, res) => {
  try {
    const { _id, remarkObj } = req.body;

    const { remark, userId } = remarkObj;

    if (!_id) return res.status(400).send({ error: "trip_id is required" });
    if (!remark) return res.status(400).send({ error: "empty remark " });

    if (!userId)
      return res.status(400).send({ error: "current userId is required " });
    const trip = await TruckModel.findById({ _id });
    if (!trip) return res.status(400).send({ error: "trip not found" });
    remarkObj.date = new Date();
    const updateRemark = await TruckModel.findByIdAndUpdate(
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
    const updateTruck = await TruckModel.findByIdAndUpdate(
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

const deleteTruckRemark = async (req, res) => {
  try {
    const { truckId, remarkId, userId } = req.body;
    if (!truckId) return res.status(400).send({ error: "truckId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });

    const truck = await TruckModel.findById(truckId);

    if (!truck) return res.status(400).send({ error: "truck not found" });
    const param = { truckId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationTruckRemark(
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
      details: `deleted remark on truck`,
    };

    const updateRemark = await TruckModel.findByIdAndUpdate(
      {
        _id: truckId,
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
const editTruckRemark = async (req, res) => {
  try {
    const { truckId, remarkId, userId, remark } = req.body;
    if (!truckId) return res.status(400).send({ error: "truckId is required" });
    if (!remarkId)
      return res.status(400).send({ error: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ error: "current userId is required" });
    if (!remark) return res.status(400).send({ error: "remark is required" });

    const truck = await TruckModel.findById({
      _id: truckId,
    });
    if (!truck) return res.status(400).send({ error: "truck not found" });
    const param = { truckId, remarkId, userId };
    const canPerformAction = await canDeleteOrEditOrganisationTruckRemark(
      param
    );
    if (!canPerformAction)
      return res
        .status(400)
        .send({ error: "you dont have the permission to edit this remark" });

    const updateRemark = await TruckModel.updateOne(
      {
        _id: truckId,
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
      details: `edited remark on truck`,
    };
    const updateTruck = await TruckModel.findByIdAndUpdate(
      { _id: truckId },
      { $push: { logs: log } },
      { new: true }
    );

    return res.status(200).send({ data: updateRemark });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const getTruckRemarks = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send({ error: "truck _id is required" });
    const truck = await TruckModel.aggregate([
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

    const remarks = truck[0]?.remarks;

    if (!remarks || remarks?.length === 0) return res.status(200).send([]);

    return res.status(200).send({
      data: remarks,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  createTruck,
  getTruck,
  getTruckByParam,
  getTrucks,
  deleteTruck,
  editTruck,
  restoreTruck,
  uploadTruckDoc,
  assignTruckDriver,
  activateTruck,
  assignPartnerTruck,
  removePartnerTruck,
  getPartnerTrucks,
  getAvailableTrucks,
  getTruckRemarks,
  addTruckRemark,
  deleteTruckRemark,
  editTruckRemark,
};
