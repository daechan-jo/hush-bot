import {
  Index,
  ManyToOne,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CronVersion } from './cronVersion.entity';

@Entity()
export class UpdatedProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'seller_product_id', type: 'varchar', length: 255, nullable: true })
  sellerProductId: string;

  @Column({ name: 'product_code', type: 'varchar', length: 255, nullable: true })
  productCode: string;

  @Column({ type: 'varchar', nullable: true })
  action: string;

  @Column({ name: 'new_price', type: 'int', nullable: true })
  newPrice: number;

  @Column({ name: 'current_price', type: 'int', nullable: true })
  currentPrice: number;

  @Column({ name: 'current_is_winner', type: 'boolean', nullable: true })
  currentIsWinner: boolean;

  @Index()
  @ManyToOne(() => CronVersion, (cronVersion) => cronVersion.updatedProducts, { nullable: false })
  cronVersion: CronVersion;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
