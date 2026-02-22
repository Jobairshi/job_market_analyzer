import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../config/supabase.module';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** Passport calls this after verifying the JWT signature. */
  async validate(payload: JwtPayload) {
    const { data: user } = await this.supabase
      .from('users')
      .select('id, email, name, role')
      .eq('id', payload.sub)
      .single();

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    // Returned object is attached to request.user
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
