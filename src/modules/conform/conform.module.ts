import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ConformService } from './conform.service';
import { CoupangModule } from '../coupang/coupang.module';
import { OnchModule } from '../onch/onch.module';
import { PuppeteerModule } from '../puppeteer/puppeteer.module';
import { UtilModule } from '../util/util.module';

@Module({
  imports: [ConfigModule, PuppeteerModule, CoupangModule, OnchModule, UtilModule],
  providers: [ConformService],
  exports: [ConformService],
})
export class ConformModule {}
