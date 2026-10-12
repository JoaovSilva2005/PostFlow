// Run with: node --import tsx scripts/database/verifySocialPublishing.mjs
// No social API calls. Removes only the randomly named image created here.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import {
  createSupabaseAdminDataClient,
  createSupabaseAuthClient,
} from '../../backend/config/supabaseServer.ts'
import { SupabaseSocialRepository } from '../../backend/modules/social-publishing/socialRepository.ts'

const admin = createSupabaseAdminDataClient()
const repository = new SupabaseSocialRepository(admin)
const workspaceId = randomUUID(),
  jobId = randomUUID()
const { data: bucket, error } = await admin.storage.getBucket(
  'social-publication-images',
)
assert.equal(error, null)
assert.equal(bucket.public, false)
assert.equal(Number(bucket.file_size_limit), 5 * 1024 * 1024)
assert.deepEqual(bucket.allowed_mime_types, ['image/jpeg'])
let imagePath
try {
  const bytes = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#123456' },
  })
    .jpeg()
    .toBuffer()
  imagePath = await repository.saveImage(workspaceId, jobId, bytes)
  assert.deepEqual(Buffer.from(await repository.loadImage(imagePath)), bytes)
  const { error: denied } = await createSupabaseAuthClient()
    .storage.from('social-publication-images')
    .download(`${workspaceId}/${jobId}/image.jpg`)
  assert.ok(
    denied,
    'Unauthenticated access to the approved snapshot must be denied',
  )
  assert.equal(
    await repository.cancel(workspaceId, jobId),
    null,
    'Nonexistent job must not cancel another brand’s publication',
  )
  console.log(
    JSON.stringify({
      bucketPrivate: true,
      imageRoundTrip: 'passed',
      anonymousAccess: 'denied',
      cancelFilterSyntax: 'passed',
      networkPosts: 0,
    }),
  )
} finally {
  if (imagePath) await repository.removeImage(imagePath)
}
