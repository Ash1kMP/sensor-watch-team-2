// Bridges real ESP32 telemetry -> RabbitMQ queues used by the web app.
// - Subscribes to MQTT topic(s) (default: dev/+/telemetry).
// - Normalizes payload into { temperature, humidity, timestamp }.
// - Publishes to both queues: sensor-data-db and sensor-data-frontend.

// {
//   "name": "esp32-bridge-service",
//   "version": "1.0.0",
//   "description": "Bridge real ESP32 telemetry (MQTT/HTTP) into the web app RabbitMQ queues.",
//   "main": "src/esp32-bridge.js",
//   "scripts": { "start": "node src/esp32-bridge.js" },
//   "dependencies": {
//     "amqplib": "^0.10.3",
//     "mqtt": "^5.10.1",
//     "axios": "^1.7.4"
//   }
// }

const mqtt = require('mqtt');
const amqp = require('amqplib');

const {
  MQTT_URL = 'mqtt://test.mosquitto.org:1883',
  MQTT_TOPIC = 'dev/+/telemetry',                    // matches main.cpp topics: dev/<MAC>/telemetry
  RABBITMQ_URL = 'amqp://user:password@queue-service:5672',
  FRONTEND_QUEUE = 'sensor-data-frontend',
  DB_QUEUE = 'sensor-data-db'
} = process.env;

function mapPayload(topic, buf) {
  let payload;
  try { payload = JSON.parse(buf.toString()); }
  catch { payload = { raw: buf.toString() }; }

  const parts = topic.split('/');
  const deviceId = parts.length >= 2 ? parts[1] : undefined;

  const temperature = payload.temp_f ?? payload.temp_c ?? payload.temperature ?? null;
  const humidity = payload.humidity_pct ?? payload.humidity ?? null;

  return {
    deviceId,
    temperature,
    humidity,
    timestamp: new Date().toISOString(),            // normalize to ISO time
    raw: payload                                    // keep originals for DB
  };
}

async function start() {
  console.log(`[esp32-bridge] MQTT: ${MQTT_URL} topic=${MQTT_TOPIC}`);
  console.log(`[esp32-bridge] RabbitMQ: ${RABBITMQ_URL}`);
  const amqpConn = await amqp.connect(RABBITMQ_URL);
  const channel = await amqpConn.createChannel();
  await channel.assertQueue(FRONTEND_QUEUE, { durable: true });
  await channel.assertQueue(DB_QUEUE, { durable: true });

  const mqttClient = mqtt.connect(MQTT_URL, { reconnectPeriod: 2000, connectTimeout: 10000, clean: true });

  mqttClient.on('connect', () => {
    console.log('[esp32-bridge] MQTT connected; subscribing…');
    mqttClient.subscribe(MQTT_TOPIC, { qos: 0 }, err =>
      err ? console.error('subscribe error:', err) : console.log(`subscribed ${MQTT_TOPIC}`));
  });

  mqttClient.on('message', (topic, payloadBuf) => {
    try {
      const mapped = mapPayload(topic, payloadBuf);
      const buf = Buffer.from(JSON.stringify(mapped));
      channel.sendToQueue(FRONTEND_QUEUE, buf, { persistent: true });
      channel.sendToQueue(DB_QUEUE, buf, { persistent: true });
      console.log('[esp32-bridge] bridged', mapped);
    } catch (e) {
      console.error('[esp32-bridge] handle message error:', e);
    }
  });

  mqttClient.on('error', err => console.error('[esp32-bridge] MQTT error:', err?.message || err));
  mqttClient.on('close', () => console.warn('[esp32-bridge] MQTT connection closed'));
}

start().catch(e => { console.error('[esp32-bridge] fatal', e); process.exit(1); });
