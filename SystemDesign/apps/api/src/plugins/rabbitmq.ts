import amqp from 'amqplib';

export const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
export const EXCHANGE = 'salestorm.topic';
export const DLX_EXCHANGE = 'salestorm.dlx';

export const QUEUES = {
  RESERVATION: 'reservation.events',
  PAYMENT: 'payment.events',
  ORDER: 'order.events',
  SHIPMENT: 'shipment.events',
  NOTIFICATION: 'notification.events',
  DLQ: 'salestorm.dlq'
};

let connection: amqp.ChannelModel;
let channel: amqp.Channel;

export const connectRabbitMQ = async () => {
  if (connection) return { connection, channel };

  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();

  // Dead Letter Exchange and Queue
  await channel.assertExchange(DLX_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(QUEUES.DLQ, { durable: true });
  await channel.bindQueue(QUEUES.DLQ, DLX_EXCHANGE, '#');

  // Main Topic Exchange
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

  // Assert standard Queues with DLX configured
  const queueOpts = { durable: true, deadLetterExchange: DLX_EXCHANGE };
  
  await channel.assertQueue(QUEUES.RESERVATION, queueOpts);
  await channel.assertQueue(QUEUES.PAYMENT, queueOpts);
  await channel.assertQueue(QUEUES.ORDER, queueOpts);
  await channel.assertQueue(QUEUES.SHIPMENT, queueOpts);
  await channel.assertQueue(QUEUES.NOTIFICATION, queueOpts);

  // Bind Queues
  await channel.bindQueue(QUEUES.RESERVATION, EXCHANGE, 'reservation.*');
  await channel.bindQueue(QUEUES.PAYMENT, EXCHANGE, 'payment.*');
  await channel.bindQueue(QUEUES.ORDER, EXCHANGE, 'order.*');
  await channel.bindQueue(QUEUES.SHIPMENT, EXCHANGE, 'shipment.*');
  await channel.bindQueue(QUEUES.NOTIFICATION, EXCHANGE, '#'); // Notify on everything

  return { connection, channel };
};

export const getChannel = () => channel;
