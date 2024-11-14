import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';

import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { DataService } from '../data/data.service';

@Injectable()
export class CoupangService {
  private readonly secretKey: string;
  private readonly accessKey: string;
  private readonly vendorId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly dataService: DataService,
  ) {
    this.secretKey = this.configService.get<string>('COUPANG_SECRET_KEY');
    this.accessKey = this.configService.get<string>('COUPANG_ACCESS_KEY');
    this.vendorId = this.configService.get<string>('COUPANG_VENDOR_ID');
  }

  async createHmacSignature(
    method: string,
    path: string,
    nextToken: string = '',
    useQuery: boolean = true,
  ) {
    const datetime =
      new Date().toISOString().substr(2, 17).replace(/:/gi, '').replace(/-/gi, '') + 'Z';

    const query = useQuery
      ? new URLSearchParams({
          vendorId: this.vendorId,
          nextToken,
          maxPerPage: '100',
          status: 'APPROVED',
        }).toString()
      : '';

    const message = datetime + method + path + query;

    const signature = crypto.createHmac('sha256', this.secretKey).update(message).digest('hex');

    const authorization = `CEA algorithm=HmacSHA256, access-key=${this.accessKey}, signed-date=${datetime}, signature=${signature}`;

    return { authorization, datetime };
  }

  async fetchCoupangSellerProducts() {
    const apiPath = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products';

    let nextToken = '';
    const allProducts = [];
    try {
      while (true) {
        const { authorization, datetime } = await this.createHmacSignature(
          'GET',
          apiPath,
          nextToken,
          true,
        );

        const response = await axios.get(`https://api-gateway.coupang.com${apiPath}`, {
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json;charset=UTF-8',
            'X-EXTENDED-TIMEOUT': '90000',
            'X-Coupang-Date': datetime,
          },
          params: {
            vendorId: this.vendorId,
            nextToken: nextToken,
            maxPerPage: 100,
            status: 'APPROVED',
          },
        });

        const { data } = response.data;
        allProducts.push(...data);

        nextToken = response.data.nextToken;
        if (!nextToken) break;
      }

      return allProducts;
    } catch (error) {
      console.error('API 요청 오류:', error.response?.data || error.message);
      throw new Error('쿠팡 API 요청 실패');
    }
  }

  async fetchCoupangProductDetails(sellerProductId: number) {
    const apiPath = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${sellerProductId}`;

    const { authorization, datetime } = await this.createHmacSignature('GET', apiPath, '', false);

    try {
      const response = await axios.get(`https://api-gateway.coupang.com${apiPath}`, {
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json;charset=UTF-8',
          'X-EXTENDED-TIMEOUT': '90000',
          'X-Coupang-Date': datetime,
        },
      });

      return response.data;
    } catch (error) {
      console.error(
        `상품 상세 조회 오류 (sellerProductId: ${sellerProductId}):`,
        error.response?.data || error.message,
      );
      throw new Error('쿠팡 상품 상세 조회 실패');
    }
  }

  async itemStopSale(vendorItemId: number) {
    const apiPath = `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/${vendorItemId}/sales/stop`;

    const { authorization, datetime } = await this.createHmacSignature('PUT', apiPath, '', false);

    try {
      const response = await axios.put(`https://api-gateway.coupang.com${apiPath}`, null, {
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json;charset=UTF-8',
          'X-EXTENDED-TIMEOUT': '90000',
          'X-Coupang-Date': datetime,
        },
      });

      console.log(`아이템 판매 중지 성공 (itemId: ${vendorItemId}):`, response.data);
    } catch (error) {
      console.error(
        `아이템 판매 중지 실패 (itemId: ${vendorItemId}):`,
        error.response?.data || error.message,
      );
    }
  }

  async stopSaleForMatchedProducts(matchedProducts: any[]) {
    const detailedProducts = [];
    for (const product of matchedProducts) {
      const details = await this.fetchCoupangProductDetails(product.sellerProductId);
      detailedProducts.push(details);
    }

    for (const productDetail of detailedProducts) {
      if (productDetail && productDetail.data && productDetail.data.items) {
        const items = productDetail.data.items;

        // 각 아이템에 대해 판매 중지 요청
        for (const item of items) {
          await this.itemStopSale(item.vendorItemId);
        }
      }
    }
  }

  async deleteProducts(matchedProducts: any[], type: string) {
    for (const product of matchedProducts) {
      const apiPath = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${product.sellerProductId}`;

      const { authorization, datetime } = await this.createHmacSignature(
        'DELETE',
        apiPath,
        '',
        false,
      );

      try {
        const response = await axios.delete(`https://api-gateway.coupang.com${apiPath}`, {
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json;charset=UTF-8',
            'X-EXTENDED-TIMEOUT': '90000',
            'X-Coupang-Date': datetime,
          },
        });

        console.log(`상품 삭제 성공 (sellerProductId: ${product.sellerProductId}):`, response.data);

        setImmediate(() => {
          this.mailService
            .sendDeletionEmail(product.sellerProductId, product.sellerProductName, type)
            .catch((error) => {
              console.error(
                `비동기 메일 발송 실패 (상품명: ${product.sellerProductName}):`,
                error.message,
              );
            });
        });
      } catch (error) {
        console.error(
          `상품 삭제 실패 (sellerProductId: ${product.sellerProductId}):`,
          error.response?.data || error.message,
        );
      }
    }
  }

  async couPangProductsPriceControl() {
    console.log(`자동 가격 조절: 상품 가격 업데이트 시작`);

    const sellerProductIds = [];

    const updatedProducts = await this.dataService.get('updatedProducts');

    for (const product of updatedProducts) {
      try {
        // sellerProductId로 쿠팡 상품 상세 정보 가져오기
        const productDetail = await this.fetchCoupangProductDetails(product.sellerProductId);

        // items 배열에서 각 vendorItemId를 추출하여 가격 업데이트
        if (productDetail && productDetail.data && productDetail.data.items) {
          const items = productDetail.data.items;

          for (const item of items) {
            const vendorItemId = item.vendorItemId;

            const priceUpdatePath = `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/${vendorItemId}/prices/${product.newPrice}`;

            const { authorization, datetime } = await this.createHmacSignature(
              'PUT',
              priceUpdatePath,
              '',
              false,
            );

            try {
              await axios.put(`https://api-gateway.coupang.com${priceUpdatePath}`, null, {
                headers: {
                  Authorization: authorization,
                  'Content-Type': 'application/json;charset=UTF-8',
                  'X-Coupang-Date': datetime,
                },
              });
              sellerProductIds.push(product.sellerProductId);
            } catch (updateError) {
              console.error(
                `가격 업데이트 오류 (vendorItemId: ${vendorItemId}):`,
                updateError.response?.data || updateError.message,
              );
            }
          }
        }
      } catch (error) {
        console.error(
          `상품 상세 조회 오류 (sellerProductId: ${product.sellerProductId}):`,
          error.message,
        );
      }
    }

    setImmediate(() => {
      this.mailService.sendUpdateEmail(sellerProductIds).catch((error) => {
        console.error(`비동기 메일 발송 실패 (상품 업데이트):`, error.message);
      });
    });

    // this.dataService.delete('updatedProducts');

    console.log(`자동 가격 조절: 상품 가격 업데이트 완료`);
  }
}
