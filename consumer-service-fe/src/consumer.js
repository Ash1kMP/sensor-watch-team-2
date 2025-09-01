const amqp = require('amqplib');
const WebSocket = require('ws');

const RABBITMQ_URL = process.env.RABBITMQ_URL
  || (process.env.DOCKER === 'true' ? 'amqp://user:password@queue-service:5672'
                                    : 'amqp://user:password@localhost:5672');
const QUEUE_NAME = process.env.FRONTEND_QUEUE || 'sensor-data-frontend';
const PORT = Number(process.env.PORT || 3000);

const wss = new WebSocket.Server({ port: PORT });
console.log(`WebSocket server is running on ws://localhost:${PORT}`);

async function start() {
  const conn = await amqp.connect(RABBITMQ_URL);
  conn.on('close', () => { console.error('AMQP connection closed'); process.exit(1); });
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  console.log(`Connected to RabbitMQ at ${RABBITMQ_URL}, consuming "${QUEUE_NAME}"`);
  channel.consume(QUEUE_NAME, msg => {
    if (!msg) return;
    try {
      const body = msg.content.toString();
      const data = JSON.parse(body);
      wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(JSON.stringify(data)));
    } catch {
      wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(msg.content.toString()));
    } finally {
      channel.ack(msg);
    }
  }, { noAck: false });
}

start().catch(err => { console.error('Error in consumer-service:', err); process.exit(1); });
RABBITMQ_URL