import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { initializeTransactionalContext } from 'typeorm-transactional';

declare const module: any;

async function bootstrap() {
  initializeTransactionalContext();

  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.SERVER_PORT);
  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}

bootstrap();
