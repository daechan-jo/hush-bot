import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
