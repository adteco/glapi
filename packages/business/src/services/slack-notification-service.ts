export interface SlackNotificationService {
  sendMessage(params: {
    channel: string;
    text: string;
    attachments?: any[];
  }): Promise<void>;
}

export class MockSlackNotificationService implements SlackNotificationService {
  async sendMessage(params: {
    channel: string;
    text: string;
    attachments?: any[];
  }): Promise<void> {
    console.log('Mock Slack message sent:', params);
  }
}