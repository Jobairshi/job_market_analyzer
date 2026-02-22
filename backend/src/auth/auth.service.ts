import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';

import { SUPABASE_CLIENT } from '../config/supabase.module';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { User } from '../common/types';

@Injectable()
export class AuthService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly jwt: JwtService,
  ) {}

  /** Register a new user. Returns JWT + user profile. */
  async register(dto: RegisterDto) {
    // Check if email already taken
    const { data: existing } = await this.supabase
      .from('users')
      .select('id')
      .eq('email', dto.email.toLowerCase())
      .maybeSingle();

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const { data: user, error } = await this.supabase
      .from('users')
      .insert({
        email: dto.email.toLowerCase(),
        password_hash: passwordHash,
        name: dto.name,
        role: 'user',
      })
      .select('id, email, name, role, created_at')
      .single();

    if (error || !user) {
      throw new ConflictException(error?.message || 'Registration failed');
    }

    return {
      access_token: this.signToken(user as User),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  /** Login with email + password. Returns JWT + user profile. */
  async login(dto: LoginDto) {
    const { data: user, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', dto.email.toLowerCase())
      .maybeSingle();

    if (error || !user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      access_token: this.signToken(user as User),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  /** Return public profile of the authenticated user. */
  async me(userId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new UnauthorizedException('User not found');
    }

    return data;
  }

  private signToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }
}
