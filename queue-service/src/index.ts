import express from 'express';
import { NonCriticalChannel } from './channels/non-critical';
import { CriticalChannel } from './channels/critical';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const nonCriticalChannel = new NonCriticalChannel();
const criticalChannel = new CriticalChannel();

app.post('/non-critical', (req, res) => {
    nonCriticalChannel.sendMessage(req.body);
    res.status(200).send('Non-critical message queued');
});

app.post('/critical', (req, res) => {
    criticalChannel.sendMessage(req.body);
    res.status(200).send('Critical message queued');
});

app.listen(PORT, () => {
    console.log(`Queue service is running on port ${PORT}`);
});