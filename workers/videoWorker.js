const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const ytdl = require("ytdl-core");
const path = require("path");
const debug = require("debug")("videoWorker");
const getVideoId = require("get-video-id");
const moment = require("moment");

var { Video } = require("../models/video.js");
const uploader = require("./uploadWorker.js");

const outputPath = "./tmp";

/**
 * processVideo - Does the back-end work of downloading, encoding and uploading videos.
 * A YouTube videos is inputted with a startTime and xOffset. It is then downloaded and
 * rendered using FFmpeg. This generates stacked video as long as the overlay (~5s) starting
 * from the time startTime. While the xOffset is used to position the overlay
 * in relation to the base video. This is a percentage generated client-side.
 *
 * @param {Object} data The data required to encode video
 * @param {string} data.url The only required paramter, a url to the YouTube video that needs to be encoded
 * @param {number} data.startTime An optional number that sets where in the YouTube video to cut from in seconds
 * @param {number} data.xOffset A number to two decimal points that represents the percentage the overlay has been moved client-side
 * @param {send} cb The callback that handles sending the processed video
 */
exports.processVideo = function(data, cb) {
  debug(data);

  validateDownload(data)
    .then(video => downloadVideo(video))
    .then(downloadedVideo => renderVideo(downloadedVideo))
    .then(renderedVideo => uploader.upload(renderedVideo))
    .then(uploadedVideo => {
      debug("Processed" + uploadedVideo);
      cb("", uploadedVideo);
    })
    .catch(err => {
      debug(err);
      cb(err);
    });
};

/**
 * validateDownload - Checks the data has at bare minimum a url then constructs
 * an {@link Video}
 *
 * @param {Object} data The data object described above
 * @return {Video} A new video object with the optional and required parameters set
 */
function validateDownload(data) {
  return new Promise(function(resolve, reject) {
    if (!data.url.length) {
      return reject({
        url: "No video url found"
      });
    }

    return resolve(new Video(data.url, data.startTime, data.xOffset));
  });
}

/**
 * downloadVideo - Downloads the YouTube video using ytdl. Also checks that the video
 * is not too long by calculating whether more than one hour of content will have to be
 * downloaded. The startTime is factored into this. All videos are downloaded at 720p max.
 *
 * @param {Video} video The newly constructed video object
 * @param {string} video.url YouTube url
 * @return {Video} The same video object
 */
function downloadVideo(video) {
  var id = getVideoId(video.url).id.toUpperCase();
  video.filename = `${id}-${moment().valueOf()}`;

  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
  }
  return new Promise((resolve, reject) => {
    ytdl.getInfo(video.url, (err, info) => {
      // Selects the hard-coded 720p ytdl format code
      var format = ytdl.chooseFormat(info.formats, { quality: "136" });

      // Checks that the video is less than one hour after the startTime
      if (format && info.length_seconds <= 3600 - (video.startTime || 0)) {
        debug("Video acceptable");
        ytdl
          .downloadFromInfo(info, { begin: `${video.startTime || 0}s` })
          .pipe(fs.createWriteStream(video.absoluteInput))
          .on("finish", () => {
            resolve(video);
          });
      } else {
        debug("Unacceptable video");
        return reject({ err: "Video too long" });
      }
    });
  });
}

/**
 * renderVideo - FFmpeg code required to actually overlay the now downloaded video
 * and the static overlay. Selects VP9 as the input format for the webm to allow for
 * Alpha transparency. Next the first filter is applied which dynamically scales the overlay
 * to the base video, which could be anything from 144p - 720p, also leaving a little padding
 * by shrinking the overlay by 10%. @see {@link https://superuser.com/a/1100429/450105}
 * Finally the video is overlaid with the optional xOffset and saved as .mp4
 *
 * Some tricky FFmpeg lingo expanded to help me understand this in the future:
 * - scale2ref = Scale (resize) the input video, based on a reference video. {@link https://www.ffmpeg.org/ffmpeg-all.html#toc-scale2ref}
 * - oh = Output height
 * - mdar = The main input video’s display aspect ratio
 * - ih = Input height
 * - main_w = The main input video’s width and height
 * - H-h = Puts overlay on the bottom, forgot what these represent though
 * - shortest = Makes the video only as long as the shortest input. In this case the overlay
 * - x|y = The corresponding starting positions of where the video should be placed on each axis. Eg: (100px*0.22) positions the overlay 22px away from the left side of the frame
 *
 * See the readme for more details.
 *
 * @param  {Video} downloadedVideo The Video object after the download is completed
 * @return {Video} A video object, now with a working output file location
 */
function renderVideo(downloadedVideo) {
  return new Promise((resolve, reject) => {
    ffmpeg(downloadedVideo.absoluteInput)
      .input("./public/videos/overlay.webm")
      .inputOption("-c:v libvpx-vp9")
      .complexFilter(
        [
          {
            filter: "scale2ref",
            options: "oh*mdar:ih*.9",
            inputs: ["1", "0"],
            outputs: ["scaled", "ref"]
          },
          {
            filter: "overlay",
            options: {
              x: `main_w*${downloadedVideo.xOffset || 0}`,
              y: "H-h",
              shortest: "1"
            },
            inputs: ["ref", "scaled"],
            outputs: ["composite"]
          }
        ],
        "composite"
      )
      .on("end", () => {
        resolve(downloadedVideo);
      })
      .save(downloadedVideo.absoluteOutput);
  });
}
