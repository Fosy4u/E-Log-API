const TemplateModel = require("../models/template");

const getTemplate = async (req, res) => {
  try {
    const { organisationId } = req.query;
    if (!organisationId)
      return res.status(400).send({ error: " - organisationId not provided" });
    const templates = await TemplateModel.findOne({ organisationId });
    if (!templates)
      return res.status(400).send({ error: " - no templates found" });
    return res.status(200).send({ data: templates });
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

module.exports = {
  getTemplate,
};
