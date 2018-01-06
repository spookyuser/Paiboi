const getVideoId = require("get-video-id");
const lottie = require("lottie-web");
const plyr = require("plyr");
const interact = require("interactjs");
const debug = require("debug")("index");
const socket = require("socket.io-client")();
var ProgressBar = require("progressbar.js");

// Global variables
var editable = true,
  startTime,
  endTime,
  anim,
  videoPlayerInstance,
  drag,
  bar;

/**
 * Easy access to views
 *
 * FIXME: Is this bad? It feels bad.
 */
var placeholder = document.getElementById("placeholder");
var overlay = document.getElementById("overlay");
var makeButton = document.getElementById("makeButton");
var downloadFileButton = document.getElementById("downloadFileButton");
var videoPlayer = document.getElementById("videoPlayer");
var renderedVideoForm = document.getElementById("renderedVideoForm");
var urlButton = document.getElementById("urlButton");
var bodymovin = document.getElementById("bodymovin");
var videoUrl = document.getElementById("videoUrl");
var renderedVideoUrl = document.getElementById("renderedVideoUrl");
var postrender = document.getElementById("postrender");
var gfycat = document.getElementById("gfycat");
var shareUrl = document.getElementById("shareUrl");
var error = document.getElementById("error");
var restart = document.getElementById("restart");
var restartButton = document.getElementById("restartButton");

/**
 * Starts listening for clicks and Socket.io messages
 */
window.addEventListener("load", function(event) {
  videoPlayerInstance = setupPlyr();
  drag = setupDrag();

  //Button routers
  makeButton.addEventListener("click", makeVideo);

  videoUrl.addEventListener("input", changeYoutubeVideo);

  gfycat.addEventListener("click", shareGfycat);

  restartButton.addEventListener("click", () => {
    location.reload("/");
  });

  // Socket routers
  socket.on("video.done", function(response) {
    showRenderedVideo(response.url);
  });

  socket.on("share.progress", function(response) {
    updateProgressBar(response.progress);
  });

  socket.on("share.complete", function(response) {
    completeShare(response.shareUrl);
  });

  socket.on("video.err", function(response) {
    showVideoErr(response.err);
  });
});

/**
 *
 *
 *  Controllers for routers
 *
 *
 */

/**
 * makeVideo - Sends socket with data required to render the video. This includes
 * the required YouTube url and the optional xOffset and startTime.
 */
function makeVideo() {
  // Calculate the percentage the overlay has been offset to two decimals
  var xOffset = (userOffset / placeholderWidth).toFixed(2);

  var placeholderWidth = placeholder.offsetWidth;
  var userOffset = overlay.dataset.x;
  var data = { url: videoPlayerInstance.source() };

  // Add optional params to the object if they exist
  if (startTime > 0) data.startTime = startTime;
  if (!isNaN(xOffset)) data.xOffset = xOffset;

  socket.emit("video.make", data);
  setupAnimation();
}

/**
 * changeYoutubeVideo - when a user types in the YouTube form this function checks whether
 * it's a valid YouTube id. If it is then the plyr is changed to the new video.
 *
 * @see changeSourceVid helper
 */
function changeYoutubeVideo() {
  var url = getVideoId(videoUrl.value);
  if (url) {
    debug("Setting youtube vid");
    changeSourceVid(url.id, "youtube");
  } else {
    debug("Invalid Input");
  }
}

/**
 * shareGfycat - Sends a socket containing the url for the processed and uploaded video
 * In the back-end, while this is uploaded to Gfycat, a progress bar is shown and updated
 * incrementally with Socket packets containing the percentage. After the upload is complete
 * the progressbar is destroyed and the url is shown.
 *
 * @see setupProgressBar
 * @see updateProgressBar
 * @see completeShare
 *
 */
function shareGfycat() {
  if (shareUrl.textContent === "") {
    var url = videoPlayerInstance.source();
    bar = setupProgressBar();
    socket.emit("share.gfycat", { url: url });
  }
}

/**
 *
 *
 * View controllers
 *
 *
 */

/**
 * showRenderedVideo - Sets up views for showing the rendered video url. This destroys the
 * lottie animation and changes the video player to the url. Finally it shows some post-render
 * options to download the video or share it.
 *
 * @param  {string} url a link to the S3 uploaded video
 */
function showRenderedVideo(url) {
  debug(url);
  debug("Calling show rendered now");

  anim.destroy();
  editable = false;
  videoPlayer.style.display = "block";
  videoPlayer.style.position = "static";
  placeholder.style.position = "static";
  overlay.style.display = "none";
  changeSourceVid(url, "video/mp4");
  postrender.style.display = "block";
  restart.style.display = "block";
  restartButton.textContent = "Make another";
  downloadFileButton.href = url;
}

/**
 * showVideoErr - Displayed when an error occurs. Destroys the animation and provides a
 * restart button.
 *
 * @param {string} err The error that occurred
 */
function showVideoErr(err) {
  debug(err);
  debug("Showing Error");
  anim.destroy();
  videoPlayerInstance.destroy();
  videoPlayer.style.display = "none";
  overlay.style.display = "none";
  error.textContent = err;
  error.style.display = "block";
  makeButton.style.display = "none";
  restart.style.display = "block";
  restartButton.textContent = "Try Again";
}

/**
 * setupDrag - Sets up the overlay to be dragged using interactjs
 * {@link http://interactjs.io/}
 * all functionality comes from the homepage docs which are on Github and the website.
 * {@link https://github.com/interactjs/website/blob/495c1ba58de79089eb4998bad884c219fe475ebd/demos/dragging.html}
 */
