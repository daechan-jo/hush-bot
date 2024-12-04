import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ConformService } from './conform.service';
import { CoupangModule } from '../coupang/coupang.module';
import { MailModule } from '../mail/mail.module';
import { OnchModule } from '../onch/onch.module';
import { PuppeteerModule } from '../puppeteer/puppeteer.module';
import { UtilModule } from '../util/util.module';

@Module({
  imports: [ConfigModule, PuppeteerModule, CoupangModule, OnchModule, UtilModule, MailModule],
  providers: [ConformService],
  exports: [ConformService],
})
export class ConformModule {}
