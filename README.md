# Hush-BOT: ChannelON-Coupang 품절 상품 자동 삭제 및 알림 시스템

이 프로젝트는 **Coupang**에 등록된 **ChannelON**의 상품 중 품절된 상품을 자동으로 탐지하고 하위 아이템을 판매 중지한 후 최종 상품을 삭제하는 기능을 제공합니다. 삭제된 상품 정보는 관리자에게
**이메일**로 알림됩니다. 이 시스템은 **NestJS**, **Puppeteer**, 및 **Nodemailer**를 사용하여 구현되었습니다.

## 주요 기능

1. **자동 크롤링 및 품절 상품 탐지**: 10분마다 On채널 사이트를 크롤링하여 새로운 품절 상품을 탐지합니다.
2. **Coupang API와의 통신**: 품절된 상품의 하위 아이템을 판매 중지한 뒤 상품을 삭제합니다.
3. **관리자 이메일 알림**: 삭제된 상품 정보가 설정된 관리자 이메일로 발송됩니다.

## 동작 과정

1. **크롤링 및 품절 상품 탐지**:
	- `SoldoutService`는 10분 간격으로 On채널 사이트를 크롤링하여 최근 품절된 상품을 식별합니다.
	- 크롤링된 품절 상품 코드는 `CoupangService`로 전달됩니다.

2. **Coupang API와 통신**:
	- `CoupangService`는 전달받은 품절 상품 코드로 각 상품의 하위 아이템을 `판매 중지`합니다.
	- 하위 아이템의 판매 중지 작업이 완료되면 해당 상품을 `삭제`합니다.

3. **관리자 이메일 알림**:
	- 상품이 삭제될 때마다, `MailService`를 통해 관리자들에게 삭제 알림 이메일이 발송됩니다.
	- 이메일 발송은 비동기 처리되어 삭제 작업 흐름에 영향을 주지 않습니다.

## 사용법

### 1. 환경 변수 설정

아래 환경 변수를 `.env` 파일에 설정해야 합니다:

- **On채널 크롤링 계정 정보**
	- `ON_CHANNEL_EMAIL`: On채널 계정 이메일
	- `ON_CHANNEL_PASSWORD`: On채널 계정 비밀번호

- **Coupang API 인증 정보**
	- `COUPANG_SECRET_KEY`: Coupang API Secret Key
	- `COUPANG_ACCESS_KEY`: Coupang API Access Key
	- `COUPANG_VENDOR_ID`: Coupang Vendor ID

- **이메일 설정**
	- `EMAIL_SERVICE`: 이메일 서비스 프로바이더 (예: Gmail)
	- `EMAIL_HOST`: 이메일 SMTP 호스트 주소
	- `EMAIL_PORT`: 이메일 SMTP 포트
	- `EMAIL_SECURE`: 보안 연결 사용 여부 (boolean 값)
	- `EMAIL_USER`: 이메일 계정
	- `EMAIL_PASSWORD`: 이메일 비밀번호
	- `ADMIN_EMAIL_1`: 관리자 이메일 주소 1
	- `ADMIN_EMAIL_2`: 관리자 이메일 주소 2

### 2. 의존성 설치

```bash
npm install
```

### 3. 서버 실행

NestJS 서버를 실행하여 크론 작업을 시작합니다.

```bash
npm run build
npm run start:prod
```

