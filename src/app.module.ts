import * as path from 'node:path';

import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InjectRedis, RedisModule } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

import { redisConfig } from './config/redis.config';
import { TypeormConfig } from './config/typeorm.config';
import { ConformModule } from './modules/conform/conform.module';
import { ConformService } from './modules/conform/conform.service';
import { CoupangModule } from './modules/coupang/coupang.module';
import { CoupangRepository } from './modules/coupang/coupang.repository';
import { CoupangService } from './modules/coupang/coupang.service';
import { OnchModule } from './modules/onch/onch.module';
import { OnchRepository } from './modules/onch/onch.repository';
import { PriceModule } from './modules/price/price.module';
import { PriceService } from './modules/price/price.service';
import { PuppeteerModule } from './modules/puppeteer/puppeteer.module';
import { PuppeteerService } from './modules/puppeteer/puppeteer.service';
import { ShippingModule } from './modules/shipping/shipping.module';
import { ShippingService } from './modules/shipping/shipping.service';
import { SoldoutModule } from './modules/soldout/soldout.module';
import { SoldoutService } from './modules/soldout/soldout.service';
import { UtilModule } from './modules/util/util.module';

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
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async onApplicationBootstrap() {
    await this.redis.del(`lock:${this.configService.get<string>('STORE')}`);
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
