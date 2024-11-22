import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class CoupangProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'seller_product_id', type: 'varchar', length: 255, nullable: true })
  sellerProductId: string;

  @Column({ name: 'product_code', type: 'varchar', length: 255, nullable: true })
  productCode: string;

  @Column({ name: 'is_winner', type: 'boolean', default: false })
  isWinner: boolean;

  @Column({ type: 'int', nullable: true })
  price: number;

  @Column({ name: 'shipping_cost', type: 'int', nullable: true })
  shippingCost: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
