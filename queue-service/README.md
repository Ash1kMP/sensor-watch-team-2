# Queue Service Documentation

## Overview
The Queue Service is responsible for managing message queues for the SensorWatch application. It handles both critical and non-critical messages emitted from the ESP32 mock service, ensuring that no data is lost and that important notifications are sent to users.

## Features
- **Non-Critical Messages**: Handles JSON data related to temperature and humidity readings.
- **Critical Messages**: Manages important system updates and device status notifications.
- **Notification System**: Sends notifications via email and in-app alerts based on critical messages.

## Getting Started

### Prerequisites
- Node.js (version 14 or higher)
- npm (Node package manager)

### Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   cd sensorwatch/queue-service
   ```

2. Install dependencies:
   ```
   npm install
   ```

### Running the Service
To start the Queue Service, run:
```
npm start
```

### Directory Structure
- `src/index.ts`: Initializes the queue service and manages message handling.
- `src/channels/non-critical.ts`: Logic for handling non-critical messages.
- `src/channels/critical.ts`: Logic for handling critical messages.
- `src/notifications/email.ts`: Logic for sending email notifications.
- `src/notifications/in-app.ts`: Logic for sending in-app notifications.

### Configuration
Configuration settings can be adjusted in the `src/index.ts` file to suit your environment and requirements.

### Testing
To run tests, use:
```
npm test
```

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.