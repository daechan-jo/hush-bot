import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

import { CronType } from '../../types/enum.types';
import { CoupangService } from '../coupang/coupang.service';
import { UtilService } from '../util/util.service';

export class ShippingService {
  constructor(
    private readonly coupangService: CoupangService,
    private readonly utilService: UtilService,
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Cron('0 0 1 * * *')
  async shippingCostCron(cronId?: string, retryCount = 0) {
    const lockKey = `lock:${this.configService.get<string>('STORE')}`;
    const lockValue = Date.now().toString();
    const currentCronId = cronId || this.utilService.generateCronId();

    const isLocked = await this.redis.set(lockKey, lockValue, 'NX');
    if (!isLocked) {
      console.log(`${CronType.SHIPPING}${currentCronId}: 락 획득 실패-1분 후 재시도`);
      setTimeout(() => this.shippingCostCron(currentCronId), 60000);
      return;
    }

    try {
      console.log(`${CronType.SHIPPING}${currentCronId}: 시작`);
      await this.coupangService.shippingCostManagement(currentCronId);
    } catch (error) {
      console.error(`${CronType.ERROR}${CronType.SHIPPING}${currentCronId}: 오류 발생\n`, error);
      if (retryCount < 3) {
        console.log(`${CronType.SHIPPING}${currentCronId}: ${retryCount + 1}번째 재시도 예정`);
        setTimeout(() => this.shippingCostCron(currentCronId, retryCount + 1), 3000);
      } else {
        console.error(`${CronType.ERROR}${CronType.SHIPPING}${currentCronId}: 재시도 횟수 초과`);
      }
    } finally {
      await this.redis.del(`lock:${this.configService.get<string>('STORE')}`);
      console.log(`${CronType.SHIPPING}${currentCronId}: 종료`);
    }
  }
}
