import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class OnchProduct {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_code', type: 'varchar', length: 255, nullable: true })
  productCode: string;

  @Column({ name: 'consumer_price', type: 'int', nullable: true })
  consumerPrice: number;

  @Column({ name: 'seller_price', type: 'int', nullable: true })
  sellerPrice: number;

  @Column({ name: 'shipping_cost', type: 'int', nullable: true })
  shippingCost: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
