import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { DataModule } from '../data/data.module';
import { OnchService } from './onch.service';

@Module({
  imports: [MailModule, DataModule],
  providers: [OnchService],
  exports: [OnchService],
})
export class OnchModule {}
