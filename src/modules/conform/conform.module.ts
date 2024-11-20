import { Module } from '@nestjs/common';
import { ConformService } from './conform.service';
import { PuppeteerModule } from '../puppeteer/puppeteer.module';
import { CoupangModule } from '../coupang/coupang.module';

@Module({
  imports: [PuppeteerModule, CoupangModule],
  providers: [ConformService],
  exports: [ConformService],
})
export class ConformModule {}
