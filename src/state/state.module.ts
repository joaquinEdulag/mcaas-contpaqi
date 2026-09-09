import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { CheckpointService } from './checkpoint.service';

@Module({
  imports: [ConfigModule],
  providers: [CheckpointService],
  exports: [CheckpointService],
})
export class StateModule {}
