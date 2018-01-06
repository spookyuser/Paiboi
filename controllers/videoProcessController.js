const publisher = require("../amqp/publisher.js");
const debug = require("debug")("videoProcessController");

/**
 * processVideo - Initiates video processing work by calling the publisher with the
 * data required to make a rendered video.
 *
 * @param {Socket} socket A Socket object that can emit the completed video url or error
 * @param {Object} data The data required to encode the video
 * @param {string} data.url The only required paramter, a url to the YouTube video that needs to be encoded
 * @param {number} data.startTime An optional number that sets where in the YouTube video to cut from in seconds
 * @param {number} data.xOffset A number to two decimal points that represents the percentage the overlay has been moved client-side
 */
exports.processVideo = function(socket, data) {
  publisher.publish(data, sendVideo);

  function sendVideo(uploadedVideo) {
    debug(uploadedVideo);
    var res = JSON.parse(uploadedVideo);
    if (res.err) {
      debug(res.err);
      socket.emit("video.err", res);
    } else {
      socket.emit("video.done", res);
    }
  }
};
