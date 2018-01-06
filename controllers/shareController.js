const Gfycat = require("gfycat-sdk");
const Promise = require("bluebird");
const debug = require("debug")("shareController");
const os = require("os");
const path = require("path");
var socketInstance, lastProgress, gfycat;

/**
 * shareGfycat - Uploads a video to Gfycat using the Gfycat sdk. After the upload is complete
 * a message is emitted with the url. During the upload a message is emitted with progress updates.
 * @see {@link https://github.com/gfycat/gfycat-sdk}
 *
 * @param {Socket} socket A Socket object that can emit the progress of the upload and completed url
 * @param {string} data.url The url of the video that needs to be sent to Gfycat
 */
exports.shareGfycat = function(socket, data) {
  gfycat = new Gfycat({
    clientId: process.env.GFYCAT_CLIENT_ID,
    clientSecret: process.env.GFYCAT_CLIENT_SECRET
  });
  socketInstance = socket;

  gfycat
    .authenticate()
    .then(res => {
      debug("token", gfycat.token);
      return gfycat.upload({
        fetchUrl: data.url,
        noMd5: true
      });
    })
    .then(res => pollGfycat(3000, res.gfyname))
    .then(res => completeShare(res.gfyname));
};

/**
 * getUploadStatus - Starts {@link pollGfycat}
 *
 * @param {number} delay How long to wait between polls
 * @param {type} gfyname The Gfycat id
 */
function getUploadStatus(delay, gfyname) {
  return new Promise.delay(Math.random() * delay).then(function() {
    return gfycat.checkUploadStatus(gfyname);
  });
}

/**
 * pollGfycat - Checks the progress of Gfycat upload
 *
 * @param {number} delay How long to wait between polls
 * @param {type} gfyname The Gfycat id
 */
function pollGfycat(delay, gfyname) {
  return new Promise(function(resolve, reject) {
    function next() {
      getUploadStatus(delay, gfyname).then(function(res) {
        debug(res);
        if (res.task === "complete") {
          return resolve(res);
        }
        if (res.task === "NotFoundo") {
          return reject("Not found");
        } else {
          updateProgress(res.progress);
          setTimeout(next, delay);
        }
      }, reject);
    }
    // Start first iteration of the loop
    next();
  });
}

/**
 * updateProgress - Emits a message containing the progress of the upload
 *
 * @param  {number} progress Percentage upload has completed
 */
function updateProgress(progress) {
  if (progress != lastProgress) {
    socketInstance.emit("share.progress", { progress: progress });
    lastProgress = progress;
  }
}

/**
 * completeShare - Emits a message containing the completed Gfycat upload url
 *
 * @param {string} id The id of the new Gfycat, generated when the upload is initiated
 */
function completeShare(id) {
  updateProgress(1.0);
  var url = "https://gfycat.com/" + id;
  socketInstance.emit("share.complete", { shareUrl: url });
}
