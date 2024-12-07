import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RefeeService } from './refee.service';
import { CoupangModule } from '../coupang/coupang.module';
import { MailModule } from '../mail/mail.module';
import { UtilModule } from '../util/util.module';

@Module({
  imports: [ConfigModule, CoupangModule, UtilModule, MailModule],
  providers: [RefeeService],
  exports: [RefeeService],
})
export class RefeeModule {}
