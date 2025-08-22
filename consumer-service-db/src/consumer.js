const amqp = require('amqplib');
const { MongoClient } = require('mongodb');

const RABBITMQ_URL = 'amqp://user:password@queue-service:5672';
const QUEUE_NAME = 'sensor-data-db';
const MONGO_URL = 'mongodb://timeseries-db-service:27017';
const DB_NAME = 'sensorwatch';
const COLLECTION_NAME = 'sensor-data';

async function start() {
    // Connect to MongoDB
    const mongoClient = new MongoClient(MONGO_URL);
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    console.log('Connected to MongoDB');

    // Connect to RabbitMQ
    const conn = await amqp.connect(RABBITMQ_URL);
    const channel = await conn.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log('Connected to RabbitMQ, waiting for messages...');

    channel.consume(QUEUE_NAME, async (msg) => {
        if (msg !== null) {
            const data = JSON.parse(msg.content.toString());
            console.log('Received from queue:', data);
            await collection.insertOne(data);
            channel.ack(msg);
        }
    }, { noAck: false }); 
}

start().catch(err => {
    console.error('Error in consumer-service:', err);
    process.exit(1);
});