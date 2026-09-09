import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { AppConfigService } from '../config/config.service';
import { SyncCoordinatorService } from './sync-coordinator.service';

@Injectable()
export class IntegrationWorkerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(IntegrationWorkerService.name);
  private stopped = false;
  private disabledNoticeShown = false;
  private readonly stopController = new AbortController();

  constructor(
    private readonly configService: AppConfigService,
    private readonly coordinatorService: SyncCoordinatorService,
  ) {}

  onApplicationBootstrap(): void {
    void this.loop();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    this.stopController.abort();
  }

  private async loop(): Promise<void> {
    const config = this.configService.value.sync;

    while (!this.stopped) {
      const startedAt = Date.now();

      if (!config.enabled) {
        if (!this.disabledNoticeShown) {
          this.logger.warn(
            'SYNC_ENABLED=false. El servicio está vivo, pero la extracción y el envío están desactivados.',
          );
          this.disabledNoticeShown = true;
        }
      } else {
        try {
          await this.coordinatorService.runCycle();
        } catch (error) {
          this.logger.error(error instanceof Error ? error.stack ?? error.message : String(error));
        }
      }

      const elapsed = Date.now() - startedAt;
      const waitMs = Math.max(100, config.intervalMs - elapsed);
      try {
        await delay(waitMs, undefined, { signal: this.stopController.signal });
      } catch (error) {
        if (this.stopped) return;
        throw error;
      }
    }
  }
}
