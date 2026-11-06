import { describe, expect, it } from 'vitest';
import { renderNotificationEmail } from '../src/services/email.js';

describe('renderNotificationEmail', () => {
  it('brands the subject and includes talent.ai in the body', () => {
    const message = renderNotificationEmail({
      type: 'REVIEW_RECEIVED',
      title: 'A recruiter reviewed your profile',
      body: 'A recruiter reviewed your profile and left feedback!',
    });

    expect(message.subject).toBe('A recruiter reviewed your profile · talent.ai');
    expect(message.html).toContain('talent<span style="color:#6366f1;">.ai</span>');
    expect(message.html).toContain('A recruiter reviewed your profile');
    expect(message.text).toContain('A recruiter reviewed your profile and left feedback!');
    expect(message.text).toContain('https://app.talent.ai');
  });

  it('escapes user-controlled text before embedding it in HTML', () => {
    const message = renderNotificationEmail({
      type: 'SYSTEM',
      title: 'Update <script>alert(1)</script>',
      body: 'Tom & Jerry "quoted"',
    });

    expect(message.html).not.toContain('<script>alert(1)</script>');
    expect(message.html).toContain('&lt;script&gt;');
    expect(message.html).toContain('Tom &amp; Jerry &quot;quoted&quot;');
  });
});
