import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { DestinationApiService } from './destination-api.service';

@Module({
  imports: [ConfigModule],
  providers: [DestinationApiService],
  exports: [DestinationApiService],
})
export class HttpModule {}
