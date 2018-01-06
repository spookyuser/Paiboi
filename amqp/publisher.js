const Channel = require("./channel");
const debug = require("debug")("amqp:publisher");
const uuid = require("uuid/v1");

const queue = process.env.QUEUE;

/**
 * publish - A general publisher used to send work to the worker in a Remote Procedure Call
 * (RPC) pattern.
 * General structure from {@link https://github.com/pgte/node-patterns-code/tree/master/04-work-queues}
 * @see {@link https://blog.yld.io/2016/10/03/using-rabbitmq-and-amqp-in-node-js}
 * @see {@link https://github.com/squaremo/amqp.node/blob/962fb9ea3c4ac16368f8006c523b8a39182e11e0/examples/tutorials/callback_api/rpc_client.js}
 *
 * @param {Object} data The data required to encode the video
 * @param {sendVideo} cb The callback that handles sending encoded videos to the client
 */
exports.publish = function(data, cb) {
  debug(data);

  /**
   * createQueueChannel - Connects to an AMQP queue that can both send an receive
   * messages by using the additional "replyTo" property. This is just a UUID that tells the
   * worker to send the response back to this temporary queue created by the publisher, this
   * avoids the worker sending a message which it consumes itself.
   *
   * @param {string} queue An optional paramter that controls which queue to create. If null the server will create a random name.
   * @param {string} err Any errors from connecting to amqp server
   * @param {amqplib:Channel} channel The successfully connected Channel object
   * @param {amqplib:Connection} conn The Connection to amqp server
   * @param {string} rpcQueue An optional paramter containing the name of a server generated queue. This should exist if a null queue is sent
   */
  Channel.createQueueChannel("", function(err, channel, conn, rpcQueue) {
    if (err) {
      console.error(err.stack);
    } else {
      var correlationId = uuid();

      channel.consume(
        rpcQueue,
        function(response) {
          if (response.properties.correlationId === correlationId) {
            cb(response.content.toString());
          }
        },
        { noAck: true }
      );

      /**
       * Adds the replyTo property so the publisher can consume and publish messages
       */
      channel.sendToQueue(queue, encode(data), {
        correlationId: correlationId,
        replyTo: rpcQueue,
        persistent: true
      });
    }
  });
};

/**
 * encode - helper to properly format messages
 *
 * @param  {string} doc A string with a message
 */
function encode(doc) {
  return new Buffer(JSON.stringify(doc));
}
