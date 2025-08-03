import { Queue } from 'bull';
import { CriticalMessage } from '../models/criticalMessage';

const criticalQueue = new Queue<CriticalMessage>('critical-messages');

criticalQueue.process(async (job) => {
    // Logic to handle critical messages
    console.log('Processing critical message:', job.data);
    // Add your processing logic here (e.g., logging, notifications)
});

export default criticalQueue;