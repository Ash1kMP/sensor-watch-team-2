import express from 'express';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

const services = [
    { name: 'DB Service', url: 'http://db-service:3001' },
    { name: 'Backend Service', url: 'http://backend-service:3002' },
    { name: 'Mock ESP32 Service', url: 'http://mock-esp32-service:3003' },
    { name: 'Queue Service', url: 'http://queue-service:3004' },
    { name: 'Frontend Dashboard', url: 'http://frontend-dashboard:3005' },
];

const checkServiceHealth = async (service) => {
    try {
        await axios.get(`${service.url}/health`);
        return { name: service.name, status: 'UP' };
    } catch (error) {
        return { name: service.name, status: 'DOWN' };
    }
};

app.get('/health', async (req, res) => {
    const healthChecks = await Promise.all(services.map(checkServiceHealth));
    res.json(healthChecks);
});

app.listen(PORT, () => {
    console.log(`Discovery service running on port ${PORT}`);
});