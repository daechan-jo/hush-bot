import { Injectable } from '@nestjs/common';

@Injectable()
export class TaskService {
  private isRunning = false;
  private lock = false;

  async acquireLock(): Promise<boolean> {
    if (this.lock) {
      return false;
    }
    this.lock = true;
    return true;
  }

  releaseLock() {
    this.lock = false;
  }

  async getRunningStatus() {
    return this.isRunning;
  }

  async setRunningStatus(status: boolean) {
    this.isRunning = status;
  }
}
