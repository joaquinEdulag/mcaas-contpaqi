import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { HttpModule } from '../http/http.module';
import { StateModule } from '../state/state.module';
import { GenericSqlModelService } from './generic-sql-model.service';
import { IntegrationWorkerService } from './integration-worker.service';
import { ModelCatalogService } from './model-catalog.service';
import { SyncCoordinatorService } from './sync-coordinator.service';

@Module({
  imports: [ConfigModule, DatabaseModule, HttpModule, StateModule],
  providers: [
    ModelCatalogService,
    GenericSqlModelService,
    SyncCoordinatorService,
    IntegrationWorkerService,
  ],
})
export class IntegrationModule {}
