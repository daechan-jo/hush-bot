import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import * as path from 'node:path';
import { PuppeteerModule } from './modules/puppeteer/puppeteer.module';
import { SoldoutModule } from './modules/soldout/soldout.module';
import { SoldoutService } from './modules/soldout/soldout.service';
import { DataModule } from './modules/data/data.module';
import { CoupangModule } from './modules/coupang/coupang.module';
import { PriceModule } from './modules/price/price.module';
import { PriceService } from './modules/price/price.service';
import { PuppeteerService } from './modules/puppeteer/puppeteer.service';
import { TaskModule } from './modules/task/task.module';
import { CoupangService } from './modules/coupang/coupang.service';
import { ConformModule } from './modules/conform/conform.module';
import { ConformService } from './modules/conform/conform.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeormConfig } from './config/typeorm.config';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../.env'),
    }),
    TypeOrmModule.forRootAsync(TypeormConfig),
    PuppeteerModule,
    SoldoutModule,
    DataModule,
    CoupangModule,
    PriceModule,
    TaskModule,
    ConformModule,
  ],
  providers: [],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(
    private readonly soldoutService: SoldoutService,
    private readonly priceService: PriceService,
    private readonly puppeteerService: PuppeteerService,
    private readonly coupangService: CoupangService,
    private readonly conformService: ConformService,
  ) {}

  async onApplicationBootstrap() {
    setTimeout(async () => {
      await this.puppeteerService.init();
      // await this.priceService.autoPriceCron();
      // await this.soldoutService.soldOutCron();
      // await this.conformService.conformCron();
    }, 100);
  }
}
