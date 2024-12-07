import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import moment from 'moment-timezone';

import { courierCode, courierNames } from './courier';
import { CronType } from '../../types/enum.type';
import { CoupangService } from '../coupang/coupang.service';
import { MailService } from '../mail/mail.service';
import { PuppeteerService } from '../puppeteer/puppeteer.service';
import { UtilService } from '../util/util.service';

@Injectable()
export class ShippingService {
  constructor(
    private readonly puppeteerService: PuppeteerService,
    private readonly utilService: UtilService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly coupangService: CoupangService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async waybillManagement(cronId: string) {
    const onchPage = await this.puppeteerService.loginToOnchSite();
    console.log(`${CronType.SHIPPING}${cronId}: 온채널 로그인...`);

    const lastCronTimeString = await this.redis.get('lastRun:shipping');
    let lastCronTime: Date;

    if (lastCronTimeString) {
      lastCronTime = this.utilService.convertKoreaTime(lastCronTimeString);

      console.log(`${CronType.SHIPPING}${cronId}: 마지막 실행 시간 ${lastCronTime}`);
    } else {
      lastCronTime = this.utilService.createYesterdayKoreaTime();

      await this.redis.set('lastRun:shipping', moment.tz('Asia/Seoul').toISOString());

      console.log(
        `${CronType.SHIPPING}${cronId}: 마지막 실행시간이 없습니다. 24시간 전으로 설정합니다.`,
      );
    }

    await this.redis.set('lastRun:shipping', moment.tz('Asia/Seoul').toISOString());

    await onchPage.goto('https://www.onch3.co.kr/admin_mem_prd.html', {
      timeout: 0,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(`${CronType.SHIPPING}${cronId}: 운송장 추출 시작`);

    onchPage.on('console', (msg) => {
      console.log('PAGE LOG:', msg.text());
    });

    const rows = await onchPage.$$eval(
      '.prd_list_li',
      (elements, lastCronTime, courierNames) => {
        return elements
          .map((row) => {
            // 날짜 가져오기
            const dateElement = row.querySelector('.prd_list_date font[color="#135bc8"]');
            if (!dateElement) return;

            const dateText = dateElement.textContent.trim();

            const formattedDateText = `${dateText.slice(0, 10)}T${dateText.slice(10)}`;

            const rowDate = new Date(formattedDateText);

            if (rowDate <= new Date(lastCronTime)) return;

            // 필요한 데이터 추출
            const nameElement = row.querySelector('.prd_list_name div');
            const name = nameElement?.childNodes[0]?.textContent.trim() || '';
            const phone = nameElement?.querySelector('font')?.textContent.trim() || '';

            // 배송 상태 및 세부 정보
            const stateElement = row.querySelector('.prd_list_state div');
            const state = stateElement?.querySelector('b')?.textContent.trim() || '';
            const paymentMethod =
              stateElement?.querySelector('font[style*="color:#555555"]')?.textContent.trim() || '';

            // 택배사 정보
            const courierRegex = new RegExp(`(${courierNames.join('|')})`);
            const stateText = (stateElement as HTMLElement)?.innerText || '';
            const courierMatch = stateText.match(courierRegex);
            const courier = courierMatch ? courierMatch[1] : '';

            // 송장 정보
            const trackingNumber =
              stateElement?.querySelector('font[style*="font-size: 15px"]')?.textContent.trim() ||
              '';

            return {
              name,
              phone,
              state,
              paymentMethod,
              courier,
              trackingNumber,
            };
          })
          .filter(Boolean);
      },
      lastCronTime,
      courierNames,
    );

    await this.puppeteerService.closeAllPages();

    if (rows.length === 0) {
      console.log(`${CronType.SHIPPING}${cronId}: 새로 등록된 운송장이 없습니다.`);
      return;
    }

    // 쿠팡에서 발주정보 조회
    const today = moment().format('YYYY-MM-DD');
    const thirtyDay = moment().subtract(30, 'days').format('YYYY-MM-DD');

    const coupangOrderList = await this.coupangService.getCoupangOrderList(
      cronId,
      CronType.SHIPPING,
      'INSTRUCT',
      this.configService.get<string>('COUPANG_VENDOR_ID'),
      today,
      thirtyDay,
    );

    const rowMap = {};
    rows.forEach((row) => {
      const key = `${row.name}-${row.phone}`;
      rowMap[key] = row;
    });

    const matchedOrders = coupangOrderList
      .filter((order) => {
        const key = `${order.receiver.name}-${order.receiver.safeNumber}`;
        return rowMap[key] !== undefined;
      })
      .map((order) => {
        const key = `${order.receiver.name}-${order.receiver.safeNumber}`;
        return {
          ...order,
          courier: rowMap[key],
        };
      });

    const updatedOrders = matchedOrders.map((order) => {
      const courierName = order.courier.courier;
      const deliveryCompanyCode = courierCode[courierName] || 'DIRECT';

      return {
        ...order,
        deliveryCompanyCode,
      };
    });

    const results = await this.coupangService.invoiceUpload(cronId, updatedOrders);

    const successInvoiceUploads = results.filter((result) => result.status === 'success');
    const failedInvoiceUploads = results.filter((result) => result.status === 'failed');

    if (successInvoiceUploads.length > 0) {
      setImmediate(() => {
        this.mailService
          .sendSuccessInvoiceUpload(successInvoiceUploads, this.configService.get<string>('STORE'))
          .then(() => {
            console.log(`${CronType.ORDER}${cronId}: 성공 이메일 전송 완료`);
          })
          .catch((error) => {
            console.error(
              `${CronType.ERROR}${CronType.ORDER}${cronId}: 성공 이메일 전송 실패\n`,
              error.message,
            );
          });
      });
    }

    if (failedInvoiceUploads.length > 0) {
      setImmediate(() => {
        this.mailService
          .sendFailedInvoiceUpload(failedInvoiceUploads, this.configService.get<string>('STORE'))
          .then(() => {
            console.log(`${CronType.ORDER}${cronId}: 실패 이메일 전송 완료`);
          })
          .catch((error) => {
            console.error(
              `${CronType.ERROR}${CronType.ORDER}${cronId}: 실패 이메일 전송 실패\n`,
              error.message,
            );
          });
      });
    }
  }

  async attemptShipping(cronId: string, retryCount = 1) {
    try {
      const nowTime = moment().format('HH:mm:ss');
      console.log(`${CronType.SHIPPING}${cronId}-${nowTime}: 운송장 등록 시작`);

      await this.waybillManagement(cronId);
    } catch (error) {
      if (retryCount < 10) {
        console.log(`${CronType.SHIPPING}${cronId}: ${retryCount + 1}번째 재시도 예정`);
        setTimeout(() => this.attemptShipping(cronId, retryCount + 1));
      } else {
        await this.mailService.sendErrorMail(
          CronType.SHIPPING,
          this.configService.get<string>('STORE'),
          cronId,
        );
        console.error(`${CronType.ERROR}${CronType.SHIPPING}${cronId}: 재시도 횟수 초과`);
      }
    }
  }

  async shippingCron(cronId: string) {
    try {
      await this.attemptShipping(cronId);
    } finally {
      console.log(`${CronType.SHIPPING}${cronId}: 운송장 등록 종료`);
    }
  }
}
