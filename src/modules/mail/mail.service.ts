import * as path from 'node:path';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

import { CronType } from '../../types/enum.types';

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

  async sendDeletionEmail(
    sellerProductId: number,
    productName: string,
    type: string,
    store: string,
  ): Promise<void> {
    const mailOptions = {
      from: `"Hush-BOT"`,
      to: this.adminEmails,
      subject: `${type}-${store} 상품 삭제 알림 - ${productName}`,
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

  async sendBatchDeletionEmail(
    deletedProducts: { sellerProductId: number; productName: string }[],
    type: string,
    store: string,
  ): Promise<void> {
    const productListHtml = deletedProducts
      .map(
        (product) => `<li>상품 ID: ${product.sellerProductId}, 상품명: ${product.productName}</li>`,
      )
      .join('');

    const mailOptions = {
      from: `"Hush-BOT"`,
      to: this.adminEmails,
      subject: `${type}-${store} 상품 삭제 알림 - 총 ${deletedProducts.length}개 상품`,
      html: `
      <h3>상품 삭제 알림</h3>
      <p>아래 상품들이 삭제되었습니다:</p>
      <ul>
        ${productListHtml}
      </ul>
    `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('삭제 알림 이메일 발송 성공');
    } catch (error) {
      console.error('삭제 알림 이메일 발송 실패:', error.message);
    }
  }

  async sendUpdateEmail(
    filePath: string,
    successCount: number,
    failedCount: number,
    store: string,
  ): Promise<void> {
    const totalProducts = successCount + failedCount;
    const mailOptions = {
      from: `"Hush-BOT"`,
      to: this.adminEmails,
      subject: `${CronType.PRICE}-${store} 자동 상품 가격 업데이트 안내`,
      html: `
        <h3>상품 업데이트 알림</h3>
        <ul>
        	<li><strong>Total:</strong> ${totalProducts}</li>
        	<li><strong>성공:</strong> ${successCount}</li>
        	<li><strong>실패:</strong> ${failedCount}</li>
        </ul>
      `,
      attachments: [
        {
          filename: path.basename(filePath),
          path: filePath,
        },
      ],
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`자동 상품 가격 업데이트 알림 이메일 발송 성공`);
    } catch (error) {
      console.error(`자동 상품 가격 업데이트 알림 이메일 발송 실패:`, error.message);
    }
  }

  async sendSuccessOrders(result: any[], store: string) {
    const itemsHtml = result
      .map(
        (order) =>
          `<li>주문번호: ${order.orderId}, 주문인: ${order.ordererName}, 수취인: ${order.receiverName}, 상품: ${order.sellerProductName}, 옵션: ${order.sellerProductItemName}, 수량: ${order.shippingCount}</li>`,
      )
      .join('');

    const mailOptions = {
      from: `"Hush-BOT"`,
      to: this.adminEmails,
      subject: `${CronType.ORDER}-${store} 자동 발주 안내`,
      html: `
        <h3>발주 알림</h3>
        <ul>
          ${itemsHtml}
        </ul>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendFailedOrders(result: any[], store: string) {
    const itemsHtml = result
      .map(
        (order) =>
          `<li>주문번호: ${order.orderId}, 주문인: ${order.ordererName}, 수취인: ${order.receiverName}, 상품: ${order.sellerProductName}, 옵션: ${order.sellerProductItemName}, 수량: ${order.shippingCount}</li>`,
      )
      .join('');

    const mailOptions = {
      from: `"Hush-BOT"`,
      to: this.adminEmails,
      subject: `${CronType.ORDER}-${store} 자동 발주 실패 안내`,
      html: `
        <h3>발주 실패 알림</h3>
        <ul>
          ${itemsHtml}
        </ul>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendErrorMail(cronType: CronType, store: string, currentCronId: string) {
    const mailOptions = {
      from: `"Hush-BOT"`,
      to: this.adminEmails,
      subject: `${CronType.ERROR}${cronType}-${store} 에러 안내`,
      html: `
        <h3>크론작업 실패 - 확인요망</h3>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`에러 알림 이메일 발송 성공`);
    } catch (error) {
      console.error(`에러 알림 이메일 발송 실패:`, error.message);
    }
  }
}
