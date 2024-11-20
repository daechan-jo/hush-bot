import { Module } from '@nestjs/common';
import { PuppeteerModule } from '../puppeteer/puppeteer.module';
import { SoldoutService } from './soldout.service';
import { DataModule } from '../data/data.module';
import { CoupangModule } from '../coupang/coupang.module';
import { TaskModule } from '../task/task.module';
import { OnchModule } from '../onch/onch.module';

@Module({
  imports: [PuppeteerModule, DataModule, CoupangModule, TaskModule, OnchModule],
  providers: [SoldoutService],
  exports: [SoldoutService],
})
export class SoldoutModule {}
