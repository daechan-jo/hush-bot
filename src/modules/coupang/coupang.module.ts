import { forwardRef, Module } from '@nestjs/common';
import { CoupangService } from './coupang.service';
import { MailModule } from '../mail/mail.module';
import { CoupangRepository } from './coupang.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoupangProduct } from '../../entities/coupangProduct.entity';
import { PriceModule } from '../price/price.module';

@Module({
  imports: [TypeOrmModule.forFeature([CoupangProduct]), MailModule, forwardRef(() => PriceModule)],
  providers: [CoupangService, CoupangRepository],
  exports: [CoupangService, CoupangRepository],
})
export class CoupangModule {}
