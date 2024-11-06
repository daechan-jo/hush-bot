import { Module } from '@nestjs/common';
import { CoupangService } from './coupang.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MailModule],
  providers: [CoupangService],
  exports: [CoupangService],
})
export class CoupangModule {}
