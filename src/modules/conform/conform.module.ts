import { Module } from '@nestjs/common';
import { ConformService } from './conform.service';
import { PuppeteerModule } from '../puppeteer/puppeteer.module';
import { CoupangModule } from '../coupang/coupang.module';
import { OnchModule } from '../onch/onch.module';

@Module({
  imports: [PuppeteerModule, CoupangModule, OnchModule],
  providers: [ConformService],
  exports: [ConformService],
})
export class ConformModule {}
