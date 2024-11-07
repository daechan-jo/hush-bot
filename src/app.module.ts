import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import * as path from 'node:path';
import { PuppeteerModule } from './modules/auth/puppeteer.module';
import { SoldoutModule } from './modules/soldout/soldout.module';
import { SoldoutService } from './modules/soldout/soldout.service';
import { DataModule } from './modules/data/data.module';
import { CoupangModule } from './modules/coupang/coupang.module';
import { PriceModule } from './modules/price/price.module';
import { PriceService } from './modules/price/price.service';
import { PuppeteerService } from './modules/auth/puppeteer.service';
import { TaskModule } from './modules/task/task.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../.env'),
    }),
    PuppeteerModule,
    SoldoutModule,
    DataModule,
    CoupangModule,
    PriceModule,
    TaskModule,
  ],
  providers: [],
})
export class AppModule {
  constructor(
    private readonly soldoutService: SoldoutService,
    private readonly priceService: PriceService,
    private readonly puppeteerService: PuppeteerService,
  ) {}

  async onModuleInit() {
    await this.puppeteerService.init();
    // await this.soldoutService.soldOutCron();
    await this.priceService.autoPriceCron();

    // await this.priceService.calculateMarginAndAdjustPrices();
  }
}
