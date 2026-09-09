import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { MysqlService } from './mysql.service';

@Module({
  imports: [ConfigModule],
  providers: [MysqlService],
  exports: [MysqlService],
})
export class DatabaseModule {}
