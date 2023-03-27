const fs = require("fs");
const IncomeModel = require("../models/income");

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

  const { requestId } = trip;
  if (!requestId) return { paid, amountDue };

  const incomes = await IncomeModel.find(
    { disabled: false, "requestIds.requestId": requestId },
    {
      requestIds: 1,
    }
  ).lean();

  if (incomes?.length === 0) return { paid, amountDue };
  const requestIds = incomes.map((income) => income.requestIds);
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

  const { requestId } = trip;
  if (!requestId) return { paid, amountDue };

  const incomes = await IncomeModel.find(
    {
      disabled: false,
      "requestIds.requestId": requestId,
      invoiceId: { $exists: false },
    },

    {
      requestIds: 1,
    }
  ).lean();

  if (incomes?.length === 0) return { paid, amountDue };
  const requestIds = incomes.map((income) => income.requestIds);
  const requestPayments = requestIds
    .flat()
    .filter((payment) => payment?.requestId === requestId);
  paid = requestPayments.reduce((acc, payment) => {
    return acc + payment?.amount;
  }, 0);

  amountDue = trip?.amount - paid;
  return { paid, amountDue };
};

module.exports = {
  deleteLocalFile,
  numberWithCommas,
  getPaidAndAmountDue,
  getPaidAndAmountDueExcludeInvoicePayment,
};
