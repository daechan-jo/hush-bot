import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import moment from 'moment-timezone';

import { CronType } from '../../types/enum.type';
import { ConformService } from '../conform/conform.service';
import { OrderService } from '../order/order.service';
import { ShippingService } from '../shipping/shipping.service';
import { SoldoutService } from '../soldout/soldout.service';
import { UtilService } from '../util/util.service';

@Injectable()
export class UnityService {
  constructor(
    private readonly soldoutService: SoldoutService,
    private readonly conformService: ConformService,
    private readonly orderService: OrderService,
    private readonly configService: ConfigService,
    private readonly utilService: UtilService,
    private readonly shippingService: ShippingService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Cron('0 */5 * * * *')
  async unityCron() {
    const lockKey = `lock:${this.configService.get<string>('STORE')}`;
    const lockValue = Date.now().toString();
    const cronId = this.utilService.generateCronId();

    const isLocked = await this.redis.set(lockKey, lockValue, 'NX');
    if (!isLocked) {
      console.log(`${CronType.HUSH}${cronId}: 락 획득 실패 - 다른 작업 실행중`);
      return;
    }

    try {
      const nowTime = moment().format('HH:mm:ss');
      console.log(`${CronType.HUSH}${cronId}-${nowTime}: 유니티 크론 시작`);

      await this.shippingService.shippingCron(cronId);
      // await this.soldoutService.soldOutCron(cronId);
      // await this.conformService.conformCron(cronId);
      // await this.orderService.orderCron(cronId);
    } catch (error) {
      console.error(`${CronType.ERROR}${CronType.HUSH}${cronId}:`, error);
    } finally {
      await this.redis.del(lockKey);
      console.log(`${CronType.HUSH}${cronId}: 작업완료`);
    }
  }
}
