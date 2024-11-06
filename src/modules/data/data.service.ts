import * as fs from 'fs';
import { join } from 'path';
import { Injectable } from '@nestjs/common';

const dataFilePath = join(__dirname, '../../../data.json');

@Injectable()
export class DataService {
  private data: Record<string, any> = {};

  constructor() {
    this.load();
  }

  private load() {
    if (fs.existsSync(dataFilePath)) {
      const fileData = fs.readFileSync(dataFilePath, 'utf-8');
      this.data = JSON.parse(fileData);
    }
  }

  private save() {
    fs.writeFileSync(dataFilePath, JSON.stringify(this.data, null, 2));
  }

  public get(key: string): any {
    return this.data[key];
  }

  public set(key: string, value: any): void {
    this.data[key] = value;
    this.save();
  }

  public delete(key: string): void {
    delete this.data[key];
    this.save();
  }

  public setLastCronTime(date: Date): void {
    date.setMilliseconds(0);
    this.data.lastCronTime = date.toISOString();
    this.save();
  }

  // UTC 기준으로 반환
  public getLastCronTime(): Date | null {
    return this.data.lastCronTime ? new Date(this.data.lastCronTime) : null;
  }
}
