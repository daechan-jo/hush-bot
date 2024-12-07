import { Module } from '@nestjs/common';

import { ShippingService } from './shipping.service';
import { CoupangModule } from '../coupang/coupang.module';
import { MailModule } from '../mail/mail.module';
import { PuppeteerModule } from '../puppeteer/puppeteer.module';
import { UtilModule } from '../util/util.module';

@Module({
  imports: [PuppeteerModule, UtilModule, MailModule, CoupangModule],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
