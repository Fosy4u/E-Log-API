const storageRef = require("../config/firebase"); // reference to our db
const root = require("../../root");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const addImage = async (req, res) => {
  const source = path.join(root + "/uploads/" + req.file.filename);
  try {
    console.log("receiving file");
    console.log("received");
    console.log("file", req.file);
    console.log("body", req.body.name);

    if (req.file === undefined) {
      return res.status(400).send({ message: "You must select a file." });
    }
    const storage = await storageRef.upload(source, {
      public: true,
      destination: `/uploads/e-stocker/${req.file.filename}`,
      metadata: {
        firebaseStorageDownloadTokens: uuidv4(),
      },
    });
    const url = storage[0].metadata.mediaLink;
    return res.status(200).send({
      message: "File has been uploaded.",
      url: url,
    });

    // Step 3. Grab the public url

    // const downloadURL = await snapshot.ref.getDownloadURL();
    // console.log('getting image url', downloadURL)
    // res.send(downloadURL);
  } catch (error) {
    console.log(error);
    res.status(400).send(error.message);
  }
};
module.exports = {
  addImage,
};
