var Channel = require("../amqp/channel.js");
const debug = require("debug")("amqp:worker");
const videoWorker = require("./videoWorker.js");

/**
 * Setup amqp worker for video encoding, the only work to be done at the moment.
 * General structure from
 * {@link https://github.com/pgte/node-patterns-code/tree/master/04-work-queues}
 * @see {@link https://blog.yld.io/2016/10/03/using-rabbitmq-and-amqp-in-node-js}
 */

var queue = process.env.QUEUE;

/**
 * Creates a worker queue from the channel module to receive messages from the publisher.
 * These are only messages to process videos, but could be expanded to do any other general work
 * Importantly, this makes use of the request reply pattern documented in the
 * Rabbitmq tutorials, thus this queue must both listen and send messages using the uuid
 * generated in the publisher
 * @see {@link https://www.rabbitmq.com/tutorials/tutorial-six-javascript.html}
 *
 * @param {string} queue An optional paramter that controls which queue to create. If null the server will create a random name.
 * @param {string} err Any errors from connecting to amqp server
 * @param {amqplib:Channel} channel The successfully connected Channel object
 * @param {amqplib:Connection} conn The Connection to amqp server
 */
Channel.createQueueChannel(queue, function(err, channel, conn) {
  if (err) {
    console.error(err.stack);
  } else {
    debug("channel and queue created");
    debug("no message, waiting...");
    consume();
  }

  function consume() {
    channel.get(queue, {}, onConsume);

    function onConsume(err, msg) {
      if (err) {
        console.warn(err.message);
      } else if (msg) {
        debug("got Message");

        var data = JSON.parse(msg.content.toString());
        debug("consuming %j", data);

        videoWorker.processVideo(data, send);

        /**
         * send - Sends the processed video back to the publisher in the form of a url to the
         * upload. Currently this is a url to an AWS s3 bucket hosted video.
         * The replyTo
         *
         * @param {string} err Any errors from processing
         * @param {type} s3Url Location of the uploaded video
         */

        function send(err, s3Url) {
          if (err) {
            debug(err);
            channel.sendToQueue(msg.properties.replyTo, encode(err), {
              correlationId: msg.properties.correlationId
            });
          } else {
            channel.sendToQueue(
              msg.properties.replyTo,
              encode({ url: s3Url }),
              {
                correlationId: msg.properties.correlationId
              }
            );
          }

          // Restart loop
          setTimeout(function() {
            debug("no message, waiting...");
            channel.ack(msg);
            consume();
          }, 1e3);
        }
      } else {
        setTimeout(consume, 1e3);
      }
    }
  }
});

/**
 * encode - helper to properly format messages
 *
 * @param  {string} doc A string with a message
 */
function encode(doc) {
  return new Buffer(JSON.stringify(doc));
}
