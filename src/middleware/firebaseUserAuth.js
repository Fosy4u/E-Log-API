const { firebase } = require("../config/firebase");

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
      next();
    })
    .catch((error) => {
      console.log("error in verifying token", error);
      response.send({ message: "Could not authorize" }).status(400);
    });
}

module.exports = authMiddleware;
