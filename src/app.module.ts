import { Module } from '@nestjs/common';
import { IntegrationModule } from './integration/integration.module';

@Module({
  imports: [IntegrationModule],
})
export class AppModule {}
