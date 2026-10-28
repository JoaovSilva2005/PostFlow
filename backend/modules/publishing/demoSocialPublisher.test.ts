import { describe, expect, it } from 'vitest'
import { DemoSocialPublisher } from './demoSocialPublisher.js'

describe('DemoSocialPublisher', () => {
  it('devolve mode demo e id demo-<postId>', async () => {
    const result = await new DemoSocialPublisher().publish({
      postId: 'abc',
      brandId: 'b1',
      platform: 'instagram',
      text: 'oi',
      imageUrl: null,
    })
    expect(result).toEqual({
      ok: true,
      mode: 'demo',
      externalPostId: 'demo-abc',
      externalPostUrl: null,
    })
  })
})
