import { Module } from '@nestjs/common';
import { DataService } from './data.service';

@Module({
  imports: [],
  providers: [DataService],
  exports: [DataService],
})
export class DataModule {}
