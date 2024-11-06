import * as nodemailer from 'nodemailer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly adminEmails: string[];

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: this.configService.get<string>('EMAIL_SERVICE'),
      host: this.configService.get<string>('EMAIL_HOST'),
      port: this.configService.get<number>('EMAIL_PORT'),
      secure: this.configService.get<boolean>('EMAIL_SECURE'),
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
    });
    this.adminEmails = [
      this.configService.get<string>('ADMIN_EMAIL_1'),
      this.configService.get<string>('ADMIN_EMAIL_2'),
    ];
  }

  async sendDeletionEmail(sellerProductId: number, productName: string): Promise<void> {
    const mailOptions = {
      from: `"Hush-BOT"`,
      to: this.adminEmails,
      subject: `품절 상품 삭제 알림 - ${productName}`,
      html: `
        <h3>상품 삭제 알림</h3>
        <p>아래 상품이 삭제되었습니다:</p>
        <ul>
          <li>상품 ID: ${sellerProductId}</li>
          <li>상품명: ${productName}</li>
        </ul>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`삭제 알림 이메일 발송 성공 (상품명: ${productName})`);
    } catch (error) {
      console.error(`삭제 알림 이메일 발송 실패 (상품명: ${productName}):`, error.message);
    }
  }
}
