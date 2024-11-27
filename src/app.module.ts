import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import * as path from 'node:path';
import { PuppeteerModule } from './modules/puppeteer/puppeteer.module';
import { SoldoutModule } from './modules/soldout/soldout.module';
import { SoldoutService } from './modules/soldout/soldout.service';
import { CoupangModule } from './modules/coupang/coupang.module';
import { PriceModule } from './modules/price/price.module';
import { PriceService } from './modules/price/price.service';
import { PuppeteerService } from './modules/puppeteer/puppeteer.service';
import { CoupangService } from './modules/coupang/coupang.service';
import { ConformModule } from './modules/conform/conform.module';
import { ConformService } from './modules/conform/conform.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeormConfig } from './config/typeorm.config';
import { InjectRedis, RedisModule } from '@nestjs-modules/ioredis';
import { redisConfig } from './config/redis.config';
import { OnchModule } from './modules/onch/onch.module';
import Redis from 'ioredis';
import { UtilModule } from './modules/util/util.module';
import { OnchRepository } from './modules/onch/onch.repository';
import { CoupangRepository } from './modules/coupang/coupang.repository';
import { ShippingModule } from './modules/shipping/shipping.module';
import { ShippingService } from './modules/shipping/shipping.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../.env'),
    }),
    TypeOrmModule.forRootAsync(TypeormConfig),
    RedisModule.forRootAsync({
      useFactory: () => redisConfig,
    }),
    PuppeteerModule,
    SoldoutModule,
    CoupangModule,
    PriceModule,
    ConformModule,
    OnchModule,
    UtilModule,
    ShippingModule,
  ],
  providers: [],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(
    private readonly soldoutService: SoldoutService,
    private readonly priceService: PriceService,
    private readonly puppeteerService: PuppeteerService,
    private readonly conformService: ConformService,
    private readonly onchRepository: OnchRepository,
    private readonly coupangRepository: CoupangRepository,
    private readonly coupangService: CoupangService,
    private readonly shippingService: ShippingService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async onApplicationBootstrap() {
    await this.redis.del('lock');
    await this.onchRepository.clearOnchProducts();
    await this.coupangRepository.clearCoupangProducts();

    setTimeout(async () => {
      await this.puppeteerService.init();
      // await this.soldoutService.soldOutCron();
      // await this.conformService.conformCron();
      // await this.shippingService.shippingCostCron();
      // await this.priceService.autoPriceCron();
    }, 100);
  }
}
