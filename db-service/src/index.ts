import { MongoClient } from 'mongodb';

const uri = 'mongodb://localhost:27017'; // Replace with your MongoDB connection string
const dbName = 'sensorwatch'; // Replace with your database name

async function connectToDatabase() {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        console.log('Connected to database');
        const db = client.db(dbName);
        // You can add your data operations here
    } catch (error) {
        console.error('Database connection error:', error);
    } finally {
        await client.close();
    }
}

connectToDatabase();