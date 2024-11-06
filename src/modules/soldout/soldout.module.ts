import { Module } from '@nestjs/common';
import { PuppeteerModule } from '../auth/puppeteer.module';
import { SoldoutService } from './soldout.service';
import { DataModule } from '../data/data.module';
import { CoupangModule } from '../coupang/coupang.module';

@Module({
  imports: [PuppeteerModule, DataModule, CoupangModule],
  providers: [SoldoutService],
  exports: [SoldoutService],
})
export class SoldoutModule {}
