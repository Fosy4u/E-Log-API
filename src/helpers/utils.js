const fs = require("fs");

const deleteLocalFile = async (path) => {
  return new Promise((resolve) => {
    fs.unlink(path, (error) => {
      error && console.log("WARNING:: Delete local file", error);
      resolve();
    });
  });
};

module.exports = {
  deleteLocalFile,
};
