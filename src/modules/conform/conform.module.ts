import { Module } from '@nestjs/common';
import { ConformService } from './conform.service';
import { PuppeteerModule } from '../puppeteer/puppeteer.module';
import { DataModule } from '../data/data.module';
import { CoupangModule } from '../coupang/coupang.module';
import { TaskModule } from '../task/task.module';

@Module({
  imports: [PuppeteerModule, DataModule, CoupangModule, TaskModule],
  providers: [ConformService],
  exports: [ConformService],
})
export class ConformModule {}
