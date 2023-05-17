const { firebase } = require("../config/firebase");
const ObjectId = require("mongoose").Types.ObjectId;

function isValidObjectId(id) {
  if (ObjectId.isValid(id)) {
    if (String(new ObjectId(id)) === id) return true;
    return false;
  }
  return false;
}

function authMiddleware(request, response, next) {
 
  const headerToken = request.headers.authorization;
  if (!headerToken) {
    console.log("No token provided");
    return response.send({ message: "No token provided" }).status(400);
  }

  if (headerToken && headerToken.split(" ")[0] !== "Bearer") {
    console.log("Invalid token");
    response.send({ message: "Invalid token" }).status(400);
  }

  const token = headerToken.split(" ")[1];
  firebase
    .auth()
    .verifyIdToken(token)
    .then((res) => {
      let organisationId =
        request.query.organisationId || request.body.organisationId;

      if (organisationId && !isValidObjectId(organisationId)) {
        console.log("Invalid organisationId provided");
        return response.status(400).json({
          error: "Invalid organisationId provided via query url or body",
        });
      }
      next();
    })
    .catch((error) => {
      console.log("error in verifying token", error);
      response.send({ message: "Could not authorize", error }).status(400);
    });
}

module.exports = authMiddleware;
