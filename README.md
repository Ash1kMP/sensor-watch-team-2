# SensorWatch Project

SensorWatch is a comprehensive web application designed to monitor and visualize sensor data, specifically temperature and humidity readings. The application is structured into multiple services, each responsible for a specific functionality, allowing for modular development and deployment.

## Project Structure

The project consists of the following services:

1. **DB Service**: A NoSQL database service that handles data storage and retrieval.
2. **Backend Service**: The core backend logic, including authentication and API endpoints.
3. **Mock ESP32 Service**: Simulates an ESP32 device emitting JSON data over WebSockets.
4. **Frontend Dashboard**: An Angular-based dashboard for visualizing temperature and humidity data.
5. **Queue Service**: Manages message queuing using RabbitMQ, with channels for critical and non-critical messages.
6. **NGINX API Gateway**: Routes requests to the appropriate services and handles load balancing.
7. **Discovery Service**: Monitors the health of all services and provides service discovery capabilities.

## Getting Started

### Prerequisites

- Docker and Docker Compose installed on your machine.
- Node.js and npm installed for service development.
- Angular CLI installed for frontend development.

### Setup Instructions

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd sensorwatch
   ```

2. **Build and Run Services**:
   Use Docker Compose to build and run all services:
   ```bash
   docker-compose up --build
   ```

3. **Access the Frontend Dashboard**:
   Open your web browser and navigate to `http://localhost:4200` to access the Angular dashboard.

4. **API Endpoints**:
   The backend service exposes various API endpoints for data interaction. Refer to the backend service documentation for details.

5. **Monitoring Services**:
   The discovery service will automatically monitor the health of all services. Check the logs for any issues.

### Architecture Overview

- **Data Flow**: The Mock ESP32 Service emits sensor data, which is sent to the Queue Service. The backend service processes this data and stores it in the DB Service. The Frontend Dashboard retrieves and displays this data for users.
- **Notifications**: Critical messages are handled by the Queue Service, which sends notifications via email and in-app alerts.

### Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

### License

This project is licensed under the MIT License. See the LICENSE file for details.