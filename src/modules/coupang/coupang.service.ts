import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as XLSX from 'xlsx';

import { CronType } from '../../types/enum.types';
import { MailService } from '../mail/mail.service';
import { PriceRepository } from '../price/price.repository';

@Injectable()
export class CoupangService {
  private readonly secretKey: string;
  private readonly accessKey: string;
  private readonly vendorId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly priceRepository: PriceRepository,
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

  async fetchCoupangSellerProducts(cronId: string, type: string) {
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
      console.error(
        `${CronType.ERROR}${type}${cronId}: API 요청 오류:`,
        error.response?.data || error.message,
      );
      throw new Error('쿠팡 API 요청 실패');
    }
  }

  async fetchCoupangProductDetails(cronId: string, type: string, sellerProductId: number) {
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
        `${CronType.ERROR}${type}${cronId}: 상품 상세 조회 오류 (sellerProductId-${sellerProductId}):`,
        error.response?.data || error.message,
      );
      throw new Error('쿠팡 상품 상세 조회 실패');
    }
  }

  async itemStopSale(cronId: string, type: string, vendorItemId: number) {
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

      console.log(
        `${type}${cronId}: 아이템 판매 중지 성공 vendorItemId-${vendorItemId}\n`,
        response.data,
      );
    } catch (error) {
      console.error(
        `${CronType.ERROR}${type}${cronId}: 아이템 판매 중지 실패 vendorItemId-${vendorItemId}\n`,
        error.response?.data || error.message,
      );
    }
  }

  async stopSaleForMatchedProducts(cronId: string, type: string, matchedProducts: any[]) {
    console.log(`${type}${cronId}: 쿠팡 아이템 판매 중지 시작...`);

    const detailedProducts = [];
    for (const product of matchedProducts) {
      const details = await this.fetchCoupangProductDetails(cronId, type, product.sellerProductId);
      detailedProducts.push(details);
    }

    for (const productDetail of detailedProducts) {
      if (productDetail && productDetail.data && productDetail.data.items) {
        const items = productDetail.data.items;

        for (const item of items) {
          await this.itemStopSale(cronId, type, item.vendorItemId);
        }
      }
    }
  }

  async deleteProducts(cronId: string, type: string, matchedProducts: any[]) {
    console.log(`${type}${cronId}: 쿠팡 상품 삭제 시작...`);

    const deletedProducts: { sellerProductId: number; productName: string }[] = [];
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

        console.log(
          `${type}${cronId}: 상품 삭제 성공 sellerProductId-${product.sellerProductId}\n`,
          response.data,
        );

        deletedProducts.push({
          sellerProductId: product.sellerProductId,
          productName: product.sellerProductName,
        });
      } catch (error) {
        console.error(
          `${CronType.ERROR}${type}${cronId}: 상품 삭제 실패 sellerProductId-${product.sellerProductId})\n`,
          error.response?.data || error.message,
        );
      }
    }
    if (deletedProducts.length > 0) {
      try {
        await this.mailService.sendBatchDeletionEmail(
          deletedProducts,
          type,
          this.configService.get<string>('STORE'),
        );
      } catch (error) {
        console.error(
          `${CronType.ERROR}${type}${cronId}: 삭제 알림 이메일 발송 실패\n`,
          error.message,
        );
      }
    }
  }

  async couPangProductsPriceControl(cronId: string, cronVersionId: number) {
    console.log(`${CronType.PRICE}${cronId}: 새로운 상품 가격 업데이트 시작`);

    let successCount = 0;
    let failedCount = 0;
    const updatedProducts = await this.priceRepository.getUpdatedProducts(cronVersionId);

    for (const product of updatedProducts) {
      try {
        // sellerProductId로 쿠팡 상품 상세 정보 가져오기
        const productDetail = await this.fetchCoupangProductDetails(
          cronId,
          CronType.PRICE,
          +product.sellerProductId,
        );

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
              successCount++;
            } catch (updateError) {
              console.error(
                `${CronType.ERROR}${CronType.PRICE}${cronId}: 가격 업데이트 오류 vendorItemId-${vendorItemId}\n`,
                updateError.response?.data || updateError.message,
              );
              failedCount++;
            }
          }
        }
      } catch (error) {
        console.error(
          `${CronType.ERROR}${CronType.PRICE}${cronId}:상품 상세 조회 오류 sellerProductId-${product.productCode}\n`,
          error.message,
        );
        failedCount++;
      }
    }

    const excelData = updatedProducts.map((product) => ({
      'Seller Product ID': product.sellerProductId,
      'Product Code': product.productCode,
      Action: product.action,
      'New Price': product.newPrice,
      'Current Price': product.currentPrice,
      'Current Is Winner': product.currentIsWinner,
      'Created At': product.createdAt,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'UpdatedProducts');

    const filePath = path.join(__dirname, `updated_products_${cronId}.xlsx`);
    XLSX.writeFile(workbook, filePath);

    setImmediate(() => {
      this.mailService
        .sendUpdateEmail(
          filePath,
          successCount,
          failedCount,
          this.configService.get<string>('STORE'),
        )
        .then(() => {
          console.log(`${CronType.PRICE}${cronId}: 엑셀 파일과 함께 이메일 전송 완료`);
          fs.unlinkSync(filePath);
        })
        .catch((error) => {
          console.error(
            `${CronType.ERROR}${CronType.PRICE}${cronId}: 이메일 전송 실패\n`,
            error.message,
          );
        });
    });

    console.log(`${CronType.PRICE}${cronId}: 상품 가격 업데이트 완료`);
  }

  async shippingCostManagement(cronId: string) {
    console.log(`${CronType.SHIPPING}${cronId}: 반품 배송비 관리 시작...`);

    const coupangProducts = await this.fetchCoupangSellerProducts(cronId, CronType.SHIPPING);

    let successCount = 0;
    let failedCount = 0;

    const productsToUpdate = coupangProducts.filter((product) => product.returnCharge !== 10000);

    if (productsToUpdate.length === 0) {
      console.log(
        `${CronType.SHIPPING}${cronId}: 모든 상품의 반품 배송비가 올바르게 설정되어 있음`,
      );
    }

    console.log(`${CronType.SHIPPING}${cronId}: ${productsToUpdate.length}개 수정 시작...`);

    for (const product of productsToUpdate) {
      const updatePath = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${product.sellerProductId}/partial`;
      const body = { sellerProductId: product.sellerProductId, returnCharge: 10000 };

      try {
        const { authorization, datetime } = await this.createHmacSignature(
          'PUT',
          updatePath,
          '',
          false,
        );

        await axios.put(`https://api-gateway.coupang.com${updatePath}`, body, {
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json;charset=UTF-8',
            'X-Coupang-Date': datetime,
          },
        });

        successCount++;
      } catch (updateError) {
        console.error(
          `${CronType.ERROR}${CronType.SHIPPING}${cronId}: 반품 배송비 업데이트 실패 SellerProductId-${product.sellerProductId}\n`,
          updateError.response?.data || updateError.message,
        );
        failedCount++;
      }
    }

    console.log(
      `${CronType.SHIPPING}${cronId}: 반품 배송비 관리 완료\n성공 ${successCount}개, 실패 ${failedCount}개`,
    );
  }
}
