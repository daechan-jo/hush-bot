import * as readline from 'node:readline';

import { Injectable } from '@nestjs/common';
import * as cliProgress from 'cli-progress';
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

  convertKoreaTime(dateString: string): Date {
    return moment.utc(dateString).tz('Asia/Seoul').toDate();
  }

  removeFirstWord(str: string) {
    const words = str.trim().split(' ');
    return words.slice(1).join(' ');
  }

  moveCursorToProgressBar(num: number) {
    // 진행바 위치로 이동 (맨 밑줄로 이동)
    readline.cursorTo(process.stdout, 0);
    readline.moveCursor(process.stdout, 0, num); // 로그 줄 아래로 이동
  }

  resetCursorAboveProgressBar(num: number) {
    // 로그 출력 위치로 이동 (진행바 위로 이동)
    readline.moveCursor(process.stdout, 0, -num);
    readline.cursorTo(process.stdout, 0);
  }

  initProgressBar() {
    return new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  }
}
