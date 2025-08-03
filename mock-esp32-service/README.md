# Mock ESP32 Service

This service simulates an ESP32 device that emits JSON data over WebSockets. It is designed to provide temperature and humidity readings to the frontend dashboard and simultaneously store the data in the database for analytics and visualization.

## Project Structure

```
mock-esp32-service
├── src
│   └── mock-esp32.ts
├── package.json
└── README.md
```

## Setup Instructions

1. **Clone the Repository**
   Clone the repository to your local machine using:
   ```
   git clone <repository-url>
   ```

2. **Navigate to the Mock ESP32 Service Directory**
   ```
   cd sensorwatch/mock-esp32-service
   ```

3. **Install Dependencies**
   Install the required dependencies using npm:
   ```
   npm install
   ```

4. **Run the Service**
   Start the mock ESP32 service:
   ```
   npm start
   ```

5. **WebSocket Connection**
   The service will emit JSON data over a WebSocket connection. Ensure your frontend dashboard is set up to connect to this service to receive the data.

## Configuration

You can configure the emitted data and the WebSocket server settings in the `src/mock-esp32.ts` file. Adjust the parameters as needed to simulate different scenarios.

## Testing

To test the service, you can use a WebSocket client to connect to the server and observe the emitted JSON data. This will help ensure that the service is functioning as expected.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.