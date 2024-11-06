import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import * as path from 'node:path';
import { DataService } from './data.service';
import { CoupangService } from './coupang.service';
import { MailService } from './mail.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../.env'),
    }),
  ],
  providers: [AppService, DataService, CoupangService, MailService],
})
export class AppModule {
  constructor(private readonly appService: AppService) {}

  async onModuleInit() {
    await this.appService.handleCron();
  }
}
