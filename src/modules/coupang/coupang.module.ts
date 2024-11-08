import { Module } from '@nestjs/common';
import { CoupangService } from './coupang.service';
import { MailModule } from '../mail/mail.module';
import { DataModule } from '../data/data.module';

@Module({
  imports: [MailModule, DataModule],
  providers: [CoupangService],
  exports: [CoupangService],
})
export class CoupangModule {}
