import { Module } from '@nestjs/common';
import { PuppeteerModule } from '../puppeteer/puppeteer.module';
import { SoldoutService } from './soldout.service';
import { CoupangModule } from '../coupang/coupang.module';
import { OnchModule } from '../onch/onch.module';
import { UtilModule } from '../util/util.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, PuppeteerModule, CoupangModule, OnchModule, UtilModule],
  providers: [SoldoutService],
  exports: [SoldoutService],
})
export class SoldoutModule {}
