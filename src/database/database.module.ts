import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { SqlServerService } from './sqlserver.service';

@Module({
  imports: [ConfigModule],
  providers: [SqlServerService],
  exports: [SqlServerService],
})
export class DatabaseModule {}
