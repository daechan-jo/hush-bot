import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UtilService {
  constructor() {}

  generateCronId(): string {
    return uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
  }
}