function setupDrag() {
  // Target elements with the "draggable" class
  interact(".draggable").draggable({
    // Enable inertial throwing
    inertia: true,

    // Keep the element within the area of it's parent
    restrict: {
      restriction: "parent",
      endOnly: true,
      elementRect: { top: 0, left: 0, bottom: 1, right: 1 }
    },

    // Call this function on every dragmove event
    onmove: dragMoveListener
  });
}

/**
 * dragMoveListener - Moves objects after being dragged.
 * {@link http://interactjs.io/}
 * all functionality comes from the homepage docs which are on Github and the website.
 * {@link https://github.com/interactjs/website/blob/495c1ba58de79089eb4998bad884c219fe475ebd/demos/dragging.html}
 */
function dragMoveListener(event) {
  var target = event.target,
    // Keep the dragged position in the data-x/data-y attributes
    x = (parseFloat(target.getAttribute("data-x")) || 0) + event.dx,
    y = (parseFloat(target.getAttribute("data-y")) || 0) + event.dy;

  // Translate the element
  target.style.webkitTransform = target.style.transform =
    "translate(" + x + "px, " + y + "px)";

  // Update the position attributes
  target.setAttribute("data-x", x);
  target.setAttribute("data-y", y);
}

/**
 * loopPlyr - This loops the plyr from the place the user has selected + five seconds.
 * Every second the vide plays we check whether that is smaller than the initial time + five seconds.
 * If it's not then we return back to the initial time. We also check that the user is not seeking so as to allow
 * the initial time to be changed. This kind of works at the moment. But this probably needs to be more visible.
 *
 * FIXME: Allow user to also jump to any point in video by checking the "seeked" is not called
 *
 * @see setupPlyr
 */
function loopPlyr() {
  var seeking = false;
  startTime = Math.floor(videoPlayerInstance.getCurrentTime());
  endTime = startTime + 5;
  // Prob need && not seeked here
  videoPlayerInstance.on("timeupdate", function() {
    if (videoPlayerInstance.getCurrentTime() >= endTime && !seeking) {
      videoPlayerInstance.seek(startTime);
    }
  });
  videoPlayerInstance.on("seeking", function() {
    seeking = true;
  });
}

/**
 * setupAnimation - Sets the lottie animation to start playing
 *
 * @see {@link http://airbnb.io/lottie/}
 */
function setupAnimation() {
  debug("Setting up");

  videoUrlForm.style.display = "none";
  makeButton.style.display = "none";
  var animData = {
    container: bodymovin,
    renderer: "svg",
    loop: true,
    path: "./data/loader.json"
  };
  anim = lottie.loadAnimation(animData);
  videoPlayer.style.display = "none";
  anim.play();
}

/**
 * setupPlyr - Sets the plyr to start playing the default vid stored inside the data-id
 * object in the index.pug file. This also starts the loop as well as mutes the video.
 *
 * @see {@link https://plyr.io/}
 * @return {Player} A Player object containing a reference to the instance that was just setup
 */
function setupPlyr() {
  var options = {
    autoplay: true,
    loop: true,
    clickToPlay: false,
    controls: ["progress", "play-large"]
  };

  // Get the first plyr in the array that is returned
  var player = plyr.setup("#demo", options)[0];

  player.on("play", function() {
    if (editable) loopPlyr();
  });

  player.on("ready", function(event) {
    player.setVolume(0);
  });

  return player;
}

/**
 * setupProgressBar - Sets up a progressbarjs {@link https://kimmobrunfeldt.github.io/progressbar.js/} and saves this to a global variable.
 *
 * This uses mostly default config from the project homepage.
 */
function setupProgressBar() {
  var bar = new ProgressBar.Line(progressbar, {
    strokeWidth: 4,
    easing: "easeInOut",
    duration: 1400,
    color: "#FFEA82",
    trailColor: "#eee",
    trailWidth: 1,
    text: {
      style: {
        // Text color.
        // Default: same as stroke color (options.color)
        color: "#999",
        position: "absolute",
        right: "0",
        top: "30px",
        padding: 0,
        margin: 0,
        transform: null
      },
      autoStyleContainer: false
    },
    svgStyle: { width: "100%", height: "100%" },
    from: { color: "#FFEA82" },
    to: { color: "#ED6A5A" },
    step: (state, bar) => {
      bar.path.setAttribute("stroke", state.color);
      bar.setText(Math.round(bar.value() * 100) + " %");
    }
  });

  return bar;
}

/**
 * updateProgressBar - incrementally updates the progressbar with a socket emitted percentage
 *
 * @param  {number} progress Percentage to move the bar to
 */
function updateProgressBar(progress) {
  debug("Progress:", progress);
  bar.animate(progress);
}

/**
 * completeShare - Destroys the progressbar ands shows the gfycat url
 *
 * @param {string} url Url containing gfycat upload
 */
function completeShare(url) {
  bar.destroy();
  shareUrl.style.display = "block";
  shareUrl.value = url;
}

/**
 *
 *
 * Helpers
 *
 *
 */

/**
 * changeSourceVid - Simple helper to change the plyr source from a youtube video to another
 * youtube video or to an S3 uploaded video.
 *
 * @param  {string} src  Location of the new video
 * @param  {string} type Type of the new video
 */
function changeSourceVid(src, type) {
  videoPlayerInstance.source({
    type: "video",
    sources: [
      {
        src: src,
        type: type
      }
    ]
  });
}
