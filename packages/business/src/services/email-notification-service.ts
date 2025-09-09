export interface EmailNotificationService {
  sendEmail(params: {
    to: string | string[];
    subject: string;
    body: string;
    html?: string;
  }): Promise<void>;
}

export class MockEmailNotificationService implements EmailNotificationService {
  async sendEmail(params: {
    to: string | string[];
    subject: string;
    body: string;
    html?: string;
  }): Promise<void> {
    console.log('Mock email sent:', params);
  }
}