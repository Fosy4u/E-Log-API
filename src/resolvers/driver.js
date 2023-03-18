const DriverModel = require("../models/driver");
const { storageRef } = require("../config/firebase"); // reference to our db
const root = require("../../root");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const { deleteLocalFile } = require("../helpers/utils");

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
        destination: `/drivers/${filename}`,
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
      }).catch((err) => {
        console.log("err is", err);
        return false;
      });;
  }
};

const createDriver = async (req, res) => {
  const {
    organisationId,
    firstName,
    lastName,
    phoneNo,
    licenseExpiryDate,
    licenseNo,
    address,
    userId,
  } = req.body;
  try {
    if (
      !address ||
      !organisationId ||
      !firstName ||
      !lastName ||
      !phoneNo ||
      !licenseExpiryDate ||
      !licenseNo
    ) {
      return res.status(400).json({
        error: "Please fill all fields",
      });
    }
    if (!userId) {
      return res.status(400).json({
        error: "Please provide logged in user id",
      });
    }
    const driver = await DriverModel.findOne({ phoneNo });
    if (driver) {
      return res.status(400).json({
        error: "Driver already exists",
      });
    }
    if (req.file) {
      const imageUrl = await addImage(req, req.file.filename);
      const newDriver = new DriverModel({
        organisationId,
        firstName,
        lastName,
        phoneNo,
        address,
        licenseExpiryDate,
        licenseNo,
        imageUrl,
      });
      const newContact = await newDriver.save();
      if (newContact) {
        const log = {
          date: new Date(),
          userId: userId,
          action: "create",
          details: `Driver - ${newContact.firstName} ${newContact.lastName} created`,
          reason: `added new driver`,
        };

        const updateLog = await DriverModel.findByIdAndUpdate(
          newContact._id,
          // { name, category, price },

          { $push: { logs: log } },
          { new: true }
        );
        return res
          .status(200)
          .send({ message: "Driver created successfully", data: newContact });
      }
    } else {
      const newDriver = new DriverModel({
        organisationId,
        firstName,
        lastName,
        phoneNo,
        licenseExpiryDate,
        licenseNo,
        address,
      });
      const savedDriver = await newDriver.save();
      if (savedDriver) {
        const log = {
          date: new Date(),
          userId: userId,
          action: "create",
          details: `Driver - ${savedDriver.firstName} ${savedDriver.lastName} created`,
          reason: `added new driver`,
        };

        const updateLog = await DriverModel.findByIdAndUpdate(
          savedDriver._id,
          // { name, category, price },

          { $push: { logs: log } },
          { new: true }
        );
        return res.status(201).json({
          message: "Driver created successfully",
          data: savedDriver,
        });
      }
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getDrivers = async (req, res) => {
  try {
    const { organisationId, disabled } = req.query;
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisationId",
      });
    }
    const drivers = await DriverModel.find({
      organisationId,
      disabled: disabled || false,
    });
    if (!drivers) {
      return res.status(404).json({
        error: "No drivers found",
      });
    }
    return res.status(200).json({
      message: "Drivers fetched successfully",
      data: drivers,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getDriver = async (req, res) => {
  try {
    const { driverId } = req.query;
    if (!driverId) {
      return res.status(400).json({
        error: "Please provide driverId",
      });
    }
    const driver = await DriverModel.findById({ _id: driverId });
    if (!driver) {
      return res.status(404).json({
        error: "Driver not found",
      });
    }
    return res.status(200).json({
      message: "Driver fetched successfully",
      data: driver,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getDriverByParam = async (req, res) => {
  try {
    const param = req.query;
    const organisationId = req.query.organisationId;
    if (!organisationId) {
      return res.status(400).json({
        error: "Please provide organisationId ",
      });
    }
    const driver = await DriverModel.findOne({ ...param });
    if (!driver) {
      return res.status(200).json({});
    }
    return res.status(200).json({
      message: "Driver fetched successfully",
      data: driver,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const editDriver = async (req, res) => {
  try {
    const { driverId, userId } = req.body;
    if (!driverId) {
      return res.status(400).json({
        error: "Please provide driverId",
      });
    }
    const driver = await DriverModel.findById({ _id: driverId });
    if (!userId) {
      return res.status(400).json({
        error: "Please provide userId",
      });
    }
    if (!driver) {
      return res.status(404).json({
        error: "Driver not found",
      });
    }
    const difference = [];
    const oldData = driver;
    const newData = req.body;
    for (const key in newData) {
      if (
        oldData[key] !== newData[key] &&
        key !== "_id" &&
        key !== "driverId" &&
        key !== "logs" &&
        key !== "logs" &&
        key !== "createdAt" &&
        key !== "updatedAt" &&
        key !== "file" &&
        key !== "__v" &&
        key !== "organisationId" &&
        key !== "disabled" &&
        key !== "userId"
      ) {
        difference.push({
          field: key,
          old: oldData[key],
          new: newData[key],
        });
      }
    }
    console.log("diff", difference);
    let driverImage = " ";
    if (req.file) {
      const { licenseUpload } = req.body;
      let imageUrl = driver?.imageUrl || {};
      let driversLicense = driver?.driversLicense || {};
      if (!licenseUpload) {
        imageUrl = await addImage(req, req.file.filename);
        driverImage = driver?.imageUrl?.name;
      }
      if (licenseUpload) {
        driversLicense = await addImage(req, req.file.filename);
        driverImage = driver?.driversLicense?.name;
      }
      const updatedDriver = await DriverModel.findByIdAndUpdate(
        { _id: driverId },
        {
          ...req.body,
          imageUrl,
          driversLicense,
        },
        { new: true }
      );
      if (driverImage && updatedDriver) {
        const deletePrevImageFromFireBase = Promise.resolve(
          deleteImageFromFirebase(driverImage)
        );
      }
      if (updatedDriver) {
        const log = {
          date: new Date(),
          userId: userId,
          action: "edit",
          details: `Driver - ${updatedDriver?.firstName} ${updatedDriver?.lastName} edited`,
          reason: `edited driver`,
          difference,
        };

        const updateLog = await DriverModel.findByIdAndUpdate(
          updatedDriver._id,
          // { name, category, price },

          { $push: { logs: log } },
          { new: true }
        );
      }
      return res.status(200).json({
        message: "Driver updated successfully",
        data: updatedDriver,
      });
    } else {
      const updatedDriver = await DriverModel.findByIdAndUpdate(
        { _id: driverId },
        {
          ...req.body,
        },
        { new: true }
      );
      if (updatedDriver) {
        const log = {
          date: new Date(),
          userId: userId,
          action: "edit",
          details: `Driver - ${updatedDriver?.firstName} ${updatedDriver?.lastName} edited`,
          reason: `edited driver`,
          difference,
        };

        const updateLog = await DriverModel.findByIdAndUpdate(
          updatedDriver._id,
          // { name, category, price },

          { $push: { logs: log } },
          { new: true }
        );
      }
      return res.status(200).json({
        message: "Driver updated successfully",
        data: updatedDriver,
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const validateDriver = async (ids) => {
  const invalidDrivers = await ids.reduce(async (acc, item) => {
    let invalid = await acc;
    const id = item;

    const found = await DriverModel.findById(id);

    if (!found) {
      invalid.push(id);
    }

    return invalid;
  }, []);

  return invalidDrivers;
};

const deleteDriverModel = async (ids, userId) => {
  return ids.reduce(async (acc, _id) => {
    const result = await acc;
    const update = await DriverModel.findByIdAndUpdate(
      _id,

      { disabled: true, status: "deleted", active: false },
      { new: true }
    );

    const deletedDriver = update?._id;
    console.log("deletedDriver", deletedDriver);
    if (deletedDriver) {
      const log = {
        date: new Date(),
        userId: userId,
        action: "delete",
        details: `Driver - ${deletedDriver.firstName} ${deletedDriver.lastName} deleted`,
        reason: `deleted driver`,
      };

      const updateLog = await DriverModel.findByIdAndUpdate(
        deletedDriver._id,
        // { name, category, price },

        { $push: { logs: log } },
        { new: true }
      );
      console.log("update", updateLog);
    } else {
      result.push(_id);
    }

    return result;
  }, []);
};

const restoreDriverModel = async (ids, userId) => {
  return ids.reduce(async (acc, _id) => {
    const result = await acc;
    const update = await DriverModel.findByIdAndUpdate(
      _id,

      { disabled: false, status: "Inactive" },
      { new: true }
    );

    const restoredDriver = update?._id;
    if (restoredDriver) {
      const log = {
        date: new Date(),
        userId: userId,
        action: "restore",
        details: `Driver - ${update.firstName} ${update.lastName} restored`,
        reason: `restored driver`,
      };

      const updateLog = await DriverModel.findByIdAndUpdate(
        restoredDriver._id,
        // { name, category, price },

        { $push: { logs: log } },
        { new: true }
      );

      console.log("update", updateLog);
    } else {
      result.push(_id);
    }

    return result;
  }, []);
};

const deleteDriver = async (req, res) => {
  const { ids, userId } = req.body;
  try {
    if (!userId) {
      return res.status(400).json({
        error: "Please provide userId",
      });
    }
    if (!ids || ids.length === 0) {
      return res.status(400).json({
        error: "Please provide ids",
      });
    }
    const invalidDrivers = await validateDriver(ids);
    if (invalidDrivers.length > 0) {
      return res.status(400).send({
        error: `request failed as the following driver(s)  ${
          invalidDrivers.length > 1 ? " do" : " does"
        } not exist. Please contact FosyTech support if this error persist unexpectedly : [${invalidDrivers}]`,
      });
    }

    const deletedDriver = await deleteDriverModel(ids, userId);
    Promise.resolve(deletedDriver).then((result) => {
      if (result.length > 0) {
        return res.status(400).send({
          error: `request failed. Please ensure you have good internet. if error persists, contact NemFra Tech support`,
        });
      }

      return res.status(200).send({ data: "success" });
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const restoreDriver = async (req, res) => {
  const { ids, userId } = req.body;
  try {
    if (!userId) {
      return res.status(400).json({
        error: "Please provide userId",
      });
    }
    if (!ids || ids.length === 0) {
      return res.status(400).json({
        error: "Please provide ids",
      });
    }
    const invalidDrivers = await validateDriver(ids);
    if (invalidDrivers.length > 0) {
      return res.status(400).send({
        error: `request failed as the following driver(s)  ${
          invalidDrivers.length > 1 ? " do" : " does"
        } not exist. Please contact FosyTech support if this error persist unexpectedly : [${invalidDrivers}]`,
      });
    }

    const restoredDriver = await restoreDriverModel(ids, userId);

    if (restoredDriver.length > 0) {
      return res.status(400).send({
        error: `request failed. Please ensure you have good internet. if error persists, contact NemFra Tech support`,
      });
    }

    return res.status(200).send({ data: "success" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const uploadDriverDoc = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ error: "no file uploaded" });
    }

    const { _id } = req.body;
    if (!_id) {
      return res.status(400).send({ error: "no driver id provided" });
    }
    const driver = await DriverModel.findById(_id);
    if (!driver) {
      return res.status(400).send({ error: "driver does not exist" });
    }
    const filename = req.file.filename;
    const imageUrl = await addImage(req, filename);

    const update = await DriverModel.findByIdAndUpdate(
      { _id },
      { driversLicense: imageUrl },
      { new: true }
    );

    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

const activateDriver = async (req, res) => {
  try {
    const { _id, activate, userId } = req.body;
    if (!_id) {
      return res.status(400).send({ error: "no driver id provided" });
    }
    if (!userId) {
      return res.status(400).send({ error: "no user id provided" });
    }
    const driver = await DriverModel.findById({ _id });
    if (!driver) {
      return res.status(400).send({ error: "driver does not exist" });
    }
    if (!driver?.driversLicense?.link) {
      return res.status(400).send({ error: "driver license not uploaded" });
    }
    if (new Date() > new Date(driver?.licenseExpiryDate)) {
      return res.status(400).send({ error: "driver license has expired" });
    }
    const update = await DriverModel.findByIdAndUpdate(
      { _id },
      {
        active: activate || false,
        status: activate ? "available" : "inactive",
      },
      { new: true }
    );
    if (update) {
      const log = {
        date: new Date(),
        userId: userId,
        action: activate ? "activate" : "deactivate",
        details: `Driver - ${update.firstName} ${update.lastName} ${
          activate ? "activated" : "deactivated"
        }`,
        reason: `${activate ? "activated" : "deactivated"} driver`,
      };

      const updateLog = await DriverModel.findByIdAndUpdate(
        update._id,
        // { name, category, price },

        { $push: { logs: log } },
        { new: true }
      );
    }
    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};
module.exports = {
  createDriver,
  getDriver,
  getDriverByParam,
  editDriver,
  deleteDriver,
  restoreDriver,
  getDrivers,
  uploadDriverDoc,
  activateDriver,
};
