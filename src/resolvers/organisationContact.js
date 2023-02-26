const ReceiptModel = require("../models/receipt");
const OrganisationContactModel = require("../models/organisationContact");
//const SaleModel = require("../models/sales");
const OrganisationUserModel = require("../models/organisationUsers");

const createOrganisationContact = async (req, res) => {
  const { organisationId } = req.body;
  try {
    if (!organisationId)
      return res.status(400).send({ message: "organisationId is required" });

    const params = {
      ...req.body,
    };
    const createContact = new OrganisationContactModel({ ...params });
    const newContact = await createContact.save();
    if (newContact) {
      const log = req.body.log;

      const updateLog = await OrganisationContactModel.findByIdAndUpdate(
        newContact._id,
        // { name, category, price },

        { $push: { logs: log } },
        { new: true }
      );
      return res.status(200).send(newContact);
    }
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const addOrganisationContactRemark = async (req, res) => {
  try {
    const { _id, remark } = req.body;
    if (!_id)
      return res.status(400).send({ message: "contact_id is required" });
    if (!remark) return res.status(400).send({ message: "empty remark " });
    const { userId } = remark;
    if (!userId)
      return res.status(400).send({ message: "current userId is required " });
    const contact = await OrganisationContactModel.findById({ _id });
    if (!contact) return res.status(400).send({ message: "contact not found" });
    const updateRemark = await OrganisationContactModel.findByIdAndUpdate(
      {
        _id,
      },
      {
        $push: {
          remarks: remark,
        },
      },
      { new: true }
    );
    const log = {
      date: new Date(),
      userId,
      action: "remark",
      reason: "added remark",
      details: `added remark on customer`,
    };
    const updateCustomer = await OrganisationContactModel.findByIdAndUpdate(
      { _id },
      { $push: { logs: log } },
      { new: true }
    );
    return res.status(200).send(updateRemark);
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const deleteOrganisationContactRemark = async (req, res) => {
  try {
    const { customerId, remarkId, userId } = req.body;
    if (!customerId)
      return res.status(400).send({ message: "customerId is required" });
    if (!remarkId)
      return res.status(400).send({ message: "remarkId is required" });
    if (!userId)
      return res.status(400).send({ message: "current userId is required" });

    const contact = await OrganisationContactModel.findById({
      _id: customerId,
    });
    if (!contact) return res.status(400).send({ message: "contact not found" });
    const updateRemark = await OrganisationContactModel.findByIdAndUpdate(
      {
        _id: customerId,
      },
      {
        $pull: {
          remarks: { _id: remarkId },
        },
      },
      { new: true }
    );
    const log = {
      date: new Date(),
      userId,
      action: "delete",
      reason: "deleted remark",
      details: `deleted remark on customer`,
    };
    const updateCustomer = await OrganisationContactModel.findByIdAndUpdate(
      { _id: customerId },
      { $push: { logs: log } },
      { new: true }
    );

    return res.status(200).send(updateRemark);
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const getOrganisationContactRemark = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id)
      return res.status(400).send({ message: "contact_id is required" });
    const contact = await OrganisationContactModel.findById({ _id })
      .select("remarks")
      .lean();
    const remarks = contact?.remarks;

    if (!remarks || remarks?.length === 0) return res.status(200).send([]);
    const clonedRemarks = [];
    const myPromise = remarks.map(async (item) => {
      const newItem = { ...item };
      const { userId } = newItem;
      if (userId) {
        const user = await OrganisationUserModel.findById({
          _id: userId,
        }).lean();
        if (user) {
          newItem.user = user;
        }
      }
      clonedRemarks.push(newItem);
    });
    await Promise.all(myPromise);
    return res.status(200).send(
      clonedRemarks.sort(function (a, b) {
        return new Date(b?.date) - new Date(a?.date);
      })
    );
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const getOrganisationContactLogs = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id)
      return res.status(400).send({ message: "contact_id is required" });
    const contact = await OrganisationContactModel.findById({ _id })
      .select("logs")
      .lean();
    const logs = contact?.logs;

    if (!logs || logs?.length === 0) return res.status(200).send([]);
    const clonedLogs = [];
    const myPromise = logs.map(async (item) => {
      const newItem = { ...item };
      const { userId } = newItem;
      if (userId) {
        const user = await OrganisationUserModel.findById({
          _id: userId,
        }).lean();
        if (user) {
          newItem.user = user;
        }
      }
      clonedLogs.push(newItem);
    });
    await Promise.all(myPromise);
    return res.status(200).send(
      clonedLogs.sort(function (a, b) {
        return new Date(b?.date) - new Date(a?.date);
      })
    );
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const getOrganisationContact = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id)
      return res.status(400).send({ message: "contact_id is required" });
    const contact = await OrganisationContactModel.findById({ _id });
    if (!contact) return res.status(400).send({ message: "contact not found" });
    return res.status(200).send(contact);
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const calcAmountPaid = async (linkedReceiptList, _id) => {
  let amountpaid = 0;
  if (linkedReceiptList.length === 0) {
    return amountpaid;
  }

  await Promise.all(
    linkedReceiptList.map(async (receipt) => {
      const payment = await ReceiptModel.findById({
        _id: receipt?.receiptId,
      })
        .where("status")
        .equals("active")
        .lean();
      if (payment?._id) {
        const found = payment?.linkedInvoiceList.find(
          (invoice) => invoice?.invoiceId === _id.toString()
        );
        if (found) {
          amountpaid += Number(found.appliedAmount);
        }
      }
    })
  );
  return amountpaid;
};

const getAllOrganisationContacts = async (req, res) => {
  try {
    const { organisationId, contactType, status, outstandingDebt } = req.query;
    if (!organisationId)
      return res.status(400).send({ message: "organisationId is required" });
    if (contactType === "customer" && status) {
      const contacts = await OrganisationContactModel.find({
        organisationId,
        status,
        contactType,
      });
      if (!outstandingDebt) return res.status(200).send(contacts);
    }
    if (contactType && status) {
      const contacts = await OrganisationContactModel.find({
        organisationId,
        contactType,
        status,
      });

      return res.status(200).send({ data: contacts });
    }

    if (contactType && !status) {
      const contacts = await OrganisationContactModel.find({ organisationId })
        .where("contactType")
        .equals(contactType);
      return res.status(200).send(contacts);
    }
    if (!contactType && status) {
      const contacts = await OrganisationContactModel.find({ organisationId })
        .where("status")
        .equals(status);
      return res.status(200).send(contacts);
    }
    const contacts = await OrganisationContactModel.find({ organisationId });
    return res.status(200).send(contacts);
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const calcTotalSales = (allSales) => {
  let total = 0;
  allSales.forEach((sale) => {
    total += Number(sale.amountPaid || sale.amountDue);
  });
  return total;
};
const getOrganisationCustomerRanking = async (req, res) => {
  //   try {
  //     const { organisationId, contactType } = req.query;
  //     if (!organisationId)
  //       return res.status(400).send({ message: "organisationId is required" });
  //     if (!contactType)
  //       return res.status(400).send({ message: "contact Type is required" });
  //     let ranks = [];
  //     if (contactType === "customer") {
  //       const contacts = await OrganisationContactModel.find({
  //         organisationId,
  //         status: "active",
  //         contactType,
  //       }).lean();
  //       const allSales = await SaleModel.find({
  //         organisationId,
  //         status: "active",
  //       }).lean();
  //       let customers = [];
  //       const calcAllSales = calcTotalSales(allSales);
  //       console.log("allS", calcAllSales);
  //       const myPromise = contacts.map((customer) => {
  //         let obj = { customerId: customer?._id };
  //         const filter = allSales.filter(
  //           (sale) => sale.customerId === customer._id.toString()
  //         );
  //         obj.sale = filter;
  //         obj.saleFrequencyPercentage =
  //           (filter.length * 100) / allSales.length || 0;
  //         const customerSales = calcTotalSales(filter);
  //         obj.revenue = customerSales;
  //         obj.revenuePercentage =
  //           Number(customerSales * 100) / Number(calcAllSales);
  //         obj.valuation =
  //           Number(obj.saleFrequencyPercentage) + Number(obj.revenuePercentage);
  //         customers.push(obj);
  //         obj.generalValuePercentage = Number(obj.valuation * 100) / Number(200);
  //       });
  //       await Promise.all(myPromise);
  //       if (customers.length === 0) {
  //         return res.status(200).send(customers);
  //       }
  //       return res.status(200).send(
  //         customers.sort(function (a, b) {
  //           return b.valuation - a.valuation;
  //         })
  //       );
  //     }
  //   } catch (error) {
  //     return res.status(500).send(error.message);
  //   }
};
const addOpenCloseBalance = (trans) => {
  let balance = 0;
  let collection = [];
  trans.map((item, index) => {
    const newItem = { ...item };
    const { amountDue, amountOwed, amountPaid } = newItem;
    if (index === 0) {
      newItem.openingBalance = 0.0;
      const newSum =
        Number(balance) +
        Number(amountDue) +
        Number(amountOwed || 0) -
        Number(amountPaid || 0);
      newItem.closingBalance = newSum.toFixed(2);
      collection.push(newItem);
      balance = Number(newSum);
    } else {
      newItem.openingBalance = balance.toFixed(2);
      const newBalance =
        Number(balance) -
        Number(amountPaid || 0) +
        Number(newItem?.balance || 0) +
        Number(amountDue || 0) +
        Number(amountOwed || 0);
      console.log("NB", newBalance);
      newItem.closingBalance = newBalance.toFixed(2);
      collection.push(newItem);
      balance = newBalance;
    }
  });
  return collection;
};

const calcOverPaymentAmount = (linkedInvoiceList, amountPaid) => {
  let overPaymentAmount = 0;
  let sum = 0;
  if (linkedInvoiceList?.length === 0) {
    return overPaymentAmount;
  }
  linkedInvoiceList?.map((invoice) => {
    sum += Number(invoice.appliedAmount);
  });
  overPaymentAmount = amountPaid - sum;
  if (overPaymentAmount === 0) {
    overPaymentAmount = 0;
  }
  return overPaymentAmount;
};

const getCustomerStatement = async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id) return res.status(400).send("customerId is required");
    const combine = [];

    const receipts = await ReceiptModel.find({ customerId: _id }).lean();
    if (receipts?.length > 0) {
      combine.push(...receipts);
    }
    const addSaleDate = [];
    const myPromise = combine.map((sale) => {
      const newSale = { ...sale };
      newSale.date = newSale.invoiceDate || newSale.receiptDate;
      if (newSale?.receiptNo && !newSale.isInvoicePayment) {
        newSale.amountOwed = newSale.totalSellingPrice;
      }
      if (newSale?.receiptNo && newSale.isInvoicePayment) {
        newSale.overPayment = calcOverPaymentAmount(
          newSale?.linkedInvoiceList,
          newSale?.amountPaid
        );
      }
      addSaleDate.push(newSale);
    });
    await Promise.all(myPromise);
    const sortTransactions = addSaleDate.sort(function (a, b) {
      return new Date(a?.date) - new Date(b?.date);
    });
    const addBalances = await Promise.all(
      addOpenCloseBalance(sortTransactions)
    );

    res.status(200).send(addBalances);
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const editOrganisationContact = async (req, res) => {
  try {
    console.log("starting edit", req.body);

    const { _id } = req.body;
    if (!_id)
      return res.status(400).send({ message: "contact_id is required" });
    const update = await OrganisationContactModel.findByIdAndUpdate(
      _id,
      { ...req.body },
      { new: true }
    );
    if (update) {
      const log = req.body.log;
      const updateLog = await OrganisationContactModel.findByIdAndUpdate(
        update._id,
        // { name, category, price },

        { $push: { logs: log } },
        { new: true }
      );
      return res.status(200).send(update);
    }
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

const deleteContact = async (contacts) => {
  console.log("starting del");
  return contacts.reduce(async (acc, contact) => {
    const { _id } = contact;
    const result = await acc;
    const existingContact = await OrganisationContactModel.findById(_id);
    const disabled = await OrganisationContactModel.findByIdAndUpdate(
      _id,
      { status: "disabled" },
      { new: true }
    );
    if (disabled) {
      const log = contact.log;
      const updateLog = await OrganisationContactModel.findByIdAndUpdate(
        disabled._id,

        { $push: { logs: log } },
        { new: true }
      );
      result.push(contact);
    }

    return result;
  }, []);
};

const deleteOrganisationContact = async (req, res) => {
  try {
    console.log("starting edit", req.body);

    const disabledContacts = await deleteContact(req.body);
    if (disabledContacts.length > 0) {
      console.log("update", disabledContacts);
      return res.status(200).send(disabledContacts);
    }
  } catch (error) {
    return res.status(500).send(error.message);
  }
};
const restoreContact = async (contacts) => {
  console.log("starting del");
  return contacts.reduce(async (acc, contact) => {
    const { _id } = contact;
    const result = await acc;
    const existingContact = await OrganisationContactModel.findById(_id);
    const restored = await OrganisationContactModel.findByIdAndUpdate(
      _id,
      { status: "active" },
      { new: true }
    );
    if (restored) {
      const log = contact.log;
      const updateLog = await OrganisationContactModel.findByIdAndUpdate(
        restored._id,
        // { name, category, price },

        { $push: { logs: log } },
        { new: true }
      );
      result.push(contact);
    }

    return result;
  }, []);
};

const restoreOrganisationContact = async (req, res) => {
  try {
    console.log("starting edit", req.body);

    const restoredContacts = await restoreContact(req.body);
    if (restoredContacts.length > 0) {
      return res.status(200).send(restoredContacts);
    }
  } catch (error) {
    return res.status(500).send(error.message);
  }
};

module.exports = {
  createOrganisationContact,
  getAllOrganisationContacts,
  getOrganisationContact,
  editOrganisationContact,
  deleteOrganisationContact,
  restoreOrganisationContact,
  getOrganisationCustomerRanking,
  addOrganisationContactRemark,
  getOrganisationContactRemark,
  deleteOrganisationContactRemark,
  getOrganisationContactLogs,
  getCustomerStatement,
};
