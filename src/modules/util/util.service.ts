import { Injectable } from '@nestjs/common';
import moment from 'moment-timezone';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UtilService {
  constructor() {}

  generateCronId(): string {
    return uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
  }

  createYesterdayKoreaTime() {
    return moment.tz('Asia/Seoul').subtract(1, 'days').toDate();
  }

  convertKoreaTime(dateString: string) {
    return moment.utc(dateString).tz('Asia/Seoul').toDate();
  }
}
