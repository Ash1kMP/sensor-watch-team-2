import { Queue } from 'bull';
import { RedisOptions } from 'ioredis';

const redisConfig: RedisOptions = {
  host: 'localhost',
  port: 6379,
};

const nonCriticalQueue = new Queue('non-critical', { redis: redisConfig });

nonCriticalQueue.process(async (job) => {
  // Handle non-critical messages (temperature and humidity readings)
  console.log('Processing non-critical message:', job.data);
  // Add your logic to store data in the database or perform other actions
});

export default nonCriticalQueue;