const nodemailer = require("nodemailer");
const creds = require("../config/nodemailerConfig");
const generatePdf = require("../pdf/pdfConverter");
const { ENV } = require("../config");

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
    const { from, to, subject, body, replyTo, cc, bcc, attach, type, id } =
      req.body;
    if (!from || !to || !subject || !body) {
      return res.status(400).send({ error: "All fields are required" });
    }
    let pdf;
    let attachments = [];

    if (attach) {
      pdf = await generatePdf({
        type: "url",
        website_url: `${url}/${id}`,
      });
      attachments = [
        {
          filename: "result.pdf",
          content: pdf,
          contentType: "application/pdf",
        },
      ];
    }
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
      } else {
        console.log("data", data);

        return res.status(200).send({ message: "Email sent successfully" });
      }
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
};

module.exports = {
  sendEmail,
};
