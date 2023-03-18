const TruckModel = require("../models/truck");
const TripModel = require("../models/trip");
const DriverModel = require("../models/driver");
const OrganisationPartnerModel = require("../models/organisationPartner");
const { storageRef } = require("../config/firebase"); // reference to our db
const root = require("../../root");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");

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

    if (req.file) {
      const filename = req.file.filename;
      const imageUrl = await addImage(req, filename);

      const createTruck = new TruckModel({ ...req.body, imageUrl });
      const newTruck = await createTruck.save();

      if (!newTruck) {
        return res.status(400).send({ error: "error in adding truck" });
      }
      return res.status(200).send({ data: newTruck });
    } else {
      const createTruck = new TruckModel({ ...req.body });
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
    const truck = await TruckModel.findById({ _id: truckId });
    if (!truck) return res.status(400).send({ error: "no truck found" });
    return res.status(200).send({ data: truck });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
const getPartnerTrucks = async (req, res) => {
  try {
    const { partnerId } = req.query;
    if (!partnerId)
      return res.status(400).send({ error: "partnerId is required" });
    const truck = await TruckModel.find({ assignedPartnerId: partnerId });
    return res.status(200).send({ data: truck });
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
    const trucks = await TruckModel.find({ ...param });
    if (!trucks) return res.status(200).send([]);
    return res.status(200).send({ data: trucks });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const getTrucks = async (req, res) => {
  try {
    const { organisationId, disabled } = req.query;

    const trucks = await TruckModel.find({
      organisationId,
      disabled: disabled === "true" ? true : false,
    }, { remarks: 0, logs: 0, timeline: 0 });
    if (!trucks) return res.status(400).send({ error: "no truck found" });
    return res.status(200).send({ data: trucks });
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

const deleteTruckModel = async (ids) => {
  return ids.reduce(async (acc, _id) => {
    const result = await acc;
    const update = await TruckModel.findByIdAndUpdate(
      _id,

      { disabled: true, active: false, status: "deleted" },
      { new: true }
    );

    const deletedTruck = update?._id;

    if (!deletedTruck) {
      result.push(_id);
    }

    return result;
  }, []);
};

const restoreTruckModel = async (ids) => {
  return ids.reduce(async (acc, _id) => {
    const result = await acc;
    const update = await TruckModel.findByIdAndUpdate(
      _id,

      { disabled: false },
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
  const { ids } = req.body;
  try {
    const invalidTrucks = await validateTruck(ids);
    if (invalidTrucks.length > 0) {
      return res.status(400).send({
        error: `request failed as the following truck(s)  ${
          invalidTrucks.length > 1 ? " do" : " does"
        } not exist. Please contact FosyTech support if this error persist unexpectedly : [${invalidTrucks}]`,
      });
    }

    const failedRestoredTruck = await restoreTruckModel(ids);

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
  const { ids, images } = req.body;
  try {
    const invalidTrucks = await validateTruck(ids);
    if (invalidTrucks.length > 0) {
      return res.status(400).send({
        error: `request failed as the following truck(s)  ${
          invalidTrucks.length > 1 ? " do" : " does"
        } not exist. Please contact FosyTech support if this error persist unexpectedly : [${invalidTrucks}]`,
      });
    }

    const deletedTruck = await deleteTruckModel(ids);

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
    if (!req.body.imageUrl && req.file) {
      const { _id } = req.body;
      const filename = req.file.filename;
      const imageUrl = await addImage(req, filename);
      const truck = await TruckModel.findById(_id);
      if (!truck) {
        return res.status(400).send({ error: "truck does not exist" });
      }
      const truckImage = truck?.imageUrl?.name;

      const update = await TruckModel.findByIdAndUpdate(
        _id,

        { ...req.body, imageUrl },
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
      const { _id } = req.body;
      const update = await TruckModel.findByIdAndUpdate(
        _id,

        { ...req.body },
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
      !truck?.carDocs?.proofOfOwnership?.imageUrl?.link ||
      !truck?.carDocs?.proofOfInsurance?.imageUrl?.link ||
      !truck?.carDocs?.roadWorthyNess?.imageUrl?.link ||
      !truck?.carDocs?.vehicleLicense?.imageUrl?.link
    ) {
      return res.status(400).send({ error: "missing truck documents" });
    }
    if (
      new Date() >
        new Date(truck?.carDocs?.proofOfInsurance?.imageUrl?.expiryDate) ||
      new Date() >
        new Date(truck?.carDocs?.roadWorthyNess?.imageUrl?.expiryDate) ||
      new Date() >
        new Date(truck?.carDocs?.vehicleLicense?.imageUrl?.expiryDate) ||
      new Date() >
        new Date(truck?.carDocs?.proofOfOwnership?.imageUrl?.expiryDate)
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
};
