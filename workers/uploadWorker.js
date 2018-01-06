const s3 = require("s3-client");
const debug = require("debug")("uploadWorker");
const Promise = require("bluebird");
const fs = Promise.promisifyAll(require("fs"));

const bucket = process.env.BUCKET;
const client = s3.createClient({
  s3Options: {
    accessKeyId: process.env.S3_KEY,
    secretAccessKey: process.env.S3_SECRET
  }
});

/**
 * upload - Uploads the rendered video to an S3 bucket. S3 credentials set via environmental variables
 *
 * @param  {Video} renderedVideo A video object with a path to the renderedVideo
 * @return {string} A url to the now uploaded video
 */
exports.upload = function(renderedVideo) {
  return new Promise((resolve, reject) => {
    var params = {
      localFile: renderedVideo.absoluteOutput,
      s3Params: {
        Bucket: bucket,
        Key: renderedVideo.publicOutput
      }
    };

    // Manually constructs url
    var url = `https://s3.amazonaws.com/${bucket}/${
      renderedVideo.publicOutput
    }`;
    var uploader = client.uploadFile(params);

    uploader.on("error", function(err) {
      console.error("unable to upload:", err.stack);
      reject(err);
    });

    uploader.on("end", function() {
      debug(url);
      resolve(url);
    });
  })
    .then(cleanUp(renderedVideo))
    .catch(err => console.error(err));
};

/**
 * cleanUp - Remove temporary files after upload
 *
 * @param  {Video} renderedVideo A video object with a path to the renderedVideo
 */
function cleanUp(renderedVideo) {
  const files = [
    fs.unlinkAsync(renderedVideo.absoluteOutput),
    fs.unlinkAsync(renderedVideo.absoluteInput)
  ];
  return Promise.all(files).then(function() {
    debug("All files were deleted");
  });
}
