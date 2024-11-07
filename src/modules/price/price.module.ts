import { Module } from '@nestjs/common';
import { PuppeteerModule } from '../auth/puppeteer.module';
import { DataModule } from '../data/data.module';
import { CoupangModule } from '../coupang/coupang.module';
import { PriceService } from './price.service';
import { TaskModule } from '../task/task.module';

@Module({
  imports: [PuppeteerModule, DataModule, CoupangModule, TaskModule],
  providers: [PriceService],
  exports: [PriceService],
})
export class PriceModule {}
