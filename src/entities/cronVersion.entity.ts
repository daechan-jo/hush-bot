import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';

import { UpdatedItem } from './updatedItem.entity';

@Entity()
export class CronVersion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cron_id', type: 'varchar', length: 255, unique: true })
  cronId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => UpdatedItem, (updatedItem) => updatedItem.cronVersion)
  updatedItems: UpdatedItem[];
}
