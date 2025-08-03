const amqp = require('amqplib');

// Configuration for RabbitMQ connection and queues
const RABBITMQ_URL = 'amqp://user:password@queue-service:5672';
const DB_QUEUE = 'sensor-data-db';
const FRONTEND_QUEUE = 'sensor-data-frontend';
const DATA_FREQUENCY = 5000; 

// Create a WebSocket server to simulate the ESP32 device
function generateSensorData() {
    return {
        temperature: parseFloat((Math.random() * 30 + 10).toFixed(2)),
        humidity: parseFloat((Math.random() * 100).toFixed(2)),
        timestamp: new Date()
    };
}

// Initialize RabbitMQ channels for DB and Frontend
let channel_DB = null;
let channel_Frontend = null;

// Connect to RabbitMQ and set up channels for DB and Frontend queues
amqp.connect(RABBITMQ_URL)
    .then(conn => Promise.all([conn.createChannel(), conn.createChannel()]))
    .then(([chDB, chFrontend]) => {
        channel_DB = chDB;
        channel_Frontend = chFrontend;

        return Promise.all([
            channel_DB.assertQueue(DB_QUEUE, { durable: true }),
            channel_Frontend.assertQueue(FRONTEND_QUEUE, { durable: true })
        ]);
    })
    .then(() => {
        console.log('Connected to RabbitMQ. Queues are ready.');

        setInterval(() => {
            const data = generateSensorData();
            const buffer = Buffer.from(JSON.stringify(data));

            if (channel_DB) {
                console.log('Sending to DB queue:', data);
                channel_DB.sendToQueue(DB_QUEUE, buffer, { persistent: true });
            }

            if (channel_Frontend) {
                console.log('Sending to Frontend queue:', data);
                channel_Frontend.sendToQueue(FRONTEND_QUEUE, buffer, { persistent: true });
            }
        }, DATA_FREQUENCY);
    })
    .catch(err => {
        console.error('Failed to connect to RabbitMQ:', err);
    });
