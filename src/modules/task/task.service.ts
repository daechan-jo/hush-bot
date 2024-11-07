import { Injectable } from '@nestjs/common';

@Injectable()
export class TaskService {
  private isRunning = false;

  async getRunningStatus() {
    return this.isRunning;
  }

  async setRunningStatus(status: boolean) {
    this.isRunning = status;
  }
}
