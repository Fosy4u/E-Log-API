const nodemailer = require("nodemailer");
const creds = require("../config/nodemailerConfig");
const generatePdf = require("../pdf/pdfConverter");
const { ENV } = require("../config");
const InvoiceModel = require("../models/invoice");
const PaymentModel = require("../models/payment");
const { onlyUnique } = require("../helpers/utils");

const url =
  ENV === "prod"
    ? process.env.DOC_DOWNLOAD_URL_PROD
    : process.env.DOC_DOWNLOAD_URL_DEV;
const transport = {
  host: "mail.privateemail.com", // your_host_here
  //   host: "smtp.mail.yahoo.com.", // your_host_here
  auth: {
    user: creds.USER,
    pass: creds.PASS,
    authMethod: "PLAIN",
  },
  // tls: {
  //     rejectUnauthorized: false
  // },
  // port: 993,
};
const transporter = nodemailer.createTransport(transport);
transporter.verify((error, success) => {
  if (error) {
    console.log("err", error);
  } else {
    console.log("All works fine, congratz!");
  }
});

const sendEmail = async (req, res) => {
  try {
    const {
      from,
      to,
      subject,
      body,
      replyTo,
      cc,
      bcc,
      attach,
      type,
      id,
      userId,
      fileName,
      socketId,
    } = req.body;
    if (!from || !to || !subject || !body) {
      return res.status(400).send({ error: "All fields are required" });
    }
    if (!type) {
      return res.status(400).send({ error: "Type is required" });
    }
    if (!userId) return res.status(400).send({ error: "userId is required" });
    if (!id) {
      return res.status(400).send({ error: "Id is required" });
    }
    if (type !== "invoice" && type !== "receipt") {
      return res.status(400).send({ error: "Invalid type" });
    }
    if (!socketId) {
      return res.status(400).send({ error: "Socket id is required" });
    }
    // Get the socket connection from Express app
    const io = req.app.get("io");
    const sockets = req.app.get("sockets");
    console.log("sockets", sockets);

    const thisSocketId = sockets[socketId];
    console.log("thisSocketId", thisSocketId);
    const socketInstance = io.to(thisSocketId);
    console.log("socketInstance", socketInstance);
    // Emit the event to the client
    socketInstance.emit("emailProgress", {
      progress: 0,
      status: "Getting ready...",
    });

    let log;
    let item = {};
    if (type === "invoice" && attach) {
      socketInstance.emit("emailProgress", {
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
      log = {
        date: new Date(),
        userId: userId,
        action: "stamp",
        details: `Invoice - marked as sent`,
        reason: `Invoice sent to recipient`,
      };
      item = invoice;
    }
    if (type === "receipt" && attach) {
      socketInstance.emit("emailProgress", {
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
      log = {
        date: new Date(),
        userId: userId,
        action: "stamp",
        details: `Receipt - marked as sent`,
        reason: `Receipt sent to recipient`,
      };
      item = payment;
    }

    let pdf;
    let attachments = [];

    if (attach) {
      socketInstance.emit("emailProgress", {
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
      attachments = [
        {
          filename: pdfFilename,
          content: pdf,
          contentType: "application/pdf",
        },
      ];
    }
    socketInstance.emit("emailProgress", {
      progress: 70,
      status: "Sending email...",
    });
    const mail = {
      from,
      to: to.map((email) => email),
      subject,
      html: body,
      attachDataUrls: true,
      replyTo: replyTo,
      cc: cc.map((email) => email),
      bcc: bcc.map((email) => email),
      attachments,
    };

    const response = await transporter.sendMail(mail, (err, data) => {
      if (err) {
        console.log("err", err);
        return res.status(500).send({ error: err.message });
      }
    });
    //get unique emails
    const receivedEmails = [...to, ...cc, ...bcc]
      .filter(onlyUnique)
      .map((email) => ({ email, date: new Date(), docAttached: attach }));
    let update;
    if (type === "invoice") {
      socketInstance.emit("emailProgress", {
        progress: 95,
        status: "Making invoice as sent...",
      });
      update = await InvoiceModel.findOneAndUpdate(
        { invoiceId: id },
        { sentToCustomer: true, $push: { logs: log, receivedEmails } },
        { new: true }
      );
    }
    if (type === "receipt") {
      socketInstance.emit("emailProgress", {
        progress: 95,
        status: "Making receipt as sent...",
      });
      update = await PaymentModel.findOneAndUpdate(
        { paymentId: id },
        { sentToCustomer: true, $push: { logs: log, receivedEmails } },
        { new: true }
      );
    }

    socketInstance.emit("emailProgress", {
      progress: 100,
      status: "Email sent successfully",
    });

    return res.status(200).send({ data: "Email sent successfully" });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  sendEmail,
};
