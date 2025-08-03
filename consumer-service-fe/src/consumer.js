const amqp = require('amqplib');

const RABBITMQ_URL = 'amqp://user:password@queue-service:5672';
const QUEUE_NAME = 'sensor-data-frontend';
const PORT = 3000;

// create a websocker serve that consumes messages from rabbitmq and sends them to the frontend
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: PORT });
console.log(`WebSocket server is running on ws://localhost:${PORT}`);

async function start() {
    // Connect to RabbitMQ
    const conn = await amqp.connect(RABBITMQ_URL);
    const channel = await conn.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log('Connected to RabbitMQ, waiting for messages...');

    channel.consume(QUEUE_NAME, (msg) => {
        if (msg !== null) {
            const data = JSON.parse(msg.content.toString());
            console.log('Received from queue:', data);

            // Broadcast the message to all connected WebSocket clients
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });

            channel.ack(msg);
        }
    }, { noAck: false });
}

start().catch(err => {
    console.error('Error in consumer-service:', err);
    process.exit(1);
});