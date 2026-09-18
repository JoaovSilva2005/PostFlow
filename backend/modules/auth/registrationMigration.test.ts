// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260918144609_harden_registration_profile_constraints.sql',
  ),
  'utf8',
)

describe('persistência do cadastro', () => {
  it('mantém no banco os mesmos limites validados pela API', () => {
    expect(migration).toContain('users_display_name_length_check')
    expect(migration).toContain('profiles_display_name_length_check')
    expect(migration).toContain('brands_name_length_check')
    expect(migration).toContain('brands_segment_length_check')
    expect(migration).toContain('between 2 and 80')
    expect(migration).toContain('between 2 and 120')
  })
})
