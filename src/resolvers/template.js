const TemplateModel = require("../models/template");
const validator = require("html-validator");
const { v4: uuidv4 } = require("uuid");

function getRandomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const generateUniqueCode = async (organisationId) => {
  let code;
  let found = true;

  do {
    const randomVal = getRandomInt(1000000, 9999999);
    code = `${randomVal}`;
    const exist = await TemplateModel.findOne(
      {
        organisationId,
        "maintenanceTasks.maintenanceId": code.toString(),
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

const getTemplate = async (req, res) => {
  try {
    const { organisationId } = req.query;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    const templates = await TemplateModel.findOne({ organisationId }).lean();
    if (!templates)
      return res.status(400).send({ error: " - no templates found" });
    let maintenanceTasks = templates.maintenanceTasks.map((task) => {
      return {
        ...task,
        serviceEntries: 0,
        serviceReminders: 0,
        servicePrograms: 0,
      };
    });
    templates.maintenanceTasks = maintenanceTasks;

    return res.status(200).send({ data: templates });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const addTyreBrand = async (req, res) => {
  try {
    const { organisationId, brand } = req.body;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!brand) return res.status(400).send({ error: " - brand not provided" });
    const templates = await TemplateModel.findOne({ organisationId });
    if (!templates)
      return res.status(400).send({ error: " - no templates found" });
    const tyreBrands = templates.tyreBrands;
    const tyreBrand = tyreBrands.find(
      (tyreBrand) => tyreBrand.toLowerCase() === brand.toLowerCase()
    );
    if (tyreBrand)
      return res.status(400).send({ error: " - brand already exists" });
    tyreBrands.push(brand);
    const update = await TemplateModel.findOneAndUpdate(
      { organisationId },
      { tyreBrands },
      { new: true }
    );
    if (!update) return res.status(400).send({ error: " - brand not added" });
    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const deleteTyreBrand = async (req, res) => {
  try {
    const { organisationId, brand } = req.body;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!brand) return res.status(400).send({ error: " - brand not provided" });
    const templates = await TemplateModel.findOne({ organisationId });
    if (!templates)
      return res.status(400).send({ error: " - no templates found" });
    const tyreBrands = templates.tyreBrands;
    const tyreBrand = tyreBrands.find(
      (tyreBrand) => tyreBrand.toLowerCase() === brand.toLowerCase()
    );
    if (!tyreBrand)
      return res.status(400).send({ error: " - brand does not exist" });
    const index = tyreBrands.indexOf(brand);
    tyreBrands.splice(index, 1);
    const update = await TemplateModel.findOneAndUpdate(
      { organisationId },
      { tyreBrands },
      { new: true }
    );
    if (!update) return res.status(400).send({ error: " - brand not deleted" });
    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const editTyreBrand = async (req, res) => {
  try {
    const { organisationId, brand, newValue } = req.body;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!brand) return res.status(400).send({ error: " - brand not provided" });
    if (!newValue)
      return res.status(400).send({ error: " - newValue not provided" });
    const templates = await TemplateModel.findOne({ organisationId });
    if (!templates)
      return res.status(400).send({ error: " - no templates found" });
    const tyreBrands = templates.tyreBrands;
    const tyreBrand = tyreBrands.find(
      (tyreBrand) => tyreBrand.toLowerCase() === brand.toLowerCase()
    );
    if (!tyreBrand)
      return res.status(400).send({ error: " - brand does not exist" });
    const index = tyreBrands.indexOf(brand);
    tyreBrands.splice(index, 1, newValue);
    const update = await TemplateModel.findOneAndUpdate(
      { organisationId },
      { tyreBrands },
      { new: true }
    );
    if (!update) return res.status(400).send({ error: " - brand not deleted" });
    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const addMaintenanceTask = async (req, res) => {
  try {
    const { organisationId, name, description } = req.body;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!name)
      return res.status(400).send({ error: " - task name not provided" });
    const templates = await TemplateModel.findOne({ organisationId });
    if (!templates)
      return res.status(400).send({ error: " - no templates found" });
    const maintenanceTasks = templates.maintenanceTasks;
    const maintenanceTask = maintenanceTasks.find(
      (maintenanceTask) =>
        maintenanceTask?.name.toLowerCase() === name.toLowerCase()
    );
    if (maintenanceTask)
      return res.status(400).send({ error: " - task already exists" });
    const maintenanceId = await generateUniqueCode(organisationId);
    maintenanceTasks.push({
      name,
      description,
      serviceEntries: 0,
      serviceReminders: 0,
      servicePrograms: 0,
      maintenanceId,
    });
    const update = await TemplateModel.findOneAndUpdate(
      { organisationId },
      { maintenanceTasks },
      { new: true }
    );
    if (!update)
      return res.status(400).send({ error: " - maintenance task not added" });
    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const deleteMaintenanceTask = async (req, res) => {
  try {
    const { organisationId, taskIds } = req.body;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (taskIds?.length === 0)
      return res.status(400).send({ error: " - taskId not provided" });
    const templates = await TemplateModel.findOne({ organisationId });
    if (!templates)
      return res.status(400).send({ error: " - no templates found" });
    const maintenanceTasks = templates.maintenanceTasks;

    const filteredTasks = maintenanceTasks.filter((task) => {
      return !taskIds.includes(task._id.toString());
    });

    const update = await TemplateModel.findOneAndUpdate(
      { organisationId },
      { maintenanceTasks: filteredTasks },
      { new: true }
    );
    if (!update)
      return res.status(400).send({ error: " - maintenance task not deleted" });
    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const editMaintenanceTask = async (req, res) => {
  try {
    const { organisationId, taskId, name, description } = req.body;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!taskId)
      return res.status(400).send({ error: " - taskId not provided" });
    if (name && (name === "" || name === null || name === "undefined"))
      return res.status(400).send({ error: " - task name not provided" });
    const templates = await TemplateModel.findOne({ organisationId });
    if (!templates)
      return res.status(400).send({ error: " - no templates found" });
    const maintenanceTasks = templates.maintenanceTasks;
    const maintenanceTask = maintenanceTasks.find(
      (maintenanceTask) => maintenanceTask?._id?.toString() === taskId
    );
    if (!maintenanceTask)
      return res.status(400).send({ error: " - task does not exist" });
    const index = maintenanceTasks.indexOf(maintenanceTask);
    if (name) maintenanceTasks[index].name = name;
    if (description) maintenanceTasks[index].description = description;
    const update = await TemplateModel.findOneAndUpdate(
      { organisationId },
      { maintenanceTasks },
      { new: true }
    );
    if (!update)
      return res.status(400).send({ error: " - maintenance task not updated" });
    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const addTyreSize = async (req, res) => {
  try {
    const { organisationId, size } = req.body;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!size) return res.status(400).send({ error: " - size not provided" });
    const templates = await TemplateModel.findOne({ organisationId });
    if (!templates)
      return res.status(400).send({ error: " - no templates found" });
    const tyreSizes = templates.tyreSizes;
    const tyreSize = tyreSizes.find(
      (tyreSize) => tyreSize.toLowerCase() === size.toLowerCase()
    );
    if (tyreSize)
      return res.status(400).send({ error: " - size already exists" });
    tyreSizes.push(size);
    const update = await TemplateModel.findOneAndUpdate(
      { organisationId },
      { tyreSizes },
      { new: true }
    );
    if (!update) return res.status(400).send({ error: " - size not added" });
    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const deleteTyreSize = async (req, res) => {
  try {
    const { organisationId, size } = req.body;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!size) return res.status(400).send({ error: " - size not provided" });
    const templates = await TemplateModel.findOne({ organisationId });
    if (!templates)
      return res.status(400).send({ error: " - no templates found" });
    const tyreSizes = templates.tyreSizes;
    const tyreSize = tyreSizes.find(
      (tyreSize) => tyreSize.toLowerCase() === size.toLowerCase()
    );
    if (!tyreSize)
      return res.status(400).send({ error: " - size does not exist" });
    const index = tyreSizes.indexOf(size);
    tyreSizes.splice(index, 1);
    const update = await TemplateModel.findOneAndUpdate(
      { organisationId },
      { tyreSizes },
      { new: true }
    );
    if (!update) return res.status(400).send({ error: " - size not deleted" });
    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const editTyreSize = async (req, res) => {
  try {
    const { organisationId, size, newValue } = req.body;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!size) return res.status(400).send({ error: " - size not provided" });
    if (!newValue)
      return res.status(400).send({ error: " - newValue not provided" });
    const templates = await TemplateModel.findOne({ organisationId });
    if (!templates)
      return res.status(400).send({ error: " - no templates found" });
    const tyreSizes = templates.tyreSizes;
    const tyreSize = tyreSizes.find(
      (tyreSize) => tyreSize.toLowerCase() === size.toLowerCase()
    );
    if (!tyreSize)
      return res.status(400).send({ error: " - size does not exist" });
    const index = tyreSizes.indexOf(size);
    tyreSizes.splice(index, 1, newValue);
    const update = await TemplateModel.findOneAndUpdate(
      { organisationId },
      { tyreSizes },
      { new: true }
    );
    if (!update) return res.status(400).send({ error: " - size not deleted" });
    return res.status(200).send({ data: update });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const addEmailTemplate = async (req, res) => {
  try {
    const { organisationId, type, body } = req.body;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!type) return res.status(400).send({ error: " - type not provided" });
    if (!body) return res.status(400).send({ error: " - body not provided" });
    // check if body is valid html

    const options = {
      validator: "WHATWG",
      data: body,
      isFragment: true,
    };
    try {
      const result = await validator(options);
      console.log(result);
    } catch (error) {
      console.error(error);
      return res.status(400).send({ error: error.message });
    }
    const emailTemplate = {
      type,
      body,
    };
    const existingType = await TemplateModel.findOne({
      organisationId,
      "emailTemplates.type": type,
    });
    let updateTemplate;
    if (existingType) {
      //replace existing template
      updateTemplate = await TemplateModel.findOneAndUpdate(
        { organisationId, "emailTemplates.type": type },
        { $set: { "emailTemplates.$": emailTemplate } },
        { new: true }
      );
    } else {
      updateTemplate = await TemplateModel.findOneAndUpdate(
        { organisationId },
        { $push: { emailTemplates: emailTemplate } },
        { new: true }
      );
    }
    if (!updateTemplate)
      return res.status(400).send({ error: " - template not added" });
    return res.status(200).send({ data: updateTemplate });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const deleteEmailTemplate = async (req, res) => {
  try {
    const { organisationId, emailTemplateId } = req.body;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!emailTemplateId)
      return res.status(400).send({ error: " - emailTemplateId not provided" });

    const updateTemplate = await TemplateModel.findOneAndUpdate(
      { organisationId },
      { $pull: { emailTemplates: { _id: emailTemplateId } } },
      { new: true }
    );
    if (!updateTemplate)
      return res.status(400).send({ error: " - template not deleted" });
    return res.status(200).send({ data: updateTemplate });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const editEmailTemplate = async (req, res) => {
  try {
    const { organisationId, emailTemplateId, body } = req.body;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    if (!emailTemplateId)
      return res.status(400).send({ error: " - emailTemplateId not provided" });
    if (!body) return res.status(400).send({ error: " - body not provided" });

    const options = {
      validator: "WHATWG",
      data: body,
      isFragment: true,
    };
    try {
      const result = await validator(options);
      console.log(result);
    } catch (error) {
      console.error(error);
      return res.status(400).send({ error: error.message });
    }
    const updateTemplate = await TemplateModel.findOneAndUpdate(
      { organisationId, "emailTemplates._id": emailTemplateId },
      { $set: { "emailTemplates.$.body": body } },
      { new: true }
    );
    if (!updateTemplate)
      return res.status(400).send({ error: " - template not edited" });
    return res.status(200).send({ data: updateTemplate });
  } catch (error) {
    console.log("err", error);
    return res.status(500).send(error.message);
  }
};

module.exports = {
  getTemplate,
  addTyreBrand,
  deleteTyreBrand,
  editTyreBrand,
  addTyreSize,
  deleteTyreSize,
  editTyreSize,
  addEmailTemplate,
  deleteEmailTemplate,
  editEmailTemplate,
  addMaintenanceTask,
  deleteMaintenanceTask,
  editMaintenanceTask,
};
