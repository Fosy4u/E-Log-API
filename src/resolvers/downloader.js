const generatePdf = require("../pdf/pdfConverter");
const { ENV } = require("../config");
const InvoiceModel = require("../models/invoice");
const PaymentModel = require("../models/payment");

const url =
  ENV === "prod"
    ? process.env.DOC_DOWNLOAD_URL_PROD
    : process.env.DOC_DOWNLOAD_URL_DEV;

const downloadDoc = async (req, res) => {
  try {
    const { type, id, fileName, socketId } = req.body;

    if (!type) {
      return res.status(400).send({ error: "Type is required" });
    }

    if (!id) {
      return res.status(400).send({ error: "Id is required" });
    }
    if (type !== "invoice" && type !== "receipt") {
      return res.status(400).send({ error: "Invalid type" });
    }
    if (!socketId) {
      return res.status(400).send({ error: "Socket id is required" });
    }

    const io = req.app.get("io");
    const sockets = req.app.get("sockets");

    const thisSocketId = sockets[socketId];
    console.log("thisSocketId", thisSocketId);
    const socketInstance = io.to(thisSocketId);
   

    socketInstance.emit("downloadProgress", {
      progress: 0,
      status: "Getting ready...",
    });

    if (type === "invoice") {
      socketInstance.emit("downloadProgress", {
        progress: 10,
        status: "Getting invoice...",
      });
      const invoice = await InvoiceModel.findOne({
        invoiceId: id,
      });
      if (!invoice) {
        return res.status(400).send({
          error:
            "Encountered an error while verifying invoice to be attached. Please try again later or contact support if this continues",
        });
      }
    }
    if (type === "receipt") {
      socketInstance.emit("downloadProgress", {
        progress: 10,
        status: "Getting receipt...",
      });
      const payment = await PaymentModel.findOne({
        paymentId: id,
      });
      if (!payment) {
        return res.status(400).send({
          error:
            "Encountered an error while verifying receipt to be attached. Please try again later or contact support if this continues",
        });
      }
    }

    let pdf;

    socketInstance.emit("downloadProgress", {
      progress: 20,
      status: "Generating PDF...",
    });
    pdf = await generatePdf({
      type: "url",
      website_url: `${url}/${id}`,
    });

    const today = new Date();
    const pdfFilename = fileName
      ? `${fileName}.pdf`
      : `${type}-${id}-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}.pdf`;

    socketInstance.emit("downloadProgress", {
      progress: 90,
      status: "Sending PDF...",
    });

    return res.status(200).send({
      data: pdf,
      fileName: pdfFilename,
      message: "Downloaded successfully",
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  downloadDoc,
};
