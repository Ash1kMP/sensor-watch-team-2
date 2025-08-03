export class InAppNotificationService {
    private notifications: string[] = [];

    sendNotification(message: string): void {
        this.notifications.push(message);
        console.log(`In-app notification sent: ${message}`);
    }

    getNotifications(): string[] {
        return this.notifications;
    }

    clearNotifications(): void {
        this.notifications = [];
        console.log('All in-app notifications cleared.');
    }
}