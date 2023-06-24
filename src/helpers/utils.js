const fs = require("fs");
const PaymentModel = require("../models/payment");

const deleteLocalFile = async (path) => {

  return new Promise((resolve) => {
    fs.unlink(path, (error) => {
      error && console.log("WARNING:: Delete local file", error);
      resolve();
    });
  });
};
const numberWithCommas = (x) => {
  return x?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const getPaidAndAmountDue = async (trip) => {
  let paid = 0;
  let amountDue = trip?.amount;
  const shortageAmount = trip?.shortage?.shortageAmount;
  if (shortageAmount) {
    amountDue = amountDue - shortageAmount;
  }

  const { requestId } = trip;
  if (!requestId) return { paid, amountDue };

  const payments = await PaymentModel.find(
    { disabled: false, "requestIds.requestId": requestId },
    {
      requestIds: 1,
    }
  ).lean();

  if (payments?.length === 0) return { paid, amountDue };
  const requestIds = payments.map((payment) => payment.requestIds);
  const requestPayments = requestIds
    .flat()
    .filter((payment) => payment?.requestId === requestId);
  paid = requestPayments.reduce((acc, payment) => {
    return acc + payment?.amount;
  }, 0);

  amountDue = trip?.amount - paid;
  return { paid, amountDue };
};
const getPaidAndAmountDueExcludeInvoicePayment = async (trip) => {
  let paid = 0;
  let amountDue = trip?.amount;
  const shortageAmount = trip?.shortage?.shortageAmount;
  if (shortageAmount) {
    amountDue = amountDue - shortageAmount;
  }


  const { requestId } = trip;
  if (!requestId) return { paid, amountDue };

  const payments = await PaymentModel.find(
    {
      disabled: false,
      "requestIds.requestId": requestId,
      invoiceId: { $exists: false },
    },

    {
      requestIds: 1,
    }
  ).lean();

  if (payments?.length === 0) return { paid, amountDue };
  const requestIds = payments.map((payment) => payment.requestIds);
  const requestPayments = requestIds
    .flat()
    .filter((payment) => payment?.requestId === requestId);
  paid = requestPayments.reduce((acc, payment) => {
    return acc + payment?.amount;
  }, 0);

  amountDue = trip?.amount - paid;
  return { paid, amountDue };
};
const getName = (contact) => {
  if (contact?.companyName) return contact?.companyName;
  if (contact?.firstName && contact?.lastName)
    return `${contact?.firstName} ${contact?.lastName}`;
  if (contact?.firstName) return contact?.firstName;
  if (contact?.lastName) return contact?.lastName;
  return null;
};
function onlyUnique(value, index, array) {
  return array.indexOf(value) === index;
}

module.exports = {
  deleteLocalFile,
  numberWithCommas,
  getPaidAndAmountDue,
  getPaidAndAmountDueExcludeInvoicePayment,
  getName,
  onlyUnique,
};
