import { Cron } from '@nestjs/schedule';
import { CronType } from '../../types/enum.types';
import { CoupangService } from '../coupang/coupang.service';
import { UtilService } from '../util/util.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export class ShippingService {
  constructor(
    private readonly coupangService: CoupangService,
    private readonly utilService: UtilService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @Cron('0 0 * * * *')
  async shippingCostCron(cronId?: string, retryCount = 0) {
    const isLocked = await this.redis.get('lock');
    const currentCronId = cronId || this.utilService.generateCronId();

    if (isLocked) {
      console.log(`${CronType.SHIPPING}${currentCronId}: 락 획득 실패-1분 후 재시도`);
      setTimeout(() => this.shippingCostCron(currentCronId), 60000);
      return;
    }

    try {
      await this.redis.set('lock', 'locked');
      console.log(`${CronType.SHIPPING}${cronId}: 시작`);

      await this.coupangService.shippingCostManagement(cronId);
    } catch (error) {
      console.error(`${CronType.ERROR}${CronType.SHIPPING}${currentCronId}: 오류 발생\n`, error);
      if (retryCount < 3) {
        console.log(`${CronType.SHIPPING}${currentCronId}: ${retryCount + 1}번째 재시도 예정`);
        setTimeout(() => this.shippingCostCron(cronId, retryCount + 1), 3000);
      } else {
        console.error(`${CronType.ERROR}${CronType.SHIPPING}${currentCronId}: 재시도 횟수 초과`);
      }
    } finally {
      await this.redis.del('lock');
      console.log(`${CronType.SHIPPING}${cronId}: 종료`);
    }
  }
}
