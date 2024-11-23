import { Module } from '@nestjs/common';
import { ConformService } from './conform.service';
import { PuppeteerModule } from '../puppeteer/puppeteer.module';
import { CoupangModule } from '../coupang/coupang.module';
import { OnchModule } from '../onch/onch.module';
import { UtilModule } from '../util/util.module';

@Module({
  imports: [PuppeteerModule, CoupangModule, OnchModule, UtilModule],
  providers: [ConformService],
  exports: [ConformService],
})
export class ConformModule {}
