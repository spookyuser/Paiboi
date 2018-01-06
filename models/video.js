const outputPath = "./tmp";

/**
 * Video object
 */
exports.Video = class {
  /**
   * constructor - The constructor for the Video object
   *
   * @param  {string} url     A required param that holds the YouTube url.
   * @param  {type} startTime An optional param that holds where to cut the video in seconds.
   * @param  {type} xOffset   An optional param that holds by how much to offset the overlay
   * @param  {type} filename  A required param set at download that contains the youtube-id and a timestamp
   */
  constructor(url, startTime, xOffset, filename) {
    this.url = url;
    this.startTime = startTime;
    this.xOffset = xOffset;
    this.filename = filename;
  }

  /**
   * get absoluteInput - Getter for returning where the downloaded file is stored
   * @example "C:/blad/fgfgf/sdfg/gggsdf/rendered-lkjlkj-1223.mp4"
   *
   * @return {string} The absolute path to where the downloaded YouTube video is
   */
  get absoluteInput() {
    return `${outputPath}/${this.filename}.flv`;
  }

  /**
   * get publicOutput - Getter for returning where the renderedVideo output is relative to the
   * public path /tmp/
   * @example "/rendered-lkjlkj-1223.mp4"
   *
   * @return {string} Output of renderedVideo relative to server
   */
  get publicOutput() {
    return `rendered-${this.filename}.mp4`;
  }

  /**
   * get absoluteOutput - Getter for returning the renderedVideo output
   * @example "F:/blad/fgfgf/sdfg/gggsdf/rendered-lkjlkj-1223.mp4"
   *
   * @return {string} The absolute path of the renderedVideo
   */
  get absoluteOutput() {
    return `${outputPath}/${this.publicOutput}`;
  }
};
