var videoProcessController = require("../controllers/videoProcessController");
var shareController = require("../controllers/shareController");
var app = require("express");
var router = app.Router();

/**
 * An express like router for Socket connections. Follows the same style as
 * a normal express router would. Except we listen for Socket messages.
 *
 * @param {IO} io Socket.io object
 */
module.exports = function(io) {
  io.on("connection", function(socket) {
    // Sends client data to the processVideo function
    socket.on("video.make", data => {
      videoProcessController.processVideo(socket, data);
    });

    // Sends client data to the shareGfycat function
    socket.on("share.gfycat", data => {
      shareController.shareGfycat(socket, data);
    });
  });

  return router;
};
