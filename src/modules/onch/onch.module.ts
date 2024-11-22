import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { OnchService } from './onch.service';
import { OnchRepository } from './onch.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnchProduct } from '../../entities/onchProduct.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OnchProduct]), MailModule],
  providers: [OnchService, OnchRepository],
  exports: [OnchService, OnchRepository],
})
export class OnchModule {}
