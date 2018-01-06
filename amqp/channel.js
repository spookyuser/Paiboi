const amqp = require("amqplib/callback_api");
const debug = require("debug")("amqp:channel");

const url = process.env.AMQP_URL;

/**
 * createQueueChannel - A common module that sits between the worker and publisher.
 * This contains all the necessary logic to create and connect to an amqp server. Almost
 * this entire module comes from {@link https://github.com/pgte/node-patterns-code/tree/master/04-work-queues}
 * The only difference here is the optional queue paramter that allows this module to
 * create an Remote Procedure Call amqp queue. Rabbitmq contains a good tutorial on this.
 * @see {@link https://www.rabbitmq.com/tutorials/tutorial-six-javascript.html}
 * @see {@link https://blog.yld.io/2016/10/03/using-rabbitmq-and-amqp-in-node-js}
 *
 * @param {string} queue An optional paramter that controls which queue to create. If null the server will create a random name.
 * @param {publisher} cb The callback that handles the created queue
 */
module.exports.createQueueChannel = function(queue, cb) {
  amqp.connect(url, onceConnected);

  function onceConnected(err, conn) {
    if (err) {
      cb(err);
    } else {
      conn.createChannel(onceChannelCreated);
    }

    function onceChannelCreated(err, channel) {
      channel.prefetch(1);
      if (err) {
        cb(err);
      }

      // Checks if the queue is null. This tells us whether it's the publisher or worker connecting
      if (queue === "") {
        channel.assertQueue("", { exclusive: true }, onceQueueCreated);
      } else {
        channel.assertQueue(queue, { durable: false }, onceQueueCreated);
      }

      function onceQueueCreated(err, rpcQueue) {
        if (err) {
          cb(err);
        } else {
          // When replying to the publisher include the generated queue
          cb(null, channel, conn, rpcQueue.queue);
        }
      }
    }
  }
};
