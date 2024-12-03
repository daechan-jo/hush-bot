import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import moment from 'moment';

import { CronType } from '../../types/enum.types';
import { CoupangService } from '../coupang/coupang.service';
import { PuppeteerService } from '../puppeteer/puppeteer.service';
import { UtilService } from '../util/util.service';

export class OrderService {
  constructor(
    private readonly coupangService: CoupangService,
    private readonly utilService: UtilService,
    private readonly configService: ConfigService,
    private readonly puppeteerService: PuppeteerService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async orderManagement(cronId: string) {
    const today = moment().format('YYYY-MM-DD');
    const newOrderProducts = await this.coupangService.getCoupangOrderList(
      cronId,
      CronType.ORDER,
      this.configService.get<string>('COUPANG_VENDOR_ID'),
      today,
    );

    const onchPage = await this.puppeteerService.loginToOnchSite();

    for (const order of newOrderProducts) {
      for (const item of order.orderItems) {
        const externalCode = item.externalVendorSkuCode;
        const sellerProductName = item.sellerProductName;
      }
    }
  }

  // @Cron('0 0 * * * *')
  async OrderCron(cronId?: string, retryCount = 0) {
    const lockKey = `lock:${this.configService.get<string>('STORE')}`;
    const lockValue = Date.now().toString();
    const currentCronId = cronId || this.utilService.generateCronId();

    const isLocked = await this.redis.set(lockKey, lockValue, 'NX');

    if (!isLocked) {
      console.log(`${CronType.ORDER}${currentCronId}: 락 획득 실패-1분 후 재시도`);
      setTimeout(() => this.OrderCron(currentCronId), 60000);
      return;
    }

    try {
      console.log(`${CronType.ORDER}${cronId}: 시작`);

      await this.orderManagement(cronId);
    } catch (error) {
      console.error(`${CronType.ERROR}${CronType.ORDER}${currentCronId}: 오류 발생\n`, error);
      if (retryCount < 3) {
        console.log(`${CronType.ORDER}${currentCronId}: ${retryCount + 1}번째 재시도 예정`);
        setTimeout(() => this.OrderCron(cronId, retryCount + 1), 3000);
      } else {
        console.error(`${CronType.ERROR}${CronType.ORDER}${currentCronId}: 재시도 횟수 초과`);
      }
    } finally {
      await this.redis.del(`lock:${this.configService.get<string>('STORE')}`);
      console.log(`${CronType.ORDER}${cronId}: 종료`);
    }
  }
}
