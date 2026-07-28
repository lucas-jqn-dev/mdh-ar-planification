import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @Get()
  check(): { status: string; mongo: string; timestamp: string } {
    const mongoState: number = this.connection.readyState;
    const mongoOk = mongoState === 1;

    if (!mongoOk) {
      throw new ServiceUnavailableException({
        status: 'error',
        mongo: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ok',
      mongo: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
